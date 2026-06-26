import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, UsersRound, Presentation } from "lucide-react";
import Logo from "@/components/Logo";
import { cn } from "@/lib/utils";

type RoleChoice = "student" | "parent" | "admin";

interface RoleCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

const RoleCard = ({ icon, title, description, onClick }: RoleCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left sm:gap-4 sm:p-5",
      "shadow-sm transition-colors hover:bg-muted/40 active:scale-[0.99]",
      "min-h-[4.5rem] touch-manipulation"
    )}
  >
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted sm:h-14 sm:w-14">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[15px] font-semibold text-foreground sm:text-base">{title}</div>
      <p className="mt-0.5 text-xs text-muted-foreground leading-snug sm:mt-1 sm:text-sm">
        {description}
      </p>
    </div>
  </button>
);

const RoleSelection = () => {
  const navigate = useNavigate();

  const handleSelect = (role: RoleChoice) => {
    if (role === "student") {
      navigate("/s/home");
      return;
    }
    if (role === "parent") {
      navigate("/p/home");
      return;
    }
    navigate("/auth?role=admin");
  };

  /** 첨부 디자인과 유사한 틸·민트 라인 아이콘 (Lucide는 currentColor로 선 색 적용) */
  const iconClass = "h-6 w-6 text-edumap-mint sm:h-7 sm:w-7";

  return (
    <div className="flex min-h-screen min-h-dvh flex-col overflow-y-auto bg-background">
      <div
        className={cn(
          "flex flex-1 flex-col justify-center px-4 py-6 sm:px-6 sm:py-10",
          "pt-[max(1.5rem,env(safe-area-inset-top))]"
        )}
      >
        <div className="mx-auto w-full max-w-md space-y-3 sm:space-y-4">
          <div className="flex justify-center pb-4 sm:pb-6 animate-float">
            <Logo size="lg" showText={false} />
          </div>
          <RoleCard
            icon={<GraduationCap className={iconClass} strokeWidth={2} aria-hidden />}
            title="학생으로 시작하기"
            description="내 시간표를 관리하고 학원을 찾아요"
            onClick={() => handleSelect("student")}
          />
          <RoleCard
            icon={<UsersRound className={iconClass} strokeWidth={2} aria-hidden />}
            title="학부모로 시작하기"
            description="자녀의 학원과 일정을 관리해요"
            onClick={() => handleSelect("parent")}
          />
          <RoleCard
            icon={<Presentation className={iconClass} strokeWidth={2} aria-hidden />}
            title="학원 관리자로 시작하기"
            description="학원 홍보와 원생 관리가 필요해요"
            onClick={() => handleSelect("admin")}
          />
        </div>
      </div>

      <div
        className={cn(
          "shrink-0 px-4 text-center sm:px-6",
          "pb-[max(2rem,env(safe-area-inset-bottom))] sm:pb-[max(2.5rem,env(safe-area-inset-bottom))]"
        )}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          시작하면 서비스 이용약관과 개인정보처리방침에 동의하게 됩니다
        </p>
      </div>
    </div>
  );
};

export default RoleSelection;
