-- A-04: 쿠폰 사용 코드 미리보기 + 학원 멤버 사용 처리 권한

CREATE OR REPLACE FUNCTION public.can_admin_manage_academy_coupons(
  _admin_id uuid,
  _academy_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.academies a
      WHERE a.id = _academy_id
        AND a.owner_id = _admin_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.academy_members m
      WHERE m.academy_id = _academy_id
        AND m.user_id = _admin_id
        AND m.status = 'approved'
    );
$$;

CREATE OR REPLACE FUNCTION public.mask_parent_name(_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  trimmed text := trim(coalesce(_name, ''));
BEGIN
  IF length(trimmed) = 0 THEN
    RETURN '학부모';
  ELSIF length(trimmed) = 1 THEN
    RETURN trimmed || '*';
  ELSIF length(trimmed) = 2 THEN
    RETURN substring(trimmed, 1, 1) || '*';
  ELSE
    RETURN substring(trimmed, 1, 1) || repeat('*', length(trimmed) - 2) || substring(trimmed, length(trimmed), 1);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_coupon_use_code(
  _code text,
  _seminar_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_normalized_code text := upper(trim(_code));
  v_code_row public.coupon_use_codes%ROWTYPE;
  v_coupon public.digital_coupons%ROWTYPE;
  v_parent_name text;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  IF _seminar_id IS NULL THEN
    RAISE EXCEPTION '설명회 정보가 필요합니다';
  END IF;

  IF length(v_normalized_code) <> 6 THEN
    RAISE EXCEPTION '유효하지 않은 코드입니다';
  END IF;

  UPDATE public.coupon_use_codes
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at <= now();

  SELECT * INTO v_code_row
  FROM public.coupon_use_codes
  WHERE code = v_normalized_code
    AND status = 'active'
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 코드입니다';
  END IF;

  SELECT * INTO v_coupon
  FROM public.digital_coupons
  WHERE id = v_code_row.coupon_id;

  IF NOT FOUND OR v_coupon.status <> 'active' THEN
    RAISE EXCEPTION '사용할 수 없는 쿠폰입니다';
  END IF;

  IF v_coupon.seminar_id <> _seminar_id THEN
    RAISE EXCEPTION '이 설명회의 코드가 아닙니다';
  END IF;

  IF NOT public.can_admin_manage_academy_coupons(v_admin_id, v_coupon.academy_id) THEN
    RAISE EXCEPTION '쿠폰 사용 권한이 없습니다';
  END IF;

  SELECT p.user_name INTO v_parent_name
  FROM public.profiles p
  WHERE p.id = v_coupon.user_id;

  RETURN json_build_object(
    'code', v_code_row.code,
    'parent_name_masked', public.mask_parent_name(v_parent_name),
    'benefit_label', v_coupon.benefit_label,
    'discount_value', v_coupon.discount_value,
    'valid_until', v_coupon.valid_until
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_coupon_use_code(
  _code text,
  _seminar_id uuid DEFAULT NULL
)
RETURNS public.digital_coupons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_normalized_code text := upper(trim(_code));
  v_code_row public.coupon_use_codes%ROWTYPE;
  v_coupon public.digital_coupons%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  IF length(v_normalized_code) <> 6 THEN
    RAISE EXCEPTION '유효하지 않은 코드입니다';
  END IF;

  UPDATE public.coupon_use_codes
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at <= now();

  SELECT * INTO v_code_row
  FROM public.coupon_use_codes
  WHERE code = v_normalized_code
    AND status = 'active'
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 코드입니다';
  END IF;

  SELECT * INTO v_coupon
  FROM public.digital_coupons
  WHERE id = v_code_row.coupon_id
  FOR UPDATE;

  IF NOT FOUND OR v_coupon.status <> 'active' THEN
    RAISE EXCEPTION '사용할 수 없는 쿠폰입니다';
  END IF;

  IF _seminar_id IS NOT NULL AND v_coupon.seminar_id <> _seminar_id THEN
    RAISE EXCEPTION '이 설명회의 코드가 아닙니다';
  END IF;

  IF NOT public.can_admin_manage_academy_coupons(v_admin_id, v_coupon.academy_id) THEN
    RAISE EXCEPTION '쿠폰 사용 권한이 없습니다';
  END IF;

  UPDATE public.coupon_use_codes
  SET status = 'used', used_at = now()
  WHERE id = v_code_row.id;

  UPDATE public.digital_coupons
  SET status = 'used', used_at = now()
  WHERE id = v_coupon.id
  RETURNING * INTO v_coupon;

  RETURN v_coupon;
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_coupon_use_code(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon_use_code(text, uuid) TO authenticated;
