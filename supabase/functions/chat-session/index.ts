import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  createServiceClient,
  corsHeaders,
  getRoleFromUserId,
} from "../_shared/notification.ts";
import {
  callSolar,
  calcCostKrw,
  parseContentBlocks,
  queryAcademies,
  extractQueryArgs,
  academyListToContext,
  BOOTSTRAP_PROMPT,
  SolarMessage,
} from "../_shared/solar.ts";

const DAILY_BUDGET_CAP_KRW = 2000;

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
    const { profile_tags } = await req.json();
    if (!Array.isArray(profile_tags) || profile_tags.length === 0) {
      return errResp(400, "profile_tags required");
    }

    // 일일 예산 체크
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data: todaySessions } = await supa
      .from("chat_sessions")
      .select("total_cost_krw")
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString());
    const dailyTotal = (todaySessions ?? []).reduce(
      (sum: number, s: any) => sum + (s.total_cost_krw ?? 0), 0
    );
    if (dailyTotal >= DAILY_BUDGET_CAP_KRW) return errResp(429, "BUDGET_EXCEEDED");

    // 역할 조회
    const role = await getRoleFromUserId(supa, user.id);
    if (role === "admin") return errResp(403, "Admin cannot use chat");

    // 세션 생성
    const { data: session, error: sessErr } = await supa
      .from("chat_sessions")
      .insert({
        user_id: user.id,
        role,
        profile_tags,
        surface: "preference_result",
      })
      .select()
      .single();
    if (sessErr || !session) {
      console.error("chat_sessions insert error:", sessErr?.message);
      return errResp(500, "Failed to create session");
    }

    // 학원 DB 조회
    const queryArgs = extractQueryArgs(profile_tags as string[]);
    const academies = await queryAcademies(supa, queryArgs);

    // Solar 호출
    const messages: SolarMessage[] = [
      { role: "system", content: BOOTSTRAP_PROMPT },
      {
        role: "user",
        content: `사용자 학습 선호도 태그: ${(profile_tags as string[]).join(", ")}

추천 가능한 학원 목록 (이 목록에서만 선택):
${academyListToContext(academies)}

위 정보를 바탕으로 맞춤 추천 메시지를 content_blocks JSON으로 작성해주세요.`,
      },
    ];

    const t0 = Date.now();
    const solarRes = await callSolar(messages);
    const latencyMs = Date.now() - t0;

    const content_blocks = parseContentBlocks(solarRes.text);
    const cost = calcCostKrw(solarRes.usage.input, solarRes.usage.output);
    const model_meta = {
      provider: "upstage",
      model: "solar-mini",
      latency_ms: latencyMs,
      tokens: solarRes.usage,
      cost_krw: cost,
    };

    // assistant turn 저장 + 세션 업데이트 (병렬)
    const [msgErr, sessUpdateErr] = await Promise.all([
      supa.from("chat_messages").insert({
        session_id: session.id,
        turn_index: 1,
        role: "assistant",
        content_blocks,
        model_meta,
      }).then(r => r.error),
      supa.from("chat_sessions").update({
        turn_count: 1,
        total_cost_krw: cost,
      }).eq("id", session.id).then(r => r.error),
    ]);

    if (msgErr)        console.error("chat_messages insert error:", msgErr.message);
    if (sessUpdateErr) console.error("chat_sessions update error:", sessUpdateErr.message);

    return ok({
      session_id: session.id,
      first_turn: { content_blocks, model_meta },
      turns_remaining: 9,
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("chat-session error:", msg);
    if (e instanceof DOMException && e.name === "AbortError") return errResp(504, "SOLAR_TIMEOUT");
    if (msg.startsWith("SOLAR_")) return errResp(502, msg);
    return errResp(500, msg);
  }
};

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
