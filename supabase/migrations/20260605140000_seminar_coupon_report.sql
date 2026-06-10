-- A-05: 사후 리포트 — 등록 전환 추적 + 리포트 RPC

ALTER TABLE public.digital_coupons
  ADD COLUMN IF NOT EXISTS enrolled_at timestamptz;

CREATE INDEX IF NOT EXISTS digital_coupons_enrolled_at_idx
  ON public.digital_coupons (seminar_id, enrolled_at)
  WHERE enrolled_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_seminar_coupon_report(_seminar_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_seminar public.seminars%ROWTYPE;
  v_issued integer;
  v_used integer;
  v_expired integer;
  v_enrolled integer;
  v_conversion numeric;
  v_rows json;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  SELECT * INTO v_seminar
  FROM public.seminars
  WHERE id = _seminar_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '설명회를 찾을 수 없습니다';
  END IF;

  IF NOT public.can_admin_manage_academy_coupons(v_admin_id, v_seminar.academy_id) THEN
    RAISE EXCEPTION '권한이 없습니다';
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE dc.status = 'used')::integer,
    count(*) FILTER (
      WHERE dc.status = 'expired'
        OR (dc.status = 'active' AND dc.valid_until <= now())
    )::integer,
    count(*) FILTER (WHERE dc.enrolled_at IS NOT NULL)::integer
  INTO v_issued, v_used, v_expired, v_enrolled
  FROM public.digital_coupons dc
  WHERE dc.seminar_id = _seminar_id;

  v_conversion := CASE
    WHEN v_issued > 0 THEN round(v_enrolled * 100.0 / v_issued, 1)
    ELSE 0
  END;

  SELECT coalesce(json_agg(row_data ORDER BY issued_at DESC), '[]'::json)
  INTO v_rows
  FROM (
    SELECT
      json_build_object(
        'coupon_id', dc.id,
        'parent_name_masked', public.mask_parent_name(p.user_name),
        'phone_suffix', CASE
          WHEN length(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')) >= 4
          THEN right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 4)
          ELSE '****'
        END,
        'issued_at', dc.issued_at,
        'status', dc.status,
        'used_at', dc.used_at,
        'enrolled_at', dc.enrolled_at,
        'is_expired', (
          dc.status = 'expired'
          OR (dc.status = 'active' AND dc.valid_until <= now())
        )
      ) AS row_data,
      dc.issued_at
    FROM public.digital_coupons dc
    JOIN public.profiles p ON p.id = dc.user_id
    WHERE dc.seminar_id = _seminar_id
  ) sub;

  RETURN json_build_object(
    'seminar_title', v_seminar.title,
    'seminar_date', v_seminar.date,
    'summary', json_build_object(
      'issued', v_issued,
      'used', v_used,
      'expired', v_expired,
      'enrolled', v_enrolled,
      'conversion_rate', v_conversion
    ),
    'rows', v_rows
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_coupon_enrolled(
  _coupon_id uuid,
  _seminar_id uuid
)
RETURNS public.digital_coupons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_seminar public.seminars%ROWTYPE;
  v_coupon public.digital_coupons%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  SELECT * INTO v_seminar
  FROM public.seminars
  WHERE id = _seminar_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '설명회를 찾을 수 없습니다';
  END IF;

  IF NOT public.can_admin_manage_academy_coupons(v_admin_id, v_seminar.academy_id) THEN
    RAISE EXCEPTION '권한이 없습니다';
  END IF;

  SELECT * INTO v_coupon
  FROM public.digital_coupons
  WHERE id = _coupon_id
    AND seminar_id = _seminar_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '쿠폰을 찾을 수 없습니다';
  END IF;

  UPDATE public.digital_coupons
  SET enrolled_at = coalesce(enrolled_at, now())
  WHERE id = _coupon_id
  RETURNING * INTO v_coupon;

  RETURN v_coupon;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_seminar_coupon_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_coupon_enrolled(uuid, uuid) TO authenticated;
