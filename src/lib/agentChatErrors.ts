import type { AgentErrorCode } from "@/types/agentChat";

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
  AUTH_REQUIRED: {
    title: "⚠ 로그인이 필요해요",
    body: "AI 맞춤 추천을 이용하려면 로그인해주세요.",
  },
};
