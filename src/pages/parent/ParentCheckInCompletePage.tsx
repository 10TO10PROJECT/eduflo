import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  formatValidUntil,
  getCouponDday,
  issueSeminarCoupons,
} from "@/lib/digitalCoupon";
import { logError } from "@/lib/errorLogger";
import type { DigitalCoupon } from "@/types/digitalCoupon";

interface CouponView extends DigitalCoupon {
  academy?: {
    name: string;
    profile_image: string | null;
  } | null;
}

const ParentCheckInCompletePage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [coupons, setCoupons] = useState<CouponView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      navigate("/p/check-in", { replace: true });
      return;
    }

    const issueCoupons = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          navigate(`/p/check-in/${sessionId}/verify`, { replace: true });
          return;
        }

        const issued = await issueSeminarCoupons(sessionId);
        const couponIds = issued.map((coupon) => coupon.id);
        const { data: enriched, error } = await supabase
          .from("digital_coupons")
          .select("*, academy:academies(name, profile_image)")
          .in("id", couponIds)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setCoupons((enriched ?? issued) as CouponView[]);
        requestAnimationFrame(() => setShowSuccess(true));
      } catch (error) {
        logError("check-in-issue-coupon", error);
        toast.error("쿠폰 발급에 실패했습니다. 다시 시도해주세요.");
        navigate(`/p/check-in/${sessionId}/verify`, { replace: true });
      } finally {
        setLoading(false);
      }
    };

    issueCoupons();
  }, [navigate, sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (coupons.length === 0) return null;

  const primaryCoupon = coupons[0];
  const validUntilLabel = formatValidUntil(primaryCoupon.valid_until);
  const dDay = getCouponDday(primaryCoupon.valid_until);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10 flex flex-col items-center justify-center">
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
          className={`w-full space-y-6 transition-all duration-700 delay-150 ${
            showSuccess ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 text-primary text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              쿠폰 {coupons.length}개가 발급되었습니다
            </div>
            <p className="text-xs text-muted-foreground">{validUntilLabel}까지 사용 가능</p>
          </div>

          <div className="space-y-3">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="gradient-primary rounded-3xl p-6 shadow-soft text-primary-foreground animate-fade-up"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {coupon.academy?.profile_image ? (
                      <img
                        src={coupon.academy.profile_image}
                        alt={coupon.academy.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="w-6 h-6" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-primary-foreground/85">혜택 쿠폰</p>
                    <p className="font-semibold truncate">{coupon.academy?.name ?? "학원"}</p>
                  </div>
                  {coupons.length === 1 && dDay && (
                    <span className="ml-auto text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full">
                      {dDay}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-lg font-bold leading-tight">{coupon.benefit_label}</p>
                  <p className="text-3xl font-extrabold tracking-tight">{coupon.discount_value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className="sticky bottom-0 bg-card/95 backdrop-blur-lg border-t border-border p-4">
        <div className="max-w-lg mx-auto">
          <Button
            className="w-full h-14 text-base font-semibold"
            size="xl"
            onClick={() => navigate("/p/coupons", { replace: true })}
          >
            내 쿠폰함으로
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ParentCheckInCompletePage;
