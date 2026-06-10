-- BETA: 설명회 참석 인증 → 디지털 쿠폰 발급

ALTER TABLE public.seminars
  ADD COLUMN IF NOT EXISTS coupon_benefit_type text,
  ADD COLUMN IF NOT EXISTS coupon_benefit_label text,
  ADD COLUMN IF NOT EXISTS coupon_discount_value text,
  ADD COLUMN IF NOT EXISTS coupon_valid_days integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS coupon_usage_condition text;

CREATE TABLE public.digital_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seminar_id uuid NOT NULL REFERENCES public.seminars(id) ON DELETE CASCADE,
  academy_id uuid REFERENCES public.academies(id) ON DELETE SET NULL,
  benefit_type text NOT NULL DEFAULT 'custom',
  benefit_label text NOT NULL,
  discount_value text NOT NULL,
  usage_condition text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'used', 'expired')),
  valid_until timestamptz NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, seminar_id)
);

CREATE INDEX digital_coupons_user_id_idx ON public.digital_coupons (user_id);
CREATE INDEX digital_coupons_seminar_id_idx ON public.digital_coupons (seminar_id);
CREATE INDEX digital_coupons_status_idx ON public.digital_coupons (status);

ALTER TABLE public.digital_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own coupons"
ON public.digital_coupons
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Academy owners can view coupons for their seminars"
ON public.digital_coupons
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.seminars s
    JOIN public.academies a ON a.id = s.academy_id
    WHERE s.id = digital_coupons.seminar_id
      AND a.owner_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.issue_seminar_coupon(_seminar_id uuid)
RETURNS public.digital_coupons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_seminar public.seminars%ROWTYPE;
  v_existing public.digital_coupons%ROWTYPE;
  v_valid_days integer;
  v_benefit_type text;
  v_benefit_label text;
  v_discount_value text;
  v_usage_condition text;
  v_coupon public.digital_coupons%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  SELECT * INTO v_seminar
  FROM public.seminars
  WHERE id = _seminar_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '설명회를 찾을 수 없습니다';
  END IF;

  IF v_seminar.status = 'closed' THEN
    RAISE EXCEPTION '종료된 설명회입니다';
  END IF;

  SELECT * INTO v_existing
  FROM public.digital_coupons
  WHERE user_id = v_user_id
    AND seminar_id = _seminar_id;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  v_valid_days := GREATEST(7, LEAST(COALESCE(v_seminar.coupon_valid_days, 30), 90));
  v_benefit_type := COALESCE(NULLIF(TRIM(v_seminar.coupon_benefit_type), ''), 'custom');
  v_benefit_label := COALESCE(NULLIF(TRIM(v_seminar.coupon_benefit_label), ''), '설명회 참석 혜택');
  v_discount_value := COALESCE(NULLIF(TRIM(v_seminar.coupon_discount_value), ''), '혜택 제공');
  v_usage_condition := NULLIF(TRIM(v_seminar.coupon_usage_condition), '');

  INSERT INTO public.digital_coupons (
    user_id,
    seminar_id,
    academy_id,
    benefit_type,
    benefit_label,
    discount_value,
    usage_condition,
    status,
    valid_until
  )
  VALUES (
    v_user_id,
    v_seminar.id,
    v_seminar.academy_id,
    v_benefit_type,
    v_benefit_label,
    v_discount_value,
    v_usage_condition,
    'active',
    now() + make_interval(days => v_valid_days)
  )
  RETURNING * INTO v_coupon;

  RETURN v_coupon;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_seminar_coupon(uuid) TO authenticated;
