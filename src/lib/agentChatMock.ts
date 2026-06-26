import type {
  AcademyCardItem,
  AgentErrorCode,
  AgentMessage,
  AgentTurnResponse,
  ContentBlock,
  QuickReplyItem,
} from "@/types/agentChat";

const MOCK_ACADEMIES: AcademyCardItem[] = [
  {
    id: "mock-acad-1",
    name: "강남수학연구소",
    match_score: 96,
    thumbnail: "🧮",
    reason_tags: ["소수정예", "중등 심화", "강남구"],
    price_monthly: 450000,
    schedule: "주 3회 · 90분",
    teachers: "3인 · SKY 출신",
    feature: "1:6 소수정예",
  },
  {
    id: "mock-acad-2",
    name: "에듀플로 영수학원",
    match_score: 91,
    thumbnail: "📐",
    reason_tags: ["통합 영수", "중등 내신", "강남구"],
    price_monthly: 480000,
    schedule: "주 4회 · 80분",
    teachers: "5인 · 전문 강사",
    feature: "내신·수능 통합",
  },
  {
    id: "mock-acad-3",
    name: "테크노 수학영재",
    match_score: 87,
    thumbnail: "✏️",
    reason_tags: ["영재반", "경시 대비", "분당"],
    price_monthly: 520000,
    schedule: "주 2회 · 120분",
    teachers: "2인 · 올림피아드",
    feature: "경시·영재 특화",
  },
];

const MATH_ACADEMIES: AcademyCardItem[] = [
  {
    id: "mock-acad-m1",
    name: "강남수학연구소",
    match_score: 94,
    thumbnail: "🧮",
    reason_tags: ["수학 전문", "소수정예", "강남구"],
    price_monthly: 450000,
    schedule: "주 3회 · 90분",
    teachers: "3인 · SKY 출신",
    feature: "1:6 소수정예",
  },
  {
    id: "mock-acad-m2",
    name: "수학의 정석 학원",
    match_score: 89,
    thumbnail: "📊",
    reason_tags: ["수학 심화", "중등", "서초구"],
    price_monthly: 420000,
    schedule: "주 3회 · 100분",
    teachers: "4인",
    feature: "개념+심화 병행",
  },
  {
    id: "mock-acad-m3",
    name: "올림피아드 수학",
    match_score: 85,
    thumbnail: "🏆",
    reason_tags: ["경시", "수학", "분당"],
    price_monthly: 550000,
    schedule: "주 2회 · 150분",
    teachers: "2인 · 메달리스트",
    feature: "경시대회 특화",
  },
];

const BUDGET_ACADEMIES: AcademyCardItem[] = [
  {
    id: "mock-acad-b1",
    name: "합리학원",
    match_score: 82,
    thumbnail: "💰",
    reason_tags: ["가성비", "중규모", "강남구"],
    price_monthly: 280000,
    schedule: "주 3회 · 80분",
    teachers: "6인",
    feature: "월 28만원대",
  },
  {
    id: "mock-acad-b2",
    name: "스마트 영수",
    match_score: 78,
    thumbnail: "📚",
    reason_tags: ["통합반", "내신", "역삼"],
    price_monthly: 320000,
    schedule: "주 4회 · 70분",
    teachers: "8인",
    feature: "대형반 가성비",
  },
  {
    id: "mock-acad-b3",
    name: "이코노미 학습",
    match_score: 75,
    thumbnail: "✨",
    reason_tags: ["저렴", "온·오프", "선릉"],
    price_monthly: 250000,
    schedule: "주 2회 · 90분",
    teachers: "4인",
    feature: "온라인 할인",
  },
];

const DEFAULT_QUICK_REPLIES: QuickReplyItem[] = [
  { label: "수학만 보고 싶어", payload: "filter:subject=math" },
  { label: "가격대 더 낮춰서", payload: "filter:price=low" },
  { label: "소수정예 학원", payload: "filter:class_size=small" },
  { label: "주말반 가능", payload: "filter:schedule=weekend" },
];

const NO_MATCH_QUICK_REPLIES: QuickReplyItem[] = [
  { label: "예산 30만까지 OK", payload: "filter:budget=300k" },
  { label: "대형반도 보고싶어", payload: "filter:class_size=large" },
  { label: "인접 지역 추가", payload: "filter:region=expand" },
];

let messageIdCounter = 0;

export function nextMessageId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}-${Date.now()}`;
}

export function resetMockMessageIds(): void {
  messageIdCounter = 0;
}

export function createMockSessionId(): string {
  return `sess_${Math.random().toString(36).slice(2, 8)}`;
}

function buildAssistantMessage(
  blocks: ContentBlock[],
  turnIndex: number,
  sessionId: string,
  error?: AgentErrorCode,
): AgentMessage {
  return {
    id: nextMessageId(),
    role: "assistant",
    content_blocks: blocks,
    turn_index: turnIndex,
    session_meta: `session_id=${sessionId} · turn ${turnIndex}/10`,
    error,
  };
}

export function isNoMatchProfile(profileTags: string[]): boolean {
  const hasTightBudget = profileTags.includes("budget:low");
  const hasSmallClass = profileTags.includes("class_size:small");
  const hasHighGrade = profileTags.includes("grade:high_3");
  const hasScience =
    profileTags.includes("subject:science") ||
    profileTags.some((t) => t.includes("physics") || t.includes("chemistry"));
  return hasTightBudget && hasSmallClass && (hasHighGrade || hasScience);
}

export function generateFirstTurn(
  profileTags: string[],
  sessionId: string,
): AgentTurnResponse {
  if (isNoMatchProfile(profileTags)) {
    return generateNoMatchTurn(sessionId, 1);
  }

  const message = buildAssistantMessage(
    [
      {
        type: "text",
        text: "안녕하세요! 선택하신 조건을 바탕으로 맞춤 학원 3곳을 골라봤어요.\n마음에 드는 곳을 탭하시면 자세히 보여드릴게요.",
      },
      { type: "academy_cards", items: MOCK_ACADEMIES },
      { type: "quick_replies", items: DEFAULT_QUICK_REPLIES },
    ],
    1,
    sessionId,
  );

  return { message, turns_remaining: 9, can_continue: true };
}

export function generateNoMatchTurn(
  sessionId: string,
  turnIndex: number,
): AgentTurnResponse {
  const message = buildAssistantMessage(
    [
      {
        type: "text",
        text: "앗, 조건에 딱 맞는 학원이 없어요 😢\n보통 고3 물·화 소수정예반은 월 35만원부터예요.\n어떻게 조건을 좀 바꿔볼까요?",
      },
      { type: "quick_replies", items: NO_MATCH_QUICK_REPLIES },
    ],
    turnIndex,
    sessionId,
  );

  return { message, turns_remaining: 10 - turnIndex, can_continue: true };
}

export function generateFollowUpTurn(
  userText: string,
  payload: string | undefined,
  sessionId: string,
  turnIndex: number,
  turnsRemaining: number,
): AgentTurnResponse {
  const normalized = `${userText} ${payload ?? ""}`.toLowerCase();

  if (
    normalized.includes("filter:subject=math") ||
    normalized.includes("수학만")
  ) {
    return {
      message: buildAssistantMessage(
        [
          {
            type: "text",
            text: "수학 전문 학원 3곳으로 좁혔어요. 소수정예와 심화반 위주예요.",
          },
          { type: "academy_cards", items: MATH_ACADEMIES },
          {
            type: "quick_replies",
            items: [
              { label: "가격대 더 낮춰서", payload: "filter:price=low" },
              { label: "두 곳만 비교해줘", payload: "action:compare" },
            ],
          },
        ],
        turnIndex,
        sessionId,
      ),
      turns_remaining: turnsRemaining - 1,
      can_continue: turnsRemaining > 1,
    };
  }

  if (
    normalized.includes("filter:price=low") ||
    normalized.includes("filter:budget") ||
    normalized.includes("가격") ||
    normalized.includes("예산")
  ) {
    return {
      message: buildAssistantMessage(
        [
          {
            type: "text",
            text: "월 30~35만원대 가성비 학원 3곳이에요. 내신 대비반도 포함돼요.",
          },
          { type: "academy_cards", items: BUDGET_ACADEMIES },
          {
            type: "quick_replies",
            items: [
              { label: "수학만 보고 싶어", payload: "filter:subject=math" },
              { label: "소수정예 학원", payload: "filter:class_size=small" },
            ],
          },
        ],
        turnIndex,
        sessionId,
      ),
      turns_remaining: turnsRemaining - 1,
      can_continue: turnsRemaining > 1,
    };
  }

  if (
    normalized.includes("filter:class_size=small") ||
    normalized.includes("소수정예")
  ) {
    return {
      message: buildAssistantMessage(
        [
          {
            type: "text",
            text: "소수정예(1:6 이하) 학원 위주로 다시 골랐어요.",
          },
          { type: "academy_cards", items: MOCK_ACADEMIES },
        ],
        turnIndex,
        sessionId,
      ),
      turns_remaining: turnsRemaining - 1,
      can_continue: turnsRemaining > 1,
    };
  }

  if (
    normalized.includes("action:compare") ||
    normalized.includes("비교")
  ) {
    return {
      message: buildAssistantMessage(
        [
          {
            type: "text",
            text: "강남수학연구소 vs 에듀플로 영수학원 비교예요.\n\n• 강남수학연구소: 소수정예·심화, 월 45만, 주 3회\n• 에듀플로 영수학원: 영수 통합·내신, 월 48만, 주 4회\n\n둘 다 강남구이고 매칭 점수 90+예요.",
          },
        ],
        turnIndex,
        sessionId,
      ),
      turns_remaining: turnsRemaining - 1,
      can_continue: turnsRemaining > 1,
    };
  }

  if (
    normalized.includes("filter:region=expand") ||
    normalized.includes("인접")
  ) {
    return {
      message: buildAssistantMessage(
        [
          {
            type: "text",
            text: "강남·서초·분당 인접 지역까지 넓혀 3곳 찾았어요.",
          },
          { type: "academy_cards", items: MOCK_ACADEMIES },
        ],
        turnIndex,
        sessionId,
      ),
      turns_remaining: turnsRemaining - 1,
      can_continue: turnsRemaining > 1,
    };
  }

  if (
    normalized.includes("filter:class_size=large") ||
    normalized.includes("대형")
  ) {
    return {
      message: buildAssistantMessage(
        [
          {
            type: "text",
            text: "중·대규모 반 위주로 조건을 완화해 3곳 추천드려요.",
          },
          { type: "academy_cards", items: BUDGET_ACADEMIES },
        ],
        turnIndex,
        sessionId,
      ),
      turns_remaining: turnsRemaining - 1,
      can_continue: turnsRemaining > 1,
    };
  }

  return {
    message: buildAssistantMessage(
      [
        {
          type: "text",
          text: `네, "${userText}" 조건을 반영해 다시 살펴봤어요.\n더 좁히고 싶으시면 아래에서 선택하거나 직접 입력해주세요.`,
        },
        {
          type: "quick_replies",
          items: DEFAULT_QUICK_REPLIES.slice(0, 3),
        },
      ],
      turnIndex,
      sessionId,
    ),
    turns_remaining: turnsRemaining - 1,
    can_continue: turnsRemaining > 1,
  };
}

export function generateSessionLimitTurn(
  sessionId: string,
  turnIndex: number,
): AgentTurnResponse {
  const message = buildAssistantMessage(
    [
      {
        type: "text",
        text: "이번 세션 대화 한도에 도달했어요.\n새로운 조건으로 다시 추천받으시려면 아래 버튼을 눌러주세요.",
      },
    ],
    turnIndex,
    sessionId,
  );

  return { message, turns_remaining: 0, can_continue: false };
}

export function generateErrorTurn(
  sessionId: string,
  turnIndex: number,
  code: AgentErrorCode = "SOLAR_TIMEOUT",
): AgentTurnResponse {
  const message = buildAssistantMessage([], turnIndex, sessionId, code);
  return { message, turns_remaining: turnIndex, can_continue: true };
}

export const ERROR_MESSAGES: Record<
  AgentErrorCode,
  { title: string; body: string }
> = {
  SOLAR_5XX: {
    title: "⚠ 잠시 응답이 지연되고 있어요",
    body: "Solar AI 서버 응답이 늦거나 일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
  },
  SOLAR_TIMEOUT: {
    title: "⚠ 응답 시간이 초과됐어요",
    body: "AI 응답이 8초를 넘겼어요. 네트워크 상태를 확인하고 다시 시도해주세요.",
  },
  RATE_LIMIT: {
    title: "⚠ 요청이 많아요",
    body: "잠시 후 다시 시도해주세요. 30초 후 자동으로 재시도할 수 있어요.",
  },
  SESSION_EXPIRED: {
    title: "⚠ 세션이 만료됐어요",
    body: "24시간이 지나 세션이 종료됐어요. 새 추천을 받으려면 처음부터 시작해주세요.",
  },
  BUDGET_EXCEEDED: {
    title: "⚠ 일일 사용 한도에 도달했어요",
    body: "오늘 AI 추천 한도를 모두 사용했어요. 내일 다시 이용해주세요.",
  },
};
