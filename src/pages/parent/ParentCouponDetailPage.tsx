import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Phone } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchCouponById,
  formatValidUntil,
  getCouponDday,
  isCouponUsable,
} from "@/lib/digitalCoupon";
import { logError } from "@/lib/errorLogger";
import type { DigitalCouponWithAcademy } from "@/types/digitalCoupon";

const ParentCouponDetailPage = () => {
  const { couponId } = useParams<{ couponId: string }>();
  const navigate = useNavigate();

  const [coupon, setCoupon] = useState<DigitalCouponWithAcademy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!couponId) {
      navigate("/p/coupons", { replace: true });
      return;
    }

    fetchCouponById(couponId)
      .then((data) => {
        if (!data) {
          toast.error("쿠폰을 찾을 수 없습니다.");
          navigate("/p/coupons", { replace: true });
          return;
        }
        setCoupon(data);
      })
      .catch((error) => {
        logError("fetch-coupon-detail", error);
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

  const usable = isCouponUsable(coupon);
  const dDay = getCouponDday(coupon.valid_until);
  const validUntilLabel = formatValidUntil(coupon.valid_until);
  const academyPhone = coupon.academy?.owner?.phone?.trim() || null;
  const statusLabel =
    coupon.status === "used" ? "사용 완료" : usable ? null : "만료됨";

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/p/coupons")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-foreground">쿠폰 상세</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="gradient-primary rounded-3xl p-6 shadow-soft text-primary-foreground">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center overflow-hidden flex-shrink-0">
              {coupon.academy?.profile_image ? (
                <img
                  src={coupon.academy.profile_image}
                  alt={coupon.academy.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="w-7 h-7" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-primary-foreground/85">혜택 쿠폰</p>
              <p className="font-semibold truncate">{coupon.academy?.name ?? "학원"}</p>
            </div>
            {statusLabel ? (
              <Badge className="bg-white/20 text-primary-foreground border-0">{statusLabel}</Badge>
            ) : dDay ? (
              <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full">{dDay}</span>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-xl font-bold leading-tight">{coupon.benefit_label}</p>
            <p className="text-4xl font-extrabold tracking-tight">{coupon.discount_value}</p>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">사용 조건</h2>
          <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap line-clamp-3">
              {coupon.usage_condition?.trim() || "학원 등록 시 사용 가능합니다."}
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">유효기간</h2>
          <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
            <p className="text-sm text-foreground">{validUntilLabel}까지</p>
          </div>
        </section>

        {academyPhone && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">학원 문의</h2>
            <a
              href={`tel:${academyPhone.replace(/\D/g, "")}`}
              className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 shadow-card text-foreground"
            >
              <Phone className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">{academyPhone}</span>
            </a>
          </section>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border p-4 z-50">
        <div className="max-w-lg mx-auto">
          <Button
            className="w-full h-14 text-base font-semibold"
            size="xl"
            disabled={!usable}
            onClick={() => navigate(`/p/coupons/${coupon.id}/use`)}
          >
            {statusLabel ?? "사용하기"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ParentCouponDetailPage;
