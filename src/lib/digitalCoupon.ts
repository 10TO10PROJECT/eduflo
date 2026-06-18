import { supabase } from "@/integrations/supabase/client";
import type { DigitalCoupon, DigitalCouponWithAcademy } from "@/types/digitalCoupon";
import type { CouponUseCode } from "@/types/couponUseCode";

export async function issueSeminarCoupons(seminarId: string): Promise<DigitalCoupon[]> {
  const { data, error } = await supabase.rpc("issue_seminar_coupons", {
    _seminar_id: seminarId,
  });

  if (error) throw error;
  return (data ?? []) as DigitalCoupon[];
}

export async function issueSeminarCoupon(seminarId: string): Promise<DigitalCoupon> {
  const coupons = await issueSeminarCoupons(seminarId);
  if (coupons.length === 0) {
    throw new Error("쿠폰 발급에 실패했습니다.");
  }
  return coupons[0];
}

export async function hasUserCouponsForSeminar(seminarId: string, userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("digital_coupons")
    .select("*", { count: "exact", head: true })
    .eq("seminar_id", seminarId)
    .eq("user_id", userId);

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function fetchUserCouponForSeminar(
  seminarId: string,
  userId: string,
): Promise<DigitalCoupon | null> {
  const { data, error } = await supabase
    .from("digital_coupons")
    .select("*")
    .eq("seminar_id", seminarId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as DigitalCoupon | null;
}

export async function fetchUserCoupons(): Promise<DigitalCouponWithAcademy[]> {
  const { data, error } = await supabase
    .from("digital_coupons")
    .select("*, academy:academies(name, profile_image)")
    .order("issued_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DigitalCouponWithAcademy[];
}

export async function fetchCouponById(couponId: string): Promise<DigitalCouponWithAcademy | null> {
  const { data, error } = await supabase
    .from("digital_coupons")
    .select("*, academy:academies(name, profile_image, owner_id)")
    .eq("id", couponId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const coupon = data as DigitalCouponWithAcademy;
  const ownerId = coupon.academy?.owner_id;
  if (ownerId) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", ownerId)
      .maybeSingle();

    if (ownerProfile && coupon.academy) {
      coupon.academy.owner = { phone: ownerProfile.phone };
    }
  }

  return coupon;
}

export function isCouponUsable(coupon: DigitalCoupon) {
  return coupon.status === "active" && !isCouponExpired(coupon);
}

export function formatValidUntil(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
}

export function formatUsedAt(dateString: string) {
  return new Date(dateString).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getCouponDday(dateString: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return null;
  if (diff === 0) return "D-Day";
  return `D-${diff}`;
}

export function isCouponExpired(coupon: DigitalCoupon) {
  if (coupon.status === "expired" || coupon.status === "used") return true;
  return new Date(coupon.valid_until).getTime() < Date.now();
}

export async function issueCouponUseCode(
  couponId: string,
  forceNew = false,
): Promise<CouponUseCode> {
  const { data, error } = await supabase.rpc("issue_coupon_use_code", {
    _coupon_id: couponId,
    _force_new: forceNew,
  });

  if (error) throw error;
  return data as CouponUseCode;
}

export function getSecondsUntilExpiry(expiresAt: string) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

export async function fetchCouponStatus(couponId: string): Promise<DigitalCoupon["status"] | null> {
  const { data, error } = await supabase
    .from("digital_coupons")
    .select("status")
    .eq("id", couponId)
    .maybeSingle();

  if (error) throw error;
  return (data?.status as DigitalCoupon["status"] | undefined) ?? null;
}
