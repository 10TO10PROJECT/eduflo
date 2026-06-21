export function AcademyCardsSkeleton() {
  return (
    <div className="ml-9 flex flex-col gap-1.5 w-[230px] bg-card rounded-2xl rounded-tl-sm p-3.5 border border-border">
      <div className="h-2.5 rounded-md bg-gradient-to-r from-muted via-border to-muted bg-[length:200%_100%] animate-shimmer w-[90%]" />
      <div className="h-2.5 rounded-md bg-gradient-to-r from-muted via-border to-muted bg-[length:200%_100%] animate-shimmer w-[70%]" />
      <div className="h-2.5 rounded-md bg-gradient-to-r from-muted via-border to-muted bg-[length:200%_100%] animate-shimmer w-[50%]" />
    </div>
  );
}
