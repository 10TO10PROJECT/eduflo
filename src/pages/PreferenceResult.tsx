import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, MoreHorizontal, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import { useAgentChatSession } from "@/hooks/useAgentChatSession";
import { ProfileTagStrip } from "@/components/agent-chat/ProfileTagStrip";
import { SessionWarnBanner } from "@/components/agent-chat/SessionWarnBanner";
import { AgentChatMessageList } from "@/components/agent-chat/AgentChatMessage";
import { AgentTypingIndicator } from "@/components/agent-chat/AgentTypingIndicator";
import { AcademyCardsSkeleton } from "@/components/agent-chat/AcademyCardsSkeleton";
import { AgentChatInput } from "@/components/agent-chat/AgentChatInput";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAX_RETRY_COUNT } from "@/hooks/useAgentChatSession";

const DEFAULT_PROFILE_TAGS = [
  "grade:mid_2",
  "subject:math",
  "subject:english",
  "goal:advanced",
  "budget:mid",
];

const PreferenceResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prefix = useRoutePrefix();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const profileTags = useMemo(() => {
    const tags = location.state?.profileTags as string[] | undefined;
    return tags?.length ? tags : DEFAULT_PROFILE_TAGS;
  }, [location.state]);

  const {
    sessionId,
    messages,
    phase,
    turnsRemaining,
    showSessionWarn,
    sessionCountdown,
    inputDisabled,
    inputPlaceholder,
    consumedQuickReplyIds,
    expandedCardIds,
    retryCount,
    rateLimitCountdown,
    sendTurn,
    sendQuickReply,
    retryLastTurn,
    resetSession,
    toggleCardExpand,
  } = useAgentChatSession(profileTags);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  const handleBack = () => {
    navigate(`${prefix}/home`);
  };

  const handleCardConsult = (academyId: string, academyName: string) => {
    if (academyId.startsWith("mock-")) {
      toast.info(`「${academyName}」 상담 신청은 백엔드 연동 후 이용할 수 있어요.`);
      return;
    }
    toast.success(`「${academyName}」 상담 신청으로 이동합니다.`);
  };

  const handleCardViewDetail = (academyId: string) => {
    if (academyId.startsWith("mock-")) {
      toast.info("학원 상세 페이지는 실제 학원 ID 연동 후 열립니다.");
      return;
    }
    navigate(`${prefix}/academy/${academyId}`, {
      state: { from: "chat", session_id: sessionId },
    });
  };

  const isLoading = phase === "loading";
  const isTyping = phase === "typing";
  const isSessionLimit = phase === "session_limit";

  return (
    <div className="min-h-screen bg-muted flex flex-col max-w-lg mx-auto">
      <header className="sticky top-0 z-40 bg-card border-b border-border shrink-0">
        <div className="h-[52px] px-3.5 flex items-center gap-2.5">
          <Button variant="ghost" size="icon" className="h-[30px] w-[30px] shrink-0" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Button>
          <h1 className="flex-1 text-[15px] font-bold text-foreground">맞춤 추천</h1>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-[30px] w-[30px] text-muted-foreground"
              onClick={resetSession}
              title="새 추천 받기"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-[30px] w-[30px] text-muted-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    navigate(`${prefix}/preference-result`, {
                      replace: true,
                      state: {
                        profileTags: [
                          "grade:high_3",
                          "subject:science",
                          "class_size:small",
                          "budget:low",
                        ],
                      },
                    })
                  }
                >
                  매칭 0건 테스트
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => sendTurn("에러테스트")}>
                  응답 오류 테스트
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`${prefix}/preference-test`)}>
                  선호도 테스트 다시하기
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`${prefix}/explore`)}>
                  탐색으로 이동
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBack}>홈으로</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <ProfileTagStrip profileTags={profileTags} />

      {showSessionWarn && (
        <SessionWarnBanner countdown={sessionCountdown} turnsRemaining={turnsRemaining} />
      )}

      <main className="flex-1 overflow-y-auto px-3.5 py-3.5 bg-muted/90">
        <div className="space-y-3">
          {isLoading && (
            <>
              <AgentTypingIndicator />
              <AcademyCardsSkeleton />
            </>
          )}

          <AgentChatMessageList
            messages={messages}
            consumedQuickReplyIds={consumedQuickReplyIds}
            expandedCardIds={expandedCardIds}
            onQuickReplySelect={sendQuickReply}
            onToggleCard={toggleCardExpand}
            onCardConsult={handleCardConsult}
            onCardViewDetail={handleCardViewDetail}
            onRetry={retryLastTurn}
            onReset={resetSession}
            retryDisabled={isTyping}
            retryCountdown={rateLimitCountdown}
            maxRetriesReached={retryCount >= MAX_RETRY_COUNT}
          />

          {isTyping && <AgentTypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {isSessionLimit && (
        <div className="shrink-0 px-3.5 py-2 bg-card border-t border-border">
          <Button className="w-full gap-2" onClick={resetSession}>
            <Sparkles className="w-4 h-4" />
            새 추천 받기
          </Button>
        </div>
      )}

      <AgentChatInput
        placeholder={inputPlaceholder}
        disabled={inputDisabled}
        onSend={sendTurn}
      />
    </div>
  );
};

export default PreferenceResult;
