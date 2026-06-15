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

const SOLAR_API_URL = "https://api.upstage.ai/v1/solar/chat/completions";
export const SOLAR_MODEL = "solar-1-mini-chat";

// 계획 문서 기준 임시 단가. 배포 전 Upstage 실제 pricing으로 재확인 필요.
const KRW_PER_1K_INPUT = 1.5;
const KRW_PER_1K_OUTPUT = 2.0;

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
  timeoutMs = 8000,
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
    (input / 1000) * KRW_PER_1K_INPUT + (output / 1000) * KRW_PER_1K_OUTPUT,
  );
}

// ─── Content Blocks Parser ────────────────────────────────────────

export function parseContentBlocks(solarText: string): ContentBlock[] {
  try {
    const cleaned = solarText.trim();
    const parsed = JSON.parse(cleaned);
    if (!isRecord(parsed) || !Array.isArray(parsed.content_blocks)) {
      throw new Error("content_blocks must be an array");
    }
    return validateContentBlocks(parsed.content_blocks);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`INVALID_CONTENT_BLOCKS: ${detail}`);
  }
}

function validateContentBlocks(blocks: unknown[]): ContentBlock[] {
  return blocks.map((block, index) => {
    if (!isRecord(block) || typeof block.type !== "string") {
      throw new Error(`block ${index} missing type`);
    }

    if (block.type === "text") {
      if (typeof block.text !== "string" || !block.text.trim()) {
        throw new Error(`text block ${index} missing text`);
      }
      return { type: "text", text: block.text };
    }

    if (block.type === "academy_cards") {
      if (!Array.isArray(block.items) || block.items.length > 3) {
        throw new Error(`academy_cards block ${index} must have 1-3 items`);
      }
      const items = block.items.map((item, itemIndex) => {
        if (!isRecord(item)) {
          throw new Error(
            `academy card ${index}.${itemIndex} must be an object`,
          );
        }
        if (
          typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          typeof item.match_score !== "number" ||
          typeof item.thumbnail !== "string" ||
          !Array.isArray(item.reason_tags) ||
          !item.reason_tags.every((tag) => typeof tag === "string") ||
          !(typeof item.price_monthly === "number" ||
            item.price_monthly === null)
        ) {
          throw new Error(
            `academy card ${index}.${itemIndex} has invalid schema`,
          );
        }
        return {
          id: item.id,
          name: item.name,
          match_score: item.match_score,
          thumbnail: item.thumbnail,
          reason_tags: item.reason_tags,
          price_monthly: item.price_monthly,
        };
      });
      return { type: "academy_cards", items };
    }

    if (block.type === "quick_replies") {
      if (!Array.isArray(block.items) || block.items.length > 4) {
        throw new Error(`quick_replies block ${index} must have 1-4 items`);
      }
      const items = block.items.map((item, itemIndex) => {
        if (
          !isRecord(item) ||
          typeof item.label !== "string" ||
          typeof item.payload !== "string"
        ) {
          throw new Error(
            `quick reply ${index}.${itemIndex} has invalid schema`,
          );
        }
        return { label: item.label, payload: item.payload };
      });
      return { type: "quick_replies", items };
    }

    throw new Error(`unsupported block type: ${block.type}`);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
  args: AcademyQueryArgs,
): Promise<object[]> {
  let q = supa
    .from("academies")
    .select(
      "id, name, description, address, subject, target_grade, tags, classes(fee, is_recruiting)",
    )
    .limit(5); // Solar가 최종 3개 선택

  if (args.region) q = q.ilike("address", `%${args.region}%`);
  if (args.subject) q = q.ilike("subject", `%${args.subject}%`);
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
      (a.classes as any[])?.some((c: any) =>
        c.is_recruiting && (!c.fee || c.fee <= args.fee_max!)
      )
    );
  }
  return academies;
}

// ─── Profile Tags → Query Args ────────────────────────────────────

// profile_tags 배열에서 지역/과목/학년 키워드 추출 (단순 매핑, 추후 Solar 위임 가능)
const SUBJECT_KEYWORDS = [
  "수학",
  "영어",
  "과학",
  "국어",
  "물리",
  "화학",
  "생물",
  "역사",
  "사회",
];
const REGION_KEYWORDS = [
  "강남",
  "서초",
  "송파",
  "마포",
  "분당",
  "판교",
  "목동",
  "노원",
  "용산",
];
const GRADE_PATTERNS = /초[1-6]|중[1-3]|고[1-3]/;

export function extractQueryArgs(profileTags: string[]): AcademyQueryArgs {
  const tagStr = profileTags.join(" ");
  const subject = SUBJECT_KEYWORDS.find((k) => tagStr.includes(k));
  const region = REGION_KEYWORDS.find((k) => tagStr.includes(k));
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
