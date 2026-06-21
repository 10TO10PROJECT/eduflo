import { cn } from "@/lib/utils";

export function AgentTypingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-2 max-w-full animate-fade-up", className)}>
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-sky-400 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-white">AI</span>
      </div>
      <div className="inline-flex items-center gap-1 bg-card rounded-2xl rounded-tl-sm px-4 py-3">
        <span className="w-1.5 h-1.5 rounded-full bg-edumap-mint-dark animate-typing-dot" />
        <span className="w-1.5 h-1.5 rounded-full bg-edumap-mint-dark animate-typing-dot [animation-delay:0.2s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-edumap-mint-dark animate-typing-dot [animation-delay:0.4s]" />
      </div>
    </div>
  );
}
