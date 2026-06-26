import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AcademyCardItem } from "@/types/agentChat";
import { cn } from "@/lib/utils";

interface AgentAcademyCardProps {
  academy: AcademyCardItem;
  expanded: boolean;
  onToggle: () => void;
  onConsult?: () => void;
  onViewDetail?: () => void;
}

export function AgentAcademyCard({
  academy,
  expanded,
  onToggle,
  onConsult,
  onViewDetail,
}: AgentAcademyCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all border-border shadow-none",
        expanded && "ring-2 ring-primary shadow-card",
      )}
      onClick={onToggle}
    >
      <CardContent className="p-3 flex gap-2.5">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-edumap-mint-light to-muted flex items-center justify-center text-xl shrink-0">
          {academy.thumbnail}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-bold text-foreground truncate">{academy.name}</p>
          <p className="text-[11.5px] leading-snug text-muted-foreground mt-0.5">
            {academy.reason_tags.join(" · ")}
          </p>
          <p className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-edumap-mint-dark mt-1">
            <Star className="w-3 h-3 fill-edumap-mint-dark text-edumap-mint-dark" />
            {academy.match_score} match
          </p>

          {expanded && (
            <div
              className="mt-2.5 pt-2.5 border-t border-dashed border-border text-[11.5px] text-muted-foreground space-y-1"
              onClick={(e) => e.stopPropagation()}
            >
              {academy.price_monthly != null && (
                <div className="flex justify-between">
                  <span>월 수강료</span>
                  <b className="text-foreground font-bold">
                    {Math.round(academy.price_monthly / 10000)}만원
                  </b>
                </div>
              )}
              {academy.schedule && (
                <div className="flex justify-between">
                  <span>주 횟수</span>
                  <b className="text-foreground font-bold">{academy.schedule}</b>
                </div>
              )}
              {academy.teachers && (
                <div className="flex justify-between">
                  <span>강사</span>
                  <b className="text-foreground font-bold">{academy.teachers}</b>
                </div>
              )}
              {academy.feature && (
                <div className="flex justify-between">
                  <span>특징</span>
                  <b className="text-foreground font-bold">{academy.feature}</b>
                </div>
              )}
              <div className="flex gap-2 mt-2">
                {onViewDetail && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={onViewDetail}
                  >
                    상세 보기
                  </Button>
                )}
                <Button size="sm" className="flex-1 h-8 text-xs" onClick={onConsult}>
                  상담 신청하기
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
