import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type {
  AgentErrorCode,
  AgentMessage,
  ContentBlock,
  ModelMeta,
} from "@/types/agentChat";

let messageIdCounter = 0;

export function nextMessageId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}-${Date.now()}`;
}

export function resetMessageIds(): void {
  messageIdCounter = 0;
}

export interface ChatTurnPayload {
  session_id: string;
  turn_index: number;
  role: "assistant";
  content_blocks: ContentBlock[];
  model_meta?: ModelMeta;
}

export interface CreateSessionResponse {
  session_id: string;
  first_turn: ChatTurnPayload;
  turns_remaining: number;
}

export interface SendMessageResponse {
  session_id: string;
  turn_index: number;
  role: "assistant";
  content_blocks: ContentBlock[];
  model_meta?: ModelMeta;
  next_actions: {
    can_continue: boolean;
    turns_remaining: number;
  };
}

export class AgentChatApiError extends Error {
  constructor(
    public readonly code: AgentErrorCode | "SESSION_LIMIT" | "UNKNOWN",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AgentChatApiError";
  }
}

export function buildAssistantMessage(
  turn: Pick<ChatTurnPayload, "turn_index" | "content_blocks">,
  sessionId: string,
  error?: AgentErrorCode,
): AgentMessage {
  return {
    id: nextMessageId(),
    role: "assistant",
    content_blocks: turn.content_blocks,
    turn_index: turn.turn_index,
    session_meta: `session_id=${sessionId} · turn ${turn.turn_index}/10`,
    error,
  };
}

export function buildErrorMessage(
  sessionId: string,
  turnIndex: number,
  code: AgentErrorCode,
): AgentMessage {
  return buildAssistantMessage(
    { turn_index: turnIndex, content_blocks: [] },
    sessionId,
    code,
  );
}

export async function createChatSession(
  profileTags: string[],
): Promise<CreateSessionResponse> {
  const { data, error } = await supabase.functions.invoke("chat-session", {
    body: { profile_tags: profileTags },
  });

  if (error) {
    throw await toApiError(error);
  }

  return data as CreateSessionResponse;
}

export async function sendChatMessage(
  sessionId: string,
  userText: string,
  payload?: string,
): Promise<SendMessageResponse> {
  const body: Record<string, string> = {
    session_id: sessionId,
    user_text: userText,
  };
  if (payload) body.payload = payload;

  const { data, error } = await supabase.functions.invoke("chat-message", {
    body,
  });

  if (error) {
    throw await toApiError(error);
  }

  return data as SendMessageResponse;
}

async function toApiError(error: unknown): Promise<AgentChatApiError> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    let serverError = "";

    try {
      const payload = await error.context.json();
      if (payload && typeof payload.error === "string") {
        serverError = payload.error;
      }
    } catch {
      // ignore JSON parse failure
    }

    const code = mapServerError(status, serverError);
    return new AgentChatApiError(code, serverError || error.message);
  }

  if (error instanceof AgentChatApiError) return error;

  return new AgentChatApiError("UNKNOWN", String(error));
}

function mapServerError(
  status: number,
  serverError: string,
): AgentChatApiError["code"] {
  if (status === 401) return "AUTH_REQUIRED";
  if (status === 410 && serverError === "SESSION_EXPIRED") return "SESSION_EXPIRED";
  if (status === 429 && serverError === "BUDGET_EXCEEDED") return "BUDGET_EXCEEDED";
  if (status === 429 && serverError === "SESSION_LIMIT") return "SESSION_LIMIT";
  if (status === 429 && serverError === "RATE_LIMIT") return "RATE_LIMIT";
  if (status === 504 && serverError === "SOLAR_TIMEOUT") return "SOLAR_TIMEOUT";
  if (status === 502 && serverError.startsWith("SOLAR_")) return "SOLAR_5XX";
  if (status === 502 && serverError.startsWith("INVALID_CONTENT_BLOCKS")) {
    return "SOLAR_5XX";
  }
  if (status >= 500) return "SOLAR_5XX";
  return "UNKNOWN";
}
