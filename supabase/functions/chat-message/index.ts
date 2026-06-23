import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, createServiceClient } from "../_shared/notification.ts";
import {
  academyListToContext,
  BOOTSTRAP_PROMPT,
  calcCostKrw,
  callSolar,
  collectAcademyCardIdsFromRows,
  createNoMatchBlocks,
  extractQueryArgs,
  MAX_ACADEMY_CARDS_PER_SESSION,
  parseContentBlocksWithOptions,
  queryAcademies,
  SOLAR_MODEL,
  SolarMessage,
} from "../_shared/solar.ts";

const SESSION_COST_CAP_KRW = 500;
const SESSION_TURN_LIMIT = 10;
const MESSAGE_RATE_LIMIT_PER_MINUTE = 6;
const MAX_USER_TEXT_LENGTH = 200;

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
    if (
      typeof session_id !== "string" ||
      typeof user_text !== "string" ||
      !user_text.trim()
    ) {
      return errResp(400, "session_id and user_text required");
    }
    const userText = user_text.trim();
    if (userText.length > MAX_USER_TEXT_LENGTH) {
      return errResp(400, "USER_TEXT_TOO_LONG");
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

    // 히스토리 조회
    const { data: history, error: historyErr } = await supa
      .from("chat_messages")
      .select("role, content_blocks, created_at")
      .eq("session_id", session_id)
      .order("turn_index", { ascending: true });
    if (historyErr) {
      console.error("chat history query error:", historyErr.message);
      return errResp(500, "Failed to load chat history");
    }

    const oneMinuteAgo = Date.now() - 60_000;
    const recentUserMessages = (history ?? []).filter((row: any) =>
      row.role === "user" && new Date(row.created_at).getTime() >= oneMinuteAgo
    );
    if (recentUserMessages.length >= MESSAGE_RATE_LIMIT_PER_MINUTE) {
      return errResp(429, "RATE_LIMIT");
    }

    const previousAcademyIds = collectAcademyCardIdsFromRows(history ?? []);
    const remainingAcademyCards = Math.max(
      0,
      MAX_ACADEMY_CARDS_PER_SESSION - previousAcademyIds.size,
    );

    // payload에 filter 지시가 있으면 재쿼리, 아니면 빈 학원 컨텍스트 (Solar가 대화로 처리)
    let academyContext = "";
    let allowedAcademyIds = new Set<string>();
    const shouldRequery = isFilterPayload(payload) ||
      isRelaxPayload(payload) ||
      needsAcademyRequery(userText);
    if (shouldRequery && remainingAcademyCards > 0) {
      const args = extractQueryArgs([
        ...(session.profile_tags as string[]),
        userText,
      ]);
      args.exclude_ids = [...previousAcademyIds];
      const academies = await queryAcademies(supa, args);
      allowedAcademyIds = new Set(
        academies.map((academy: any) => String(academy.id)),
      );
      academyContext = academies.length
        ? `\n\n추가 조회된 학원 목록:\n${academyListToContext(academies)}`
        : "";
    }

    let content_blocks = createNoMatchBlocks();
    let model_meta = {
      provider: "upstage" as const,
      model: SOLAR_MODEL,
      latency_ms: 0,
      tokens: { input: 0, output: 0 },
      cost_krw: 0,
    };
    const shouldUseNoMatchFallback = shouldRequery &&
      remainingAcademyCards > 0 &&
      allowedAcademyIds.size === 0;

    if (!shouldUseNoMatchFallback) {
      // Solar messages 구성
      const historyMessages = historyToMessages(history ?? []);
      const userContent = [
        userText,
        academyContext,
        remainingAcademyCards <= 0
          ? "\n\n이번 세션의 학원 카드 추천 한도에 도달했습니다. 새 academy_cards는 반환하지 말고 텍스트와 quick_replies로만 답하세요."
          : "",
      ].join("");
      const messages: SolarMessage[] = [
        { role: "system", content: BOOTSTRAP_PROMPT },
        ...historyMessages,
        { role: "user", content: userContent },
      ];

      // Solar 호출
      const t0 = Date.now();
      const solarRes = await callSolar(messages, {
        promptCacheKey: `chat-session:${session_id}`,
      });
      const latencyMs = Date.now() - t0;

      content_blocks = parseContentBlocksWithOptions(solarRes.text, {
        allowedAcademyIds: allowedAcademyIds.size
          ? allowedAcademyIds
          : new Set<string>(),
        maxAcademyCards: academyContext ? remainingAcademyCards : 0,
      });
      const cost = calcCostKrw(solarRes.usage.input, solarRes.usage.output);
      model_meta = {
        provider: "upstage",
        model: SOLAR_MODEL,
        latency_ms: latencyMs,
        tokens: solarRes.usage,
        cost_krw: cost,
      };
    }

    const assistantTurnIdx = userTurnIdx + 1;
    const newTurnCount = assistantTurnIdx;
    const newTotalCost = (session.total_cost_krw ?? 0) + model_meta.cost_krw;

    // user+assistant turn 저장 후 세션 업데이트
    const { error: messageInsertErr } = await supa.from("chat_messages").insert([
      {
        session_id,
        turn_index: userTurnIdx,
        role: "user",
        content_blocks: [{ type: "text", text: userText }],
      },
      {
        session_id,
        turn_index: assistantTurnIdx,
        role: "assistant",
        content_blocks,
        model_meta,
      },
    ]);
    if (messageInsertErr) {
      console.error("chat_messages insert error:", messageInsertErr.message);
      return errResp(500, "Failed to save messages");
    }

    const { error: sessionUpdateErr } = await supa.from("chat_sessions").update({
      turn_count: newTurnCount,
      total_cost_krw: newTotalCost,
      status: newTurnCount >= SESSION_TURN_LIMIT ? "completed" : "active",
    }).eq("id", session_id).eq("user_id", user.id);
    if (sessionUpdateErr) {
      console.error("chat_sessions update error:", sessionUpdateErr.message);
      return errResp(500, "Failed to update session");
    }

    return ok({
      session_id,
      turn_index: assistantTurnIdx,
      role: "assistant",
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

function isFilterPayload(payload: unknown): boolean {
  return typeof payload === "string" && payload.startsWith("filter:");
}

function isRelaxPayload(payload: unknown): boolean {
  return typeof payload === "string" && payload.startsWith("relax:");
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
