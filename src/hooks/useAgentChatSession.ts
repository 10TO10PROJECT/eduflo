import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { AgentErrorCode, AgentMessage, AgentPhase } from "@/types/agentChat";
import { MAX_USER_TURNS, WARN_TURNS_REMAINING } from "@/types/agentChat";
import {
  AgentChatApiError,
  buildAssistantMessage,
  buildErrorMessage,
  createChatSession,
  nextMessageId,
  resetMessageIds,
  sendChatMessage,
} from "@/lib/agentChatApi";
import { supabase } from "@/integrations/supabase/client";

const MAX_RETRY_COUNT = 2;
const RATE_LIMIT_COOLDOWN_SEC = 30;

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
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState("");
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
  const assistantTurnRef = useRef(0);
  const mountedRef = useRef(true);
  const requestGenRef = useRef(0);

  const handleAuthRequired = useCallback(() => {
    toast.error("로그인이 필요합니다");
    const redirect = window.location.pathname + window.location.search;
    navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
  }, [navigate]);

  const applyApiError = useCallback(
    (error: unknown, nextTurnIndex: number) => {
      if (error instanceof AgentChatApiError) {
        if (error.code === "AUTH_REQUIRED") {
          handleAuthRequired();
          return;
        }
        if (error.code === "SESSION_LIMIT") {
          setPhase("session_limit");
          setTurnsRemaining(0);
          return;
        }
        if (error.code === "RATE_LIMIT") {
          setRateLimitCountdown(RATE_LIMIT_COOLDOWN_SEC);
        }
        if (error.code === "BUDGET_EXCEEDED") {
          setPhase("session_limit");
        }
        if (
          error.code === "SOLAR_5XX" ||
          error.code === "SOLAR_TIMEOUT" ||
          error.code === "RATE_LIMIT" ||
          error.code === "SESSION_EXPIRED" ||
          error.code === "BUDGET_EXCEEDED"
        ) {
          const errorMessage = buildErrorMessage(
            sessionId,
            nextTurnIndex,
            error.code as AgentErrorCode,
          );
          assistantTurnRef.current = nextTurnIndex;
          setMessages((prev) => [...prev, errorMessage]);
          setPhase("active");
          return;
        }
      }

      toast.error("AI 응답을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      setPhase("active");
    },
    [handleAuthRequired, sessionId],
  );

  const bootstrapSession = useCallback(async () => {
    requestGenRef.current += 1;
    const generation = requestGenRef.current;

    resetMessageIds();
    setSessionId("");
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
    assistantTurnRef.current = 0;

    const { data: authData } = await supabase.auth.getSession();
    if (!mountedRef.current || generation !== requestGenRef.current) return;

    if (!authData.session) {
      handleAuthRequired();
      setPhase("active");
      return;
    }

    try {
      const result = await createChatSession(profileTags);
      if (!mountedRef.current || generation !== requestGenRef.current) return;

      setSessionId(result.session_id);
      assistantTurnRef.current = result.first_turn.turn_index;
      setMessages([
        buildAssistantMessage(result.first_turn, result.session_id),
      ]);
      setTurnsRemaining(result.turns_remaining);
      setPhase("active");
    } catch (error) {
      if (!mountedRef.current || generation !== requestGenRef.current) return;

      if (error instanceof AgentChatApiError) {
        if (error.code === "AUTH_REQUIRED") {
          handleAuthRequired();
          setPhase("active");
          return;
        }
        if (error.code === "BUDGET_EXCEEDED") {
          setPhase("session_limit");
          setMessages([buildErrorMessage("", 1, "BUDGET_EXCEEDED")]);
          return;
        }
        if (error.code === "RATE_LIMIT") {
          setRateLimitCountdown(RATE_LIMIT_COOLDOWN_SEC);
          setMessages([buildErrorMessage("", 1, "RATE_LIMIT")]);
          setPhase("active");
          return;
        }
        if (
          error.code === "SOLAR_5XX" ||
          error.code === "SOLAR_TIMEOUT" ||
          error.code === "SESSION_EXPIRED"
        ) {
          setMessages([buildErrorMessage("", 1, error.code)]);
          setPhase("active");
          return;
        }
      }

      toast.error("AI 추천을 시작하지 못했어요. 잠시 후 다시 시도해주세요.");
      setPhase("active");
    }
  }, [applyApiError, handleAuthRequired, profileTags]);

  useEffect(() => {
    mountedRef.current = true;
    bootstrapSession();
    return () => {
      mountedRef.current = false;
    };
  }, [bootstrapSession]);

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
    async (request: PendingRequest) => {
      const nextTurnIndex = assistantTurnRef.current + (request.isRetry ? 1 : 2);
      const generation = requestGenRef.current;

      if (!sessionId) {
        setPhase("active");
        return;
      }

      try {
        const response = await sendChatMessage(
          sessionId,
          request.userText,
          request.payload,
        );
        if (!mountedRef.current || generation !== requestGenRef.current) return;

        assistantTurnRef.current = response.turn_index;
        setMessages((prev) => [
          ...prev,
          buildAssistantMessage(response, sessionId),
        ]);
        setTurnsRemaining(response.next_actions.turns_remaining);

        if (!request.isRetry) {
          setUserTurnCount((c) => c + 1);
        }

        if (!response.next_actions.can_continue) {
          setPhase("session_limit");
        } else {
          setPhase("active");
        }

        pendingRef.current = null;
        setRetryCount(0);
      } catch (error) {
        if (!mountedRef.current || generation !== requestGenRef.current) return;
        applyApiError(error, nextTurnIndex);
      }
    },
    [applyApiError, sessionId],
  );

  const sendTurn = useCallback(
    (text: string, payload?: string) => {
      const trimmed = text.trim();
      if (!trimmed || phase === "loading" || phase === "typing" || phase === "session_limit") {
        return;
      }

      if (turnsRemaining <= 0) return;

      const request: PendingRequest = { userText: trimmed, payload, isRetry: false };
      pendingRef.current = request;

      const userMessage: AgentMessage = {
        id: nextMessageId(),
        role: "user",
        content_blocks: [{ type: "text", text: trimmed }],
      };

      setMessages((prev) => [...prev, userMessage]);
      setPhase("typing");
      void processAssistantResponse(request);
    },
    [phase, turnsRemaining, processAssistantResponse],
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

    void processAssistantResponse({ ...pending, isRetry: true });
  }, [retryCount, processAssistantResponse]);

  const resetSession = useCallback(() => {
    void bootstrapSession();
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
