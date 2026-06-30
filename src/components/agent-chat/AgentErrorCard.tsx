import { Button } from "@/components/ui/button";
import type { AgentErrorCode } from "@/types/agentChat";
import { ERROR_MESSAGES } from "@/lib/agentChatErrors";

interface AgentErrorCardProps {
  code: AgentErrorCode;
  onRetry: () => void;
  onReset: () => void;
  retryDisabled?: boolean;
  retryCountdown?: number | null;
  maxRetriesReached?: boolean;
}

export function AgentErrorCard({
  code,
  onRetry,
  onReset,
  retryDisabled,
  retryCountdown,
  maxRetriesReached,
}: AgentErrorCardProps) {
  const { title, body } = ERROR_MESSAGES[code];

  return (
    <div className="max-w-[270px] bg-card rounded-2xl rounded-tl-sm p-3.5 border-l-[3px] border-destructive">
      <p className="text-[13.5px] font-bold text-destructive mb-1.5">{title}</p>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground mb-2.5">{body}</p>
      <div className="flex gap-1.5">
        {!maxRetriesReached && (
          <Button
            size="sm"
            className="h-8 text-xs rounded-[10px]"
            onClick={onRetry}
            disabled={retryDisabled || (retryCountdown != null && retryCountdown > 0)}
          >
            {retryCountdown != null && retryCountdown > 0
              ? `${retryCountdown}초 후 재시도`
              : "다시 시도"}
          </Button>
        )}
        {(maxRetriesReached || code === "SESSION_EXPIRED" || code === "AUTH_REQUIRED") && (
          <Button
            size="sm"
            variant="secondary"
            className="h-8 text-xs rounded-[10px]"
            onClick={onReset}
          >
            처음으로
          </Button>
        )}
        {!maxRetriesReached && code !== "SESSION_EXPIRED" && code !== "AUTH_REQUIRED" && (
          <Button
            size="sm"
            variant="secondary"
            className="h-8 text-xs rounded-[10px]"
            onClick={onReset}
          >
            처음으로
          </Button>
        )}
      </div>
    </div>
  );
}
