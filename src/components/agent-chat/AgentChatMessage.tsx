import type { AgentMessage } from "@/types/agentChat";
import { AgentAcademyCard } from "@/components/agent-chat/AgentAcademyCard";
import { AgentErrorCard } from "@/components/agent-chat/AgentErrorCard";
import { QuickReplyChips } from "@/components/agent-chat/QuickReplyChips";
import { cn } from "@/lib/utils";

interface AgentChatMessageProps {
  message: AgentMessage;
  quickRepliesConsumed: boolean;
  expandedCardIds: Record<string, boolean>;
  onQuickReply: (label: string, payload: string) => void;
  onToggleCard: (cardId: string) => void;
  onCardConsult: (academyId: string, academyName: string) => void;
  onCardViewDetail: (academyId: string) => void;
  onRetry?: () => void;
  onReset?: () => void;
  retryDisabled?: boolean;
  retryCountdown?: number | null;
  maxRetriesReached?: boolean;
}

export function AgentChatMessage({
  message,
  quickRepliesConsumed,
  expandedCardIds,
  onQuickReply,
  onToggleCard,
  onCardConsult,
  onCardViewDetail,
  onRetry,
  onReset,
  retryDisabled,
  retryCountdown,
  maxRetriesReached,
}: AgentChatMessageProps) {
  if (message.role === "user") {
    const text = message.content_blocks.find((b) => b.type === "text");
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[248px] px-3.5 py-2.5 rounded-[14px] rounded-tr-sm bg-primary text-foreground text-[13.5px] leading-relaxed whitespace-pre-wrap">
          {text && "text" in text ? text.text : ""}
        </div>
      </div>
    );
  }

  const textBlocks = message.content_blocks.filter((b) => b.type === "text");
  const cardBlock = message.content_blocks.find((b) => b.type === "academy_cards");
  const quickReplyBlock = message.content_blocks.find((b) => b.type === "quick_replies");

  return (
    <div className="space-y-2 animate-fade-up">
      <div className="flex gap-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-sky-400 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-white">AI</span>
        </div>

        <div className="flex flex-col gap-2 min-w-0 flex-1">
          {message.error && onRetry && onReset ? (
            <AgentErrorCard
              code={message.error}
              onRetry={onRetry}
              onReset={onReset}
              retryDisabled={retryDisabled}
              retryCountdown={retryCountdown}
              maxRetriesReached={maxRetriesReached}
            />
          ) : (
            textBlocks.map((block, i) =>
              block.type === "text" ? (
                <div
                  key={i}
                  className="max-w-[248px] px-3.5 py-2.5 rounded-[14px] rounded-tl-sm bg-card text-foreground text-[13.5px] leading-relaxed whitespace-pre-wrap border border-border/50"
                >
                  {block.text}
                  {message.session_meta && i === textBlocks.length - 1 && !cardBlock && (
                    <small className="block mt-1 text-[10px] text-muted-foreground">
                      {message.session_meta}
                    </small>
                  )}
                </div>
              ) : null,
            )
          )}
        </div>
      </div>

      {cardBlock && cardBlock.type === "academy_cards" && (
        <div className="ml-9 flex flex-col gap-2 max-w-[280px]">
          {cardBlock.items.map((academy) => (
            <AgentAcademyCard
              key={academy.id}
              academy={academy}
              expanded={!!expandedCardIds[academy.id]}
              onToggle={() => onToggleCard(academy.id)}
              onConsult={() => onCardConsult(academy.id, academy.name)}
              onViewDetail={() => onCardViewDetail(academy.id)}
            />
          ))}
        </div>
      )}

      {quickReplyBlock && quickReplyBlock.type === "quick_replies" && (
        <QuickReplyChips
          items={quickReplyBlock.items}
          disabled={quickRepliesConsumed}
          onSelect={onQuickReply}
        />
      )}
    </div>
  );
}

export function AgentChatMessageList({
  messages,
  consumedQuickReplyIds,
  expandedCardIds,
  onQuickReplySelect,
  onToggleCard,
  onCardConsult,
  onCardViewDetail,
  onRetry,
  onReset,
  retryDisabled,
  retryCountdown,
  maxRetriesReached,
  className,
}: {
  messages: AgentMessage[];
  consumedQuickReplyIds: Set<string>;
  expandedCardIds: Record<string, boolean>;
  onQuickReplySelect: (messageId: string, label: string, payload: string) => void;
  onToggleCard: (cardId: string) => void;
  onCardConsult: (academyId: string, academyName: string) => void;
  onCardViewDetail: (academyId: string) => void;
  onRetry?: () => void;
  onReset?: () => void;
  retryDisabled?: boolean;
  retryCountdown?: number | null;
  maxRetriesReached?: boolean;
  className?: string;
}) {
  const lastErrorMessageId = findLastErrorMessageId(messages);

  return (
    <div className={cn("space-y-3", className)}>
      {messages.map((message) => (
        <AgentChatMessage
          key={message.id}
          message={message}
          quickRepliesConsumed={consumedQuickReplyIds.has(message.id)}
          expandedCardIds={expandedCardIds}
          onQuickReply={(label, payload) => onQuickReplySelect(message.id, label, payload)}
          onToggleCard={onToggleCard}
          onCardConsult={onCardConsult}
          onCardViewDetail={onCardViewDetail}
          onRetry={message.id === lastErrorMessageId ? onRetry : undefined}
          onReset={message.id === lastErrorMessageId ? onReset : undefined}
          retryDisabled={retryDisabled}
          retryCountdown={retryCountdown}
          maxRetriesReached={maxRetriesReached}
        />
      ))}
    </div>
  );
}

function findLastErrorMessageId(messages: AgentMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].error) return messages[i].id;
  }
  return undefined;
}
