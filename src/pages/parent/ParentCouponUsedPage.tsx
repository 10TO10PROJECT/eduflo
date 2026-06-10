import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fetchCouponById, formatUsedAt } from "@/lib/digitalCoupon";
import { logError } from "@/lib/errorLogger";
import type { DigitalCouponWithAcademy } from "@/types/digitalCoupon";

const ParentCouponUsedPage = () => {
  const { couponId } = useParams<{ couponId: string }>();
  const navigate = useNavigate();

  const [coupon, setCoupon] = useState<DigitalCouponWithAcademy | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!couponId) {
      navigate("/p/coupons", { replace: true });
      return;
    }

    fetchCouponById(couponId)
      .then((data) => {
        if (!data || data.status !== "used") {
          toast.error("사용 완료된 쿠폰을 찾을 수 없습니다.");
          navigate("/p/coupons", { replace: true });
          return;
        }
        setCoupon(data);
        requestAnimationFrame(() => setShowSuccess(true));
      })
      .catch((error) => {
        logError("fetch-used-coupon", error);
        toast.error("쿠폰 정보를 불러올 수 없습니다.");
        navigate("/p/coupons", { replace: true });
      })
      .finally(() => setLoading(false));
  }, [couponId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!coupon) return null;

  const usedAtLabel = coupon.used_at ? formatUsedAt(coupon.used_at) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 max-w-lg mx-auto w-full px-4 flex flex-col items-center justify-center text-center">
        <div
          className={`mb-8 transition-all duration-700 ${
            showSuccess ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
            <CheckCircle2 className="relative w-20 h-20 text-primary animate-scale-in" />
          </div>
        </div>

        <div
          className={`space-y-3 transition-all duration-700 delay-150 ${
            showSuccess ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h1 className="text-2xl font-bold text-foreground">사용 완료</h1>
          <p className="text-sm text-foreground">
            <span className="font-semibold">{coupon.academy?.name ?? "학원"}</span>
            {usedAtLabel && (
              <>
                <br />
                <span className="text-muted-foreground">{usedAtLabel}</span>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground pt-2">문의가 있다면 학원에 연락하세요.</p>
        </div>
      </main>

      <div className="sticky bottom-0 bg-card/95 backdrop-blur-lg border-t border-border p-4">
        <div className="max-w-lg mx-auto">
          <Button
            className="w-full h-14 text-base font-semibold"
            size="xl"
            onClick={() => navigate("/p/coupons", { replace: true })}
          >
            쿠폰함으로
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ParentCouponUsedPage;
