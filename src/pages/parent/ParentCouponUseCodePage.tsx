import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import {
  fetchCouponById,
  fetchCouponStatus,
  formatCountdown,
  getSecondsUntilExpiry,
  isCouponUsable,
  issueCouponUseCode,
} from "@/lib/digitalCoupon";
import { logError } from "@/lib/errorLogger";
import { supabase } from "@/integrations/supabase/client";
import type { CouponUseCode } from "@/types/couponUseCode";

const ParentCouponUseCodePage = () => {
  const { couponId } = useParams<{ couponId: string }>();
  const navigate = useNavigate();

  const [useCode, setUseCode] = useState<CouponUseCode | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reissuing, setReissuing] = useState(false);
  const [academyName, setAcademyName] = useState("학원");
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const isExpired = secondsLeft <= 0;

  const loadCode = useCallback(
    async (forceNew = false) => {
      if (!couponId) return;

      const coupon = await fetchCouponById(couponId);
      if (!coupon || !isCouponUsable(coupon)) {
        toast.error("사용할 수 없는 쿠폰입니다.");
        navigate(`/p/coupons/${couponId}`, { replace: true });
        return;
      }

      setAcademyName(coupon.academy?.name ?? "학원");
      const issued = await issueCouponUseCode(couponId, forceNew);
      setUseCode(issued);
      setSecondsLeft(getSecondsUntilExpiry(issued.expires_at));
    },
    [couponId, navigate],
  );

  useEffect(() => {
    if (!couponId) {
      navigate("/p/coupons", { replace: true });
      return;
    }

    loadCode()
      .catch((error) => {
        logError("issue-coupon-use-code", error);
        toast.error("사용 코드 발급에 실패했습니다.");
        navigate(`/p/coupons/${couponId}`, { replace: true });
      })
      .finally(() => setLoading(false));
  }, [couponId, loadCode, navigate]);

  useEffect(() => {
    if (!useCode || isExpired) return;

    const timer = setInterval(() => {
      setSecondsLeft(getSecondsUntilExpiry(useCode.expires_at));
    }, 1000);

    return () => clearInterval(timer);
  }, [useCode, isExpired]);

  useEffect(() => {
    if (!couponId) return;

    const goToComplete = () => {
      navigate(`/p/coupons/${couponId}/complete`, { replace: true });
    };

    const channel = supabase
      .channel(`coupon-status:${couponId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "digital_coupons",
          filter: `id=eq.${couponId}`,
        },
        (payload) => {
          const updated = payload.new as { status?: string };
          if (updated.status === "used") {
            goToComplete();
          }
        },
      )
      .subscribe();

    const fallbackPoll = setInterval(async () => {
      try {
        const status = await fetchCouponStatus(couponId);
        if (status === "used") {
          goToComplete();
        }
      } catch {
        // 폴링 실패는 무시
      }
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(fallbackPoll);
    };
  }, [couponId, navigate]);

  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    navigator.wakeLock
      .request("screen")
      .then((lock) => {
        wakeLockRef.current = lock;
      })
      .catch(() => {});

    return () => {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, []);

  const handleReissue = async () => {
    if (!couponId || reissuing) return;

    setReissuing(true);
    try {
      await loadCode(true);
      toast.success("새 사용 코드가 발급되었습니다.");
    } catch (error) {
      logError("reissue-coupon-use-code", error);
      toast.error("코드 재발급에 실패했습니다.");
    } finally {
      setReissuing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!useCode) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10 flex flex-col items-center justify-center text-center">
        <p className="text-sm text-muted-foreground mb-2">{academyName}</p>
        <h1 className="text-lg font-semibold text-foreground mb-10">학원에 코드를 보여주세요</h1>

        <div
          className={`w-full rounded-3xl border px-6 py-10 mb-8 transition-opacity ${
            isExpired ? "opacity-40 border-border bg-muted" : "border-primary/30 bg-card shadow-soft"
          }`}
        >
          <p
            className="font-mono text-5xl sm:text-6xl font-extrabold tracking-[0.35em] text-foreground tabular-nums"
            aria-label={`사용 코드 ${useCode.code.split("").join(" ")}`}
          >
            {useCode.code}
          </p>
        </div>

        <p
          className={`text-2xl font-bold tabular-nums mb-3 ${
            isExpired ? "text-muted-foreground" : "text-primary"
          }`}
        >
          {formatCountdown(secondsLeft)}
        </p>

        <p className="text-sm text-muted-foreground">
          {isExpired
            ? "코드가 만료되었습니다. 새 코드를 발급해주세요."
            : "5분간 유효합니다."}
        </p>
      </main>

      <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
        {isExpired ? (
          <button
            type="button"
            onClick={handleReissue}
            disabled={reissuing}
            className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
          >
            {reissuing ? "발급 중..." : "새로 발급"}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">코드 입력이 완료되면 자동으로 이동합니다.</p>
        )}
      </div>
    </div>
  );
};

export default ParentCouponUseCodePage;
