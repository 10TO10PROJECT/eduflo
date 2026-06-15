import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, createServiceClient } from "../_shared/notification.ts";
import {
  academyListToContext,
  BOOTSTRAP_PROMPT,
  calcCostKrw,
  callSolar,
  extractQueryArgs,
  parseContentBlocks,
  queryAcademies,
  SOLAR_MODEL,
  SolarMessage,
} from "../_shared/solar.ts";

const SESSION_COST_CAP_KRW = 500;
const SESSION_TURN_LIMIT = 10;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supa = createServiceClient();

    // JWT 검증
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return errResp(401, "Unauthorized");

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supa.auth.getUser(jwt);
    if (authError || !user) return errResp(401, "Invalid token");

    // Body 파싱
    const { session_id, user_text, payload } = await req.json();
    if (!session_id || !user_text?.trim()) {
      return errResp(400, "session_id and user_text required");
    }

    // service-role client는 RLS를 우회하므로 user_id를 명시적으로 검증한다.
    const { data: session, error: sessErr } = await supa
      .from("chat_sessions")
      .select("*")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .single();

    if (sessErr || !session) return errResp(404, "Session not found");
    if (session.turn_count >= SESSION_TURN_LIMIT) {
      return errResp(429, "SESSION_LIMIT");
    }
    if (new Date(session.expires_at) < new Date()) {
      return errResp(410, "SESSION_EXPIRED");
    }
    if (session.total_cost_krw >= SESSION_COST_CAP_KRW) {
      return errResp(429, "BUDGET_EXCEEDED");
    }

    const userTurnIdx = session.turn_count + 1;

    // user turn 저장
    const { error: userMsgErr } = await supa.from("chat_messages").insert({
      session_id,
      turn_index: userTurnIdx,
      role: "user",
      content_blocks: [{ type: "text", text: user_text.trim() }],
    });
    if (userMsgErr) {
      console.error("user turn insert error:", userMsgErr.message);
      return errResp(500, "Failed to save user message");
    }

    // 히스토리 조회
    const { data: history, error: historyErr } = await supa
      .from("chat_messages")
      .select("role, content_blocks")
      .eq("session_id", session_id)
      .order("turn_index", { ascending: true });
    if (historyErr) {
      console.error("chat history query error:", historyErr.message);
      return errResp(500, "Failed to load chat history");
    }

    // payload에 filter 지시가 있으면 재쿼리, 아니면 빈 학원 컨텍스트 (Solar가 대화로 처리)
    let academyContext = "";
    if (payload?.startsWith("filter:") || needsAcademyRequery(user_text)) {
      const args = extractQueryArgs([
        ...(session.profile_tags as string[]),
        user_text,
      ]);
      const academies = await queryAcademies(supa, args);
      academyContext = academies.length
        ? `\n\n추가 조회된 학원 목록:\n${academyListToContext(academies)}`
        : "";
    }

    // Solar messages 구성
    // academyContext가 있으면 마지막 user 메시지(방금 저장한 것)를 컨텍스트 포함 버전으로 교체
    const historyMessages = historyToMessages(history ?? []);
    const messages: SolarMessage[] = [
      { role: "system", content: BOOTSTRAP_PROMPT },
      ...(academyContext
        ? [
          ...historyMessages.slice(0, -1),
          { role: "user" as const, content: `${user_text}${academyContext}` },
        ]
        : historyMessages),
    ];

    // Solar 호출
    const t0 = Date.now();
    const solarRes = await callSolar(messages);
    const latencyMs = Date.now() - t0;

    const content_blocks = parseContentBlocks(solarRes.text);
    const cost = calcCostKrw(solarRes.usage.input, solarRes.usage.output);
    const model_meta = {
      provider: "upstage",
      model: SOLAR_MODEL,
      latency_ms: latencyMs,
      tokens: solarRes.usage,
      cost_krw: cost,
    };

    const assistantTurnIdx = userTurnIdx + 1;
    const newTurnCount = assistantTurnIdx;
    const newTotalCost = (session.total_cost_krw ?? 0) + cost;

    // assistant turn 저장 + 세션 업데이트 (병렬)
    const [assistantMsgErr, sessionUpdateErr] = await Promise.all([
      supa.from("chat_messages").insert({
        session_id,
        turn_index: assistantTurnIdx,
        role: "assistant",
        content_blocks,
        model_meta,
      }).then((r) => r.error),
      supa.from("chat_sessions").update({
        turn_count: newTurnCount,
        total_cost_krw: newTotalCost,
        status: newTurnCount >= SESSION_TURN_LIMIT ? "completed" : "active",
      }).eq("id", session_id).eq("user_id", user.id).then((r) => r.error),
    ]);
    if (assistantMsgErr) {
      console.error("assistant turn insert error:", assistantMsgErr.message);
      return errResp(500, "Failed to save assistant message");
    }
    if (sessionUpdateErr) {
      console.error("chat_sessions update error:", sessionUpdateErr.message);
      return errResp(500, "Failed to update session");
    }

    return ok({
      content_blocks,
      model_meta,
      next_actions: {
        can_continue: newTurnCount < SESSION_TURN_LIMIT,
        turns_remaining: Math.max(0, SESSION_TURN_LIMIT - newTurnCount),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("chat-message error:", msg);
    if (e instanceof DOMException && e.name === "AbortError") {
      return errResp(504, "SOLAR_TIMEOUT");
    }
    if (msg.startsWith("SOLAR_")) return errResp(502, msg);
    if (msg.startsWith("INVALID_CONTENT_BLOCKS")) return errResp(502, msg);
    return errResp(500, msg);
  }
};

// chat_messages rows → Solar messages 배열 변환
function historyToMessages(rows: any[]): SolarMessage[] {
  return rows.map((r) => {
    const parts: string[] = [];
    for (const b of r.content_blocks as any[]) {
      if (b.type === "text") {
        parts.push(b.text);
      } else if (b.type === "academy_cards") {
        const names = (b.items as any[]).map((a: any) =>
          `${a.name}(id:${a.id})`
        ).join(", ");
        parts.push(`[이전 추천 학원: ${names}]`);
      }
      // quick_replies는 맥락 불필요, skip
    }
    return { role: r.role as SolarMessage["role"], content: parts.join("\n") };
  }).filter((m) => m.content.trim());
}

// 재조회가 필요한 키워드 체크
function needsAcademyRequery(text: string): boolean {
  const triggers = [
    "다른",
    "추가",
    "더",
    "비슷한",
    "저렴한",
    "가까운",
    "근처",
    "재추천",
    "다시",
  ];
  return triggers.some((t) => text.includes(t));
}

function ok(body: object): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errResp(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(handler);
