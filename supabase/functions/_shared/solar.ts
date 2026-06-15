import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ───────────────────────────────────────────────────────

export interface TextBlock {
  type: "text";
  text: string;
}

export interface AcademyCard {
  id: string;
  name: string;
  match_score: number;
  thumbnail: string;
  reason_tags: string[];
  price_monthly: number | null;
}

export interface AcademyCardsBlock {
  type: "academy_cards";
  items: AcademyCard[];
}

export interface QuickReplyItem {
  label: string;
  payload: string;
}

export interface QuickRepliesBlock {
  type: "quick_replies";
  items: QuickReplyItem[];
}

export type ContentBlock = TextBlock | AcademyCardsBlock | QuickRepliesBlock;

export interface ModelMeta {
  provider: "upstage";
  model: string;
  latency_ms: number;
  tokens: { input: number; output: number };
  cost_krw: number;
}

export interface SolarReply {
  content_blocks: ContentBlock[];
  model_meta: ModelMeta;
}

export interface SolarMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ─── Constants ───────────────────────────────────────────────────

const SOLAR_API_URL = "https://api.upstage.ai/v1/chat/completions";
const SOLAR_MODEL   = "solar-mini";

// solar-mini: input $0.15/1M, output $0.15/1M (USD→KRW 1300 기준)
const KRW_PER_1K_INPUT  = 0.195;
const KRW_PER_1K_OUTPUT = 0.195;

export const BOOTSTRAP_PROMPT = `당신은 에듀플로 AI 학원 매칭 어시스턴트입니다.
사용자의 학습 선호도 태그와 제공된 학원 목록을 바탕으로 맞춤 추천을 제공합니다.

출력 규칙:
1. 반드시 아래 JSON 형식만 출력합니다. 마크다운, 코드블록, 설명 텍스트 없이 JSON만.
2. text 블록: 개행(\\n)만 허용. 마크다운 금지.
3. academy_cards: 제공된 학원 목록에서만 선택 (없는 학원 만들기 금지).
4. academy_cards items는 최대 3개.
5. quick_replies items는 최대 4개.

출력 형식:
{"content_blocks":[{"type":"text","text":"..."},{"type":"academy_cards","items":[{"id":"...","name":"...","match_score":90,"thumbnail":"📐","reason_tags":["소수정예"],"price_monthly":450000}]},{"type":"quick_replies","items":[{"label":"수학만 보기","payload":"filter:subject=math"}]}]}`;

// ─── Solar API ───────────────────────────────────────────────────

export async function callSolar(
  messages: SolarMessage[],
  timeoutMs = 8000
): Promise<{ text: string; usage: { input: number; output: number } }> {
  const apiKey = Deno.env.get("UPSTAGE_API_KEY");
  if (!apiKey) throw new Error("UPSTAGE_API_KEY not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(SOLAR_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: SOLAR_MODEL, messages }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SOLAR_${res.status}: ${body}`);
    }

    const json = await res.json();
    return {
      text: json.choices?.[0]?.message?.content ?? "",
      usage: {
        input: json.usage?.prompt_tokens ?? 0,
        output: json.usage?.completion_tokens ?? 0,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export function calcCostKrw(input: number, output: number): number {
  return Math.ceil(
    (input / 1000) * KRW_PER_1K_INPUT + (output / 1000) * KRW_PER_1K_OUTPUT
  );
}

// ─── Content Blocks Parser ────────────────────────────────────────

export function parseContentBlocks(solarText: string): ContentBlock[] {
  try {
    // Solar가 JSON만 출력하도록 지시했지만, 앞뒤 공백/개행 제거
    const cleaned = solarText.trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed?.content_blocks)) {
      return parsed.content_blocks as ContentBlock[];
    }
  } catch {
    // 파싱 실패 시 텍스트 블록으로 폴백
    console.warn("content_blocks parse failed, falling back to text block");
  }
  return [{ type: "text", text: solarText }];
}

// ─── Academy DB Query ─────────────────────────────────────────────

export interface AcademyQueryArgs {
  subject?: string;
  region?: string;
  fee_max?: number;
  target_grade?: string;
  exclude_ids?: string[];
}

export async function queryAcademies(
  supa: SupabaseClient,
  args: AcademyQueryArgs
): Promise<object[]> {
  let q = supa
    .from("academies")
    .select("id, name, description, address, subject, target_grade, tags, classes(fee, is_recruiting)")
    .limit(5); // Solar가 최종 3개 선택

  if (args.region)       q = q.ilike("address", `%${args.region}%`);
  if (args.subject)      q = q.ilike("subject", `%${args.subject}%`);
  if (args.target_grade) q = q.ilike("target_grade", `%${args.target_grade}%`);
  if (args.exclude_ids?.length) {
    q = q.not("id", "in", `(${args.exclude_ids.join(",")})`);
  }

  const { data, error } = await q;
  if (error) {
    console.error("queryAcademies error:", error.message);
    return [];
  }

  const academies = data ?? [];
  if (args.fee_max) {
    return academies.filter((a: any) =>
      (a.classes as any[])?.some((c: any) => c.is_recruiting && (!c.fee || c.fee <= args.fee_max!))
    );
  }
  return academies;
}

// ─── Profile Tags → Query Args ────────────────────────────────────

// profile_tags 배열에서 지역/과목/학년 키워드 추출 (단순 매핑, 추후 Solar 위임 가능)
const SUBJECT_KEYWORDS = ["수학", "영어", "과학", "국어", "물리", "화학", "생물", "역사", "사회"];
const REGION_KEYWORDS  = ["강남", "서초", "송파", "마포", "분당", "판교", "목동", "노원", "용산"];
const GRADE_PATTERNS   = /초[1-6]|중[1-3]|고[1-3]/;

export function extractQueryArgs(profileTags: string[]): AcademyQueryArgs {
  const tagStr = profileTags.join(" ");
  const subject = SUBJECT_KEYWORDS.find(k => tagStr.includes(k));
  const region  = REGION_KEYWORDS.find(k => tagStr.includes(k));
  const gradeMatch = tagStr.match(GRADE_PATTERNS);

  const feeMatch = tagStr.match(/월\s*(\d+)만/);
  const fee_max = feeMatch ? parseInt(feeMatch[1]) * 10000 : undefined;

  return {
    subject,
    region,
    target_grade: gradeMatch?.[0],
    fee_max,
  };
}

// ─── Academy List → Solar Context String ──────────────────────────

export function academyListToContext(academies: object[]): string {
  if (!academies.length) return "현재 조건에 맞는 학원 데이터가 없습니다.";
  return JSON.stringify(academies, null, 2);
}
