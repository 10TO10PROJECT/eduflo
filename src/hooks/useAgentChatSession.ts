import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentErrorCode, AgentMessage, AgentPhase } from "@/types/agentChat";
import { MAX_USER_TURNS, WARN_TURNS_REMAINING } from "@/types/agentChat";
import {
  createMockSessionId,
  generateErrorTurn,
  generateFirstTurn,
  generateFollowUpTurn,
  generateSessionLimitTurn,
  nextMessageId,
  resetMockMessageIds,
} from "@/lib/agentChatMock";

const TYPING_DELAY_MS = 1200;
const INITIAL_LOADING_MS = 1800;
const MAX_RETRY_COUNT = 2;

export { MAX_RETRY_COUNT };

interface PendingRequest {
  userText: string;
  payload?: string;
  isRetry: boolean;
}

interface UseAgentChatSessionResult {
  sessionId: string;
  messages: AgentMessage[];
  phase: AgentPhase;
  turnsRemaining: number;
  showSessionWarn: boolean;
  sessionCountdown: string;
  inputDisabled: boolean;
  inputPlaceholder: string;
  consumedQuickReplyIds: Set<string>;
  expandedCardIds: Record<string, boolean>;
  retryCount: number;
  rateLimitCountdown: number | null;
  sendTurn: (text: string, payload?: string) => void;
  sendQuickReply: (messageId: string, label: string, payload: string) => void;
  retryLastTurn: () => void;
  resetSession: () => void;
  toggleCardExpand: (cardId: string) => void;
}

export function useAgentChatSession(profileTags: string[]): UseAgentChatSessionResult {
  const [sessionId, setSessionId] = useState(createMockSessionId);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [phase, setPhase] = useState<AgentPhase>("loading");
  const [turnsRemaining, setTurnsRemaining] = useState(MAX_USER_TURNS);
  const [userTurnCount, setUserTurnCount] = useState(0);
  const [consumedQuickReplyIds, setConsumedQuickReplyIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [retryCount, setRetryCount] = useState(0);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [sessionCountdown, setSessionCountdown] = useState("02:00");

  const pendingRef = useRef<PendingRequest | null>(null);
  const assistantTurnRef = useRef(1);
  const simulateErrorRef = useRef(false);
  const mountedRef = useRef(true);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      if (mountedRef.current) fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  const bootstrapSession = useCallback(() => {
    clearTimers();
    resetMockMessageIds();
    const newSessionId = createMockSessionId();
    setSessionId(newSessionId);
    setMessages([]);
    setPhase("loading");
    setTurnsRemaining(MAX_USER_TURNS);
    setUserTurnCount(0);
    setConsumedQuickReplyIds(new Set());
    setExpandedCardIds({});
    setRetryCount(0);
    setRateLimitCountdown(null);
    setSessionCountdown("02:00");
    pendingRef.current = null;
    assistantTurnRef.current = 1;
    simulateErrorRef.current = false;

    schedule(() => {
      const first = generateFirstTurn(profileTags, newSessionId);
      assistantTurnRef.current = 1;
      setMessages([first.message]);
      setTurnsRemaining(first.turns_remaining);
      setPhase("active");
    }, INITIAL_LOADING_MS);
  }, [clearTimers, profileTags, schedule]);

  useEffect(() => {
    mountedRef.current = true;
    bootstrapSession();
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [bootstrapSession, clearTimers]);

  useEffect(() => {
    if (!showSessionWarnValue(turnsRemaining, userTurnCount)) return;

    let seconds = 120;
    const interval = setInterval(() => {
      seconds -= 1;
      if (seconds <= 0) {
        setSessionCountdown("00:00");
        clearInterval(interval);
        return;
      }
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      setSessionCountdown(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [turnsRemaining, userTurnCount]);

  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) return;

    const interval = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitCountdown]);

  const processAssistantResponse = useCallback(
    (request: PendingRequest) => {
      const nextTurnIndex = assistantTurnRef.current + 1;

      if (simulateErrorRef.current && !request.isRetry) {
        simulateErrorRef.current = false;
        const errorTurn = generateErrorTurn(sessionId, nextTurnIndex, "SOLAR_TIMEOUT");
        assistantTurnRef.current = nextTurnIndex;
        setMessages((prev) => [...prev, errorTurn.message]);
        setPhase("active");
        pendingRef.current = request;
        return;
      }

      if (turnsRemaining <= 0) {
        const limitTurn = generateSessionLimitTurn(sessionId, nextTurnIndex);
        assistantTurnRef.current = nextTurnIndex;
        setMessages((prev) => [...prev, limitTurn.message]);
        setPhase("session_limit");
        return;
      }

      const response = generateFollowUpTurn(
        request.userText,
        request.payload,
        sessionId,
        nextTurnIndex,
        turnsRemaining,
      );

      assistantTurnRef.current = nextTurnIndex;
      setMessages((prev) => [...prev, response.message]);
      setTurnsRemaining(response.turns_remaining);

      if (!request.isRetry) {
        setUserTurnCount((c) => c + 1);
      }

      if (!response.can_continue) {
        setPhase("session_limit");
      } else {
        setPhase("active");
      }

      pendingRef.current = null;
      setRetryCount(0);
    },
    [sessionId, turnsRemaining],
  );

  const sendTurn = useCallback(
    (text: string, payload?: string) => {
      const trimmed = text.trim();
      if (!trimmed || phase === "loading" || phase === "typing" || phase === "session_limit") {
        return;
      }

      if (turnsRemaining <= 0) return;

      if (trimmed.includes("에러테스트")) {
        simulateErrorRef.current = true;
      }

      const userMessage: AgentMessage = {
        id: nextMessageId(),
        role: "user",
        content_blocks: [{ type: "text", text: trimmed }],
      };

      const request: PendingRequest = { userText: trimmed, payload, isRetry: false };
      pendingRef.current = request;

      setMessages((prev) => [...prev, userMessage]);
      setPhase("typing");

      schedule(() => processAssistantResponse(request), TYPING_DELAY_MS);
    },
    [phase, turnsRemaining, schedule, processAssistantResponse],
  );

  const sendQuickReply = useCallback(
    (messageId: string, label: string, payload: string) => {
      setConsumedQuickReplyIds((prev) => new Set(prev).add(messageId));
      sendTurn(label, payload);
    },
    [sendTurn],
  );

  const retryLastTurn = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending || retryCount >= MAX_RETRY_COUNT) return;

    setRetryCount((c) => c + 1);
    setPhase("typing");

    setMessages((prev) => {
      const lastErrorIdx = findLastErrorIndex(prev);
      if (lastErrorIdx < 0) return prev;
      return prev.filter((_, i) => i !== lastErrorIdx);
    });

    schedule(
      () => processAssistantResponse({ ...pending, isRetry: true }),
      TYPING_DELAY_MS,
    );
  }, [retryCount, schedule, processAssistantResponse]);

  const resetSession = useCallback(() => {
    bootstrapSession();
  }, [bootstrapSession]);

  const toggleCardExpand = useCallback((cardId: string) => {
    setExpandedCardIds((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  }, []);

  const showSessionWarn = showSessionWarnValue(turnsRemaining, userTurnCount);
  const inputDisabled =
    phase === "loading" || phase === "typing" || phase === "session_limit" || turnsRemaining <= 0;

  let inputPlaceholder = "메시지를 입력하세요…";
  if (phase === "loading") inputPlaceholder = "AI가 추천을 준비하고 있어요…";
  else if (phase === "typing") inputPlaceholder = "응답을 기다리는 중…";
  else if (turnsRemaining <= WARN_TURNS_REMAINING && turnsRemaining > 0) {
    inputPlaceholder = `남은 대화 ${turnsRemaining}턴…`;
  } else if (phase === "session_limit" || turnsRemaining <= 0) {
    inputPlaceholder = "대화 한도에 도달했어요";
  }

  return {
    sessionId,
    messages,
    phase,
    turnsRemaining,
    showSessionWarn,
    sessionCountdown,
    inputDisabled,
    inputPlaceholder,
    consumedQuickReplyIds,
    expandedCardIds,
    retryCount,
    rateLimitCountdown,
    sendTurn,
    sendQuickReply,
    retryLastTurn,
    resetSession,
    toggleCardExpand,
  };
}

function showSessionWarnValue(turnsRemaining: number, userTurnCount: number): boolean {
  return turnsRemaining <= WARN_TURNS_REMAINING && userTurnCount > 0;
}

function findLastErrorIndex(messages: AgentMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].error) return i;
  }
  return -1;
}
