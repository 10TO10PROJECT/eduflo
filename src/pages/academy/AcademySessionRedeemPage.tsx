import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  formatSessionDateTime,
  previewCouponUseCode,
  redeemCouponUseCode,
  type CouponUsePreview,
} from "@/lib/academySession";
import { formatValidUntil } from "@/lib/digitalCoupon";
import { logError } from "@/lib/errorLogger";
import { supabase } from "@/integrations/supabase/client";

const CODE_LENGTH = 6;

const AcademySessionRedeemPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const otpRef = useRef<HTMLInputElement>(null);

  const [sessionTitle, setSessionTitle] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<CouponUsePreview | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      navigate("/admin/sessions", { replace: true });
      return;
    }

    supabase
      .from("seminars")
      .select("title, date")
      .eq("id", sessionId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          toast.error("설명회를 찾을 수 없습니다.");
          navigate("/admin/sessions", { replace: true });
          return;
        }
        setSessionTitle(`${data.title} · ${formatSessionDateTime(data.date)}`);
      });
  }, [navigate, sessionId]);

  const resetForNext = useCallback(() => {
    setCode("");
    setPreview(null);
    setInlineError(null);
    setCompleted(false);
    requestAnimationFrame(() => otpRef.current?.focus());
  }, []);

  const verifyCode = useCallback(
    async (value: string) => {
      if (!sessionId || value.length !== CODE_LENGTH) return;

      setVerifying(true);
      setInlineError(null);
      setPreview(null);
      setCompleted(false);

      try {
        const result = await previewCouponUseCode(value, sessionId);
        setPreview(result);
      } catch (error: unknown) {
        logError("preview-coupon-use-code", error);
        const message =
          error && typeof error === "object" && "message" in error
            ? String((error as { message: string }).message)
            : "코드를 확인할 수 없습니다.";
        setInlineError(message);
        setCode("");
      } finally {
        setVerifying(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    if (code.length === CODE_LENGTH && !verifying && !completed) {
      verifyCode(code);
    }
  }, [code, verifyCode, verifying, completed]);

  const handleRedeem = async () => {
    if (!sessionId || !preview || code.length !== CODE_LENGTH) return;

    setSubmitting(true);
    try {
      await redeemCouponUseCode(code, sessionId);
      toast.success("쿠폰 사용 처리가 완료되었습니다.");
      setCompleted(true);
      setPreview(null);
    } catch (error: unknown) {
      logError("redeem-coupon-use-code", error);
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "사용 처리에 실패했습니다.";
      setInlineError(message);
      setPreview(null);
      setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/sessions/${sessionId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground">쿠폰 사용 처리</h1>
            {sessionTitle && (
              <p className="text-xs text-muted-foreground truncate">{sessionTitle}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-8">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">학부모가 보여준 6자리 코드를 입력하세요.</p>

          <InputOTP
            ref={otpRef}
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(value) => {
              setCode(value.toUpperCase());
              if (inlineError) setInlineError(null);
            }}
            disabled={verifying || submitting || completed}
            inputMode="text"
            autoFocus
          >
            <InputOTPGroup className="w-full justify-between">
              {Array.from({ length: CODE_LENGTH }).map((_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className="h-12 w-12 text-lg rounded-xl font-mono uppercase"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>

          {verifying && (
            <p className="text-xs text-muted-foreground text-center">코드 확인 중...</p>
          )}

          {inlineError && (
            <p className="text-sm text-destructive text-center">{inlineError}</p>
          )}
        </div>

        {preview && !completed && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-card animate-fade-up">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">학부모</span>
              <span className="font-medium text-foreground">{preview.parent_name_masked}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">혜택</span>
              <span className="font-medium text-foreground">{preview.benefit_label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">할인값</span>
              <span className="font-bold text-primary">{preview.discount_value}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">유효기간</span>
              <span className="font-medium text-foreground">
                {formatValidUntil(preview.valid_until)}까지
              </span>
            </div>
          </div>
        )}

        {completed && (
          <div className="text-center space-y-2 animate-fade-up">
            <p className="text-sm font-medium text-primary">처리 완료</p>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={resetForNext}
            >
              다음 학부모 처리
            </button>
          </div>
        )}
      </main>

      {!completed && (
        <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border p-4 z-50">
          <div className="max-w-lg mx-auto">
            <Button
              className="w-full h-14 text-base font-semibold"
              size="xl"
              disabled={!preview || submitting || verifying}
              onClick={handleRedeem}
            >
              {submitting ? "처리 중..." : "사용 처리"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademySessionRedeemPage;
