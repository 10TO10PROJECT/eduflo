import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { signInWithPhoneNumber, RecaptchaVerifier, type ConfirmationResult } from "firebase/auth";
import { ArrowLeft, Phone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { firebaseAuth } from "@/integrations/firebase/client";
import { supabase } from "@/integrations/supabase/client";
import { formatPhoneWithDash, getDigitsOnly } from "@/lib/formatPhone";
import { logError } from "@/lib/errorLogger";
import { hasUserCouponsForSeminar } from "@/lib/digitalCoupon";
import { formatSeminarHeader, validateSeminarSession } from "@/lib/parentCheckIn";
import { sendIdTokenToBackend } from "@/lib/sendIdTokenToBackend";

function isPhoneAuthAllowedHost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname.toLowerCase();
  return host !== "localhost" && host !== "127.0.0.1";
}

function toE164(phone: string) {
  const digits = getDigitsOnly(phone);
  return digits.startsWith("82") ? `+${digits}` : `+82${digits.replace(/^0/, "")}`;
}

interface SessionInfo {
  id: string;
  title: string;
  date: string;
  status: string;
  academy?: { name: string } | null;
}

const OTP_LENGTH = 6;
const MAX_OTP_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 60;

const ParentCheckInVerifyPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const pendingPhoneRef = useRef<string | null>(null);
  const [recaptchaKey, setRecaptchaKey] = useState(0);
  const autoSentPhoneRef = useRef<string | null>(null);

  const resetOtpState = useCallback(() => {
    setShowOtp(false);
    setOtp("");
    setOtpSecondsLeft(0);
    confirmationResultRef.current = null;
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // ignore
      }
      recaptchaVerifierRef.current = null;
    }
  }, []);

  const redirectIfAlreadyCheckedIn = useCallback(
    async (userId: string) => {
      if (!sessionId) return false;
      const existingCoupon = await hasUserCouponsForSeminar(sessionId, userId);
      if (existingCoupon) {
        navigate("/p/coupons", { replace: true });
        return true;
      }
      return false;
    },
    [navigate, sessionId],
  );

  useEffect(() => {
    if (!sessionId) {
      navigate("/p/check-in", { replace: true });
      return;
    }

    const loadSession = async () => {
      try {
        const validation = await validateSeminarSession(sessionId);
        if (!validation.valid) {
          toast.error(validation.message ?? "유효하지 않은 세션입니다.");
          navigate("/p/check-in", { replace: true });
          return;
        }

        const { data, error } = await supabase
          .from("seminars")
          .select("id, title, date, status, academy:academies(name)")
          .eq("id", sessionId)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          toast.error("존재하지 않는 설명회 세션입니다.");
          navigate("/p/check-in", { replace: true });
          return;
        }

        setSession(data as SessionInfo);
      } catch (error) {
        logError("check-in-load-session", error);
        toast.error("세션 정보를 불러올 수 없습니다.");
        navigate("/p/check-in", { replace: true });
      } finally {
        setLoadingSession(false);
      }
    };

    loadSession();
  }, [navigate, sessionId]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: authSession } }) => {
      if (authSession?.user?.id) {
        const redirected = await redirectIfAlreadyCheckedIn(authSession.user.id);
        if (redirected) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", authSession.user.id)
          .maybeSingle();

        const phoneFromProfile = profile?.phone?.trim();
        if (phoneFromProfile) {
          setPhone(formatPhoneWithDash(phoneFromProfile));
        }
      }
    });
  }, [redirectIfAlreadyCheckedIn]);

  useEffect(() => {
    if (!showOtp || otpSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setOtpSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [showOtp, otpSecondsLeft]);

  useEffect(() => {
    if (lockoutSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setLockoutSecondsLeft((prev) => {
        if (prev <= 1) {
          setOtpAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSecondsLeft]);

  const requestOtp = useCallback(() => {
    if (!termsAgreed) {
      toast.error("약관에 동의해주세요.");
      return;
    }
    if (getDigitsOnly(phone).length < 10) {
      toast.error("휴대폰 번호를 입력해주세요.");
      return;
    }
    if (!isPhoneAuthAllowedHost()) {
      toast.error("휴대폰 인증은 배포된 주소에서만 가능합니다.");
      return;
    }
    if (lockoutSecondsLeft > 0) {
      toast.error(`${lockoutSecondsLeft}초 후 다시 시도해주세요.`);
      return;
    }

    setSendingOtp(true);
    pendingPhoneRef.current = phone.trim();
    setRecaptchaKey((key) => key + 1);
  }, [lockoutSecondsLeft, phone, termsAgreed]);

  useEffect(() => {
    if (recaptchaKey === 0) return;

    const phoneToSend = pendingPhoneRef.current;
    const container = recaptchaContainerRef.current;
    if (!phoneToSend || !container) {
      setSendingOtp(false);
      return;
    }

    pendingPhoneRef.current = null;
    let cancelled = false;

    (async () => {
      try {
        const verifier = new RecaptchaVerifier(firebaseAuth, container, { size: "invisible" });
        recaptchaVerifierRef.current = verifier;
        if (cancelled) return;

        const result = await signInWithPhoneNumber(
          firebaseAuth,
          toE164(phoneToSend),
          verifier,
        );
        if (cancelled) return;

        confirmationResultRef.current = result;
        setShowOtp(true);
        setOtp("");
        setOtpSecondsLeft(300);
        toast.success("인증번호가 발송되었습니다.");
      } catch (error) {
        if (cancelled) return;
        logError("check-in-request-otp", error);
        toast.error("인증번호 발송에 실패했습니다.");
        autoSentPhoneRef.current = null;
      } finally {
        if (!cancelled) setSendingOtp(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recaptchaKey]);

  useEffect(() => {
    const digits = getDigitsOnly(phone);
    if (!termsAgreed || digits.length < 10 || lockoutSecondsLeft > 0 || sendingOtp || showOtp) {
      return;
    }
    if (autoSentPhoneRef.current === digits) return;

    const timer = setTimeout(() => {
      autoSentPhoneRef.current = digits;
      requestOtp();
    }, 500);

    return () => clearTimeout(timer);
  }, [phone, termsAgreed, lockoutSecondsLeft, sendingOtp, showOtp, requestOtp]);

  const establishSupabaseSession = async (tokenHash?: string) => {
    if (!tokenHash) return null;

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });

    if (error) {
      logError("check-in-verify-otp", error);
      throw new Error("세션 설정에 실패했습니다.");
    }

    return data.session?.user?.id ?? null;
  };

  const autoLoginOrSignup = async (idToken: string) => {
    const loginResult = await sendIdTokenToBackend(idToken, "parent", false);
    if (loginResult.ok) {
      return loginResult.token_hash;
    }

    if (!loginResult.error?.includes("가입된")) {
      throw new Error(loginResult.error ?? "인증 처리에 실패했습니다.");
    }

    const last4 = getDigitsOnly(phone).slice(-4) || "회원";
    const signupResult = await sendIdTokenToBackend(idToken, "parent", true, `학부모${last4}`);
    if (!signupResult.ok) {
      throw new Error(signupResult.error ?? "자동 가입에 실패했습니다.");
    }

    return signupResult.token_hash;
  };

  const handleConfirm = async () => {
    const confirmation = confirmationResultRef.current;
    if (!confirmation) {
      toast.error("인증번호를 먼저 받아주세요.");
      return;
    }
    if (otp.length !== OTP_LENGTH) {
      toast.error("인증번호 6자리를 입력해주세요.");
      return;
    }
    if (!termsAgreed) {
      toast.error("약관에 동의해주세요.");
      return;
    }
    if (lockoutSecondsLeft > 0) {
      toast.error(`${lockoutSecondsLeft}초 후 다시 시도해주세요.`);
      return;
    }

    setSubmitting(true);
    try {
      const userCredential = await confirmation.confirm(otp.trim());
      const idToken = await userCredential.user.getIdToken();
      const tokenHash = await autoLoginOrSignup(idToken);
      await establishSupabaseSession(tokenHash);

      toast.success("본인 확인이 완료되었습니다.");
      navigate(`/p/check-in/${sessionId}/complete`, { replace: true });
    } catch (error: unknown) {
      const nextAttempts = otpAttempts + 1;
      setOtpAttempts(nextAttempts);
      setOtp("");

      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        setLockoutSecondsLeft(LOCKOUT_SECONDS);
        resetOtpState();
        autoSentPhoneRef.current = null;
        toast.error("인증번호 오류가 3회 발생했습니다. 1분 후 다시 시도해주세요.");
        return;
      }

      logError("check-in-confirm-otp", error);
      const message =
        error instanceof Error ? error.message : "인증에 실패했습니다. 다시 시도해주세요.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeLeft = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remain = seconds % 60;
    return `${minutes}:${String(remain).padStart(2, "0")}`;
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session || !sessionId) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/p/check-in")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">본인 확인</p>
            <h1 className="font-semibold text-foreground truncate">
              {formatSeminarHeader(session.academy?.name, session.title, session.date)}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <p className="text-sm text-muted-foreground">휴대폰 번호로 참석을 인증합니다.</p>

        <div key={recaptchaKey} ref={recaptchaContainerRef} className="sr-only" aria-hidden />

        <div className="space-y-2">
          <Label htmlFor="phone">휴대폰 번호</Label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              placeholder="010-0000-0000"
              value={phone}
              onChange={(e) => {
                setPhone(formatPhoneWithDash(e.target.value));
                if (autoSentPhoneRef.current !== getDigitsOnly(e.target.value)) {
                  autoSentPhoneRef.current = null;
                }
              }}
              className="pl-12 h-14 text-lg"
              disabled={lockoutSecondsLeft > 0}
            />
          </div>
        </div>

        {showOtp && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>인증번호</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatTimeLeft(otpSecondsLeft)}
              </span>
            </div>
            <InputOTP
              maxLength={OTP_LENGTH}
              value={otp}
              onChange={setOtp}
              disabled={lockoutSecondsLeft > 0 || submitting}
            >
              <InputOTPGroup className="w-full justify-between">
                {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="h-12 w-12 text-lg rounded-xl"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <button
              type="button"
              className="text-sm text-primary hover:underline disabled:opacity-50"
              disabled={sendingOtp || lockoutSecondsLeft > 0}
              onClick={() => {
                autoSentPhoneRef.current = null;
                resetOtpState();
                requestOtp();
              }}
            >
              인증번호 다시 받기
            </button>
          </div>
        )}

        <div className="flex items-start gap-3">
          <Checkbox
            id="terms"
            checked={termsAgreed}
            onCheckedChange={(checked) => setTermsAgreed(checked === true)}
          />
          <label htmlFor="terms" className="text-sm text-muted-foreground leading-snug cursor-pointer">
            서비스 이용약관 및 개인정보 처리방침에 동의합니다.
          </label>
        </div>

        {lockoutSecondsLeft > 0 && (
          <p className="text-sm text-destructive text-center">
            인증 시도가 제한되었습니다. {lockoutSecondsLeft}초 후 다시 시도해주세요.
          </p>
        )}

        <Button
          className="w-full h-14 text-base"
          size="xl"
          onClick={handleConfirm}
          disabled={submitting || !showOtp || otp.length !== OTP_LENGTH || lockoutSecondsLeft > 0}
        >
          {submitting ? "확인 중..." : "확인"}
        </Button>
      </main>
    </div>
  );
};

export default ParentCheckInVerifyPage;
