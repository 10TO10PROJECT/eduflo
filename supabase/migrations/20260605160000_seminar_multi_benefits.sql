-- 설명회 다중 혜택 발급

CREATE TABLE public.seminar_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seminar_id uuid NOT NULL REFERENCES public.seminars(id) ON DELETE CASCADE,
  benefit_type text NOT NULL DEFAULT 'custom',
  benefit_label text NOT NULL,
  discount_value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX seminar_benefits_seminar_id_idx ON public.seminar_benefits (seminar_id);

ALTER TABLE public.seminar_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view seminar benefits"
ON public.seminar_benefits
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Academy members can manage seminar benefits"
ON public.seminar_benefits
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.seminars s
    WHERE s.id = seminar_benefits.seminar_id
      AND public.can_admin_manage_academy_coupons(auth.uid(), s.academy_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.seminars s
    WHERE s.id = seminar_benefits.seminar_id
      AND public.can_admin_manage_academy_coupons(auth.uid(), s.academy_id)
  )
);

INSERT INTO public.seminar_benefits (seminar_id, benefit_type, benefit_label, discount_value, sort_order)
SELECT
  s.id,
  COALESCE(NULLIF(TRIM(s.coupon_benefit_type), ''), 'custom'),
  COALESCE(NULLIF(TRIM(s.coupon_benefit_label), ''), '설명회 참석 혜택'),
  COALESCE(NULLIF(TRIM(s.coupon_discount_value), ''), '혜택 제공'),
  0
FROM public.seminars s
WHERE NOT EXISTS (
  SELECT 1 FROM public.seminar_benefits sb WHERE sb.seminar_id = s.id
)
AND (
  s.coupon_benefit_label IS NOT NULL
  OR s.coupon_benefit_type IS NOT NULL
  OR s.coupon_discount_value IS NOT NULL
);

ALTER TABLE public.digital_coupons
  ADD COLUMN IF NOT EXISTS seminar_benefit_id uuid REFERENCES public.seminar_benefits(id) ON DELETE CASCADE;

UPDATE public.digital_coupons dc
SET seminar_benefit_id = sb.id
FROM public.seminar_benefits sb
WHERE sb.seminar_id = dc.seminar_id
  AND dc.seminar_benefit_id IS NULL
  AND sb.sort_order = (
    SELECT MIN(sb2.sort_order)
    FROM public.seminar_benefits sb2
    WHERE sb2.seminar_id = dc.seminar_id
  );

ALTER TABLE public.digital_coupons
  DROP CONSTRAINT IF EXISTS digital_coupons_user_id_seminar_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS digital_coupons_user_benefit_uidx
  ON public.digital_coupons (user_id, seminar_benefit_id)
  WHERE seminar_benefit_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.issue_seminar_coupons(_seminar_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_seminar public.seminars%ROWTYPE;
  v_benefit public.seminar_benefits%ROWTYPE;
  v_valid_days integer;
  v_usage_condition text;
  v_coupon public.digital_coupons%ROWTYPE;
  v_coupons json;
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

  v_valid_days := GREATEST(7, LEAST(COALESCE(v_seminar.coupon_valid_days, 30), 90));
  v_usage_condition := NULLIF(TRIM(v_seminar.coupon_usage_condition), '');

  FOR v_benefit IN
    SELECT *
    FROM public.seminar_benefits
    WHERE seminar_id = _seminar_id
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    SELECT * INTO v_coupon
    FROM public.digital_coupons
    WHERE user_id = v_user_id
      AND seminar_benefit_id = v_benefit.id;

    IF NOT FOUND THEN
      INSERT INTO public.digital_coupons (
        user_id,
        seminar_id,
        seminar_benefit_id,
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
        v_benefit.id,
        v_seminar.academy_id,
        v_benefit.benefit_type,
        v_benefit.benefit_label,
        v_benefit.discount_value,
        v_usage_condition,
        'active',
        now() + make_interval(days => v_valid_days)
      )
      RETURNING * INTO v_coupon;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM public.seminar_benefits
    WHERE seminar_id = _seminar_id
  ) THEN
    RAISE EXCEPTION '발급할 혜택이 없습니다';
  END IF;

  SELECT coalesce(json_agg(to_jsonb(dc) ORDER BY dc.created_at), '[]'::json)
  INTO v_coupons
  FROM public.digital_coupons dc
  WHERE dc.user_id = v_user_id
    AND dc.seminar_id = _seminar_id;

  RETURN v_coupons;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_seminar_coupon(_seminar_id uuid)
RETURNS public.digital_coupons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.digital_coupons%ROWTYPE;
BEGIN
  PERFORM public.issue_seminar_coupons(_seminar_id);

  SELECT * INTO v_coupon
  FROM public.digital_coupons
  WHERE user_id = auth.uid()
    AND seminar_id = _seminar_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION '쿠폰 발급에 실패했습니다';
  END IF;

  RETURN v_coupon;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_seminar_coupons(uuid) TO authenticated;
