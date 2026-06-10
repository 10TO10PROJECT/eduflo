export interface CouponUseCode {
  id: string;
  coupon_id: string;
  user_id: string;
  code: string;
  status: "active" | "used" | "expired" | "invalidated";
  expires_at: string;
  created_at: string;
  used_at: string | null;
}
