import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Camera } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchUserCoupons,
  getCouponDday,
  isCouponExpired,
} from "@/lib/digitalCoupon";
import { logError } from "@/lib/errorLogger";
import type { DigitalCouponWithAcademy } from "@/types/digitalCoupon";

const ParentCouponsPage = () => {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<DigitalCouponWithAcademy[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth?redirect=/p/coupons", { replace: true });
        return;
      }
      setAuthChecked(true);
    });
  }, [navigate]);

  useEffect(() => {
    if (!authChecked) return;

    fetchUserCoupons()
      .then(setCoupons)
      .catch((error) => {
        logError("fetch-user-coupons", error);
        toast.error("쿠폰함을 불러올 수 없습니다.");
      })
      .finally(() => setLoading(false));
  }, [authChecked]);

  const { activeCoupons, expiredCoupons } = useMemo(() => {
    const active: DigitalCouponWithAcademy[] = [];
    const expired: DigitalCouponWithAcademy[] = [];

    coupons.forEach((coupon) => {
      if (isCouponExpired(coupon)) {
        expired.push(coupon);
      } else {
        active.push(coupon);
      }
    });

    return { activeCoupons: active, expiredCoupons: expired };
  }, [coupons]);

  const renderCouponList = (
    items: DigitalCouponWithAcademy[],
    emptyMessage: string,
    showScanLink: boolean,
  ) => {
    if (loading) {
      return (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          {showScanLink && <Camera className="w-12 h-12 text-muted-foreground mb-4" />}
          <p className="text-sm text-muted-foreground mb-6">{emptyMessage}</p>
          {showScanLink && (
            <Button variant="link" onClick={() => navigate("/p/check-in")}>
              설명회 QR 스캔하기
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3 py-4">
        {items.map((coupon) => {
          const dDay = getCouponDday(coupon.valid_until);
          return (
            <button
              key={coupon.id}
              type="button"
              onClick={() => navigate(`/p/coupons/${coupon.id}`)}
              className="w-full text-left bg-card border border-border rounded-2xl p-4 shadow-card hover:shadow-soft transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                  {coupon.academy?.profile_image ? (
                    <img
                      src={coupon.academy.profile_image}
                      alt={coupon.academy.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">
                    {coupon.academy?.name ?? "학원"}
                  </p>
                  <p className="font-semibold text-foreground truncate">{coupon.benefit_label}</p>
                  <p className="text-sm text-primary font-bold">{coupon.discount_value}</p>
                </div>
                {dDay && (
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
                    {dDay}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <h1 className="font-semibold text-foreground">쿠폰함</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4">
        <Tabs defaultValue="active">
          <TabsList className="grid w-full grid-cols-2 mt-4">
            <TabsTrigger value="active">사용 가능</TabsTrigger>
            <TabsTrigger value="expired">만료</TabsTrigger>
          </TabsList>
          <TabsContent value="active">
            {renderCouponList(activeCoupons, "아직 발급된 쿠폰이 없습니다.", true)}
          </TabsContent>
          <TabsContent value="expired">
            {renderCouponList(expiredCoupons, "만료된 쿠폰이 없습니다.", false)}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ParentCouponsPage;
