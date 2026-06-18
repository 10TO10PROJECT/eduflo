export type DigitalCouponStatus = "active" | "used" | "expired";

export interface DigitalCoupon {
  id: string;
  user_id: string;
  seminar_id: string;
  academy_id: string | null;
  benefit_type: string;
  benefit_label: string;
  discount_value: string;
  usage_condition: string | null;
  status: DigitalCouponStatus;
  valid_until: string;
  issued_at: string;
  used_at: string | null;
  enrolled_at: string | null;
  seminar_benefit_id: string | null;
  created_at: string;
}

export interface DigitalCouponWithAcademy extends DigitalCoupon {
  academy?: {
    name: string;
    profile_image: string | null;
    owner_id?: string | null;
    owner?: {
      phone: string | null;
    } | null;
  } | null;
}
