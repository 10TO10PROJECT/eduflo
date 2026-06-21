import type { QuickReplyItem } from "@/types/agentChat";
import { cn } from "@/lib/utils";

interface QuickReplyChipsProps {
  items: QuickReplyItem[];
  onSelect: (label: string, payload: string) => void;
  disabled?: boolean;
  className?: string;
}

export function QuickReplyChips({
  items,
  onSelect,
  disabled,
  className,
}: QuickReplyChipsProps) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5 ml-9 transition-opacity duration-300",
        disabled && "opacity-0 pointer-events-none h-0 overflow-hidden",
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.payload}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(item.label, item.payload)}
          className="px-2.5 py-1.5 rounded-full text-[11.5px] font-semibold border border-primary text-edumap-mint-dark bg-card hover:bg-edumap-mint-light/60 transition-colors"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
