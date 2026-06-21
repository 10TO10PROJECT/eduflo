import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AgentChatInputProps {
  placeholder: string;
  disabled: boolean;
  onSend: (text: string) => void;
}

export function AgentChatInput({ placeholder, disabled, onSend }: AgentChatInputProps) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="shrink-0 bg-card border-t border-border px-3.5 pt-2.5 pb-3.5">
      <div className="max-w-lg mx-auto flex gap-2 items-center">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex-1 h-[42px] rounded-full bg-muted border-transparent text-[13px]",
            value && "bg-card border-primary border-[1.5px]",
          )}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "w-[42px] h-[42px] rounded-full flex items-center justify-center shrink-0 transition-colors",
            canSend
              ? "bg-primary text-foreground"
              : "bg-muted-foreground/30 text-white cursor-not-allowed",
          )}
        >
          <ArrowUp className="w-[18px] h-[18px]" />
        </button>
      </div>
    </div>
  );
}
