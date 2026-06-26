export type ContentBlockType = "text" | "academy_cards" | "quick_replies";

export interface TextBlock {
  type: "text";
  text: string;
}

export interface AcademyCardItem {
  id: string;
  name: string;
  match_score: number;
  thumbnail: string;
  reason_tags: string[];
  price_monthly?: number;
  schedule?: string;
  teachers?: string;
  feature?: string;
}

export interface AcademyCardsBlock {
  type: "academy_cards";
  items: AcademyCardItem[];
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

export type AgentErrorCode =
  | "SOLAR_5XX"
  | "SOLAR_TIMEOUT"
  | "RATE_LIMIT"
  | "SESSION_EXPIRED"
  | "BUDGET_EXCEEDED";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content_blocks: ContentBlock[];
  turn_index?: number;
  session_meta?: string;
  error?: AgentErrorCode;
}

export type AgentPhase = "loading" | "typing" | "active" | "session_limit";

export interface AgentTurnResponse {
  message: AgentMessage;
  turns_remaining: number;
  can_continue: boolean;
}

export const MAX_USER_TURNS = 10;
export const WARN_TURNS_REMAINING = 2;
