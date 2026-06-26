import { getTagLabel } from "@/lib/tagDictionary";
import { cn } from "@/lib/utils";

const STRIP_PRIORITY = ["grade", "subject", "goal", "style", "budget", "class_size"];

interface ProfileTagStripProps {
  profileTags: string[];
}

export function ProfileTagStrip({ profileTags }: ProfileTagStripProps) {
  const chips = buildStripChips(profileTags);

  if (chips.length === 0) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto px-3.5 py-2 bg-edumap-mint-light/80 border-b border-border shrink-0 scrollbar-hide">
      {chips.map((chip, index) => (
        <span
          key={`${chip}-${index}`}
          className={cn(
            "px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0",
            index === 0
              ? "bg-primary text-foreground"
              : "bg-card text-muted-foreground",
          )}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function buildStripChips(profileTags: string[]): string[] {
  if (profileTags.length === 0) {
    return ["중2", "수학·영어", "성적향상", "~월 50만원"];
  }

  const byCategory: Record<string, string[]> = {};
  profileTags.forEach((tag) => {
    const category = tag.split(":")[0];
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(getTagLabel(tag));
  });

  const chips: string[] = [];

  STRIP_PRIORITY.forEach((category) => {
    const labels = byCategory[category];
    if (!labels?.length) return;

    if (category === "subject") {
      chips.push(labels.slice(0, 2).join("·"));
    } else {
      chips.push(labels[0]);
    }
  });

  return chips.slice(0, 5);
}
