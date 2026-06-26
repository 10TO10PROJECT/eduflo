interface SessionWarnBannerProps {
  countdown: string;
  turnsRemaining: number;
}

export function SessionWarnBanner({ countdown, turnsRemaining }: SessionWarnBannerProps) {
  return (
    <div className="shrink-0 bg-amber-400 text-foreground text-[11.5px] font-semibold text-center py-2 px-3.5 border-b border-black/5">
      ⏱ 이 세션은 <b>{countdown}</b> 후 자동 종료됩니다 · 남은 대화{" "}
      <b>{turnsRemaining}턴</b>
    </div>
  );
}
