-- BETA: 쿠폰 6자리 사용 코드 (TTL 5분)

CREATE TABLE public.coupon_use_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.digital_coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'used', 'expired', 'invalidated')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX coupon_use_codes_coupon_id_idx ON public.coupon_use_codes (coupon_id);
CREATE INDEX coupon_use_codes_user_id_idx ON public.coupon_use_codes (user_id);
CREATE UNIQUE INDEX coupon_use_codes_code_active_idx
  ON public.coupon_use_codes (code)
  WHERE status = 'active';

ALTER TABLE public.coupon_use_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own use codes"
ON public.coupon_use_codes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.generate_coupon_use_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_coupon_use_code(
  _coupon_id uuid,
  _force_new boolean DEFAULT false
)
RETURNS public.coupon_use_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_coupon public.digital_coupons%ROWTYPE;
  v_existing public.coupon_use_codes%ROWTYPE;
  v_new_code text;
  v_attempt integer;
  v_row public.coupon_use_codes%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  SELECT * INTO v_coupon
  FROM public.digital_coupons
  WHERE id = _coupon_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '쿠폰을 찾을 수 없습니다';
  END IF;

  IF v_coupon.status <> 'active' OR v_coupon.valid_until <= now() THEN
    RAISE EXCEPTION '사용할 수 없는 쿠폰입니다';
  END IF;

  UPDATE public.coupon_use_codes
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at <= now();

  IF NOT _force_new THEN
    SELECT * INTO v_existing
    FROM public.coupon_use_codes
    WHERE coupon_id = _coupon_id
      AND user_id = v_user_id
      AND status = 'active'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  UPDATE public.coupon_use_codes
  SET status = 'invalidated'
  WHERE user_id = v_user_id
    AND status = 'active';

  v_attempt := 0;
  LOOP
    v_attempt := v_attempt + 1;
    v_new_code := public.generate_coupon_use_code();

    BEGIN
      INSERT INTO public.coupon_use_codes (
        coupon_id,
        user_id,
        code,
        status,
        expires_at
      )
      VALUES (
        _coupon_id,
        v_user_id,
        v_new_code,
        'active',
        now() + interval '5 minutes'
      )
      RETURNING * INTO v_row;

      RETURN v_row;
    EXCEPTION
      WHEN unique_violation THEN
        IF v_attempt >= 10 THEN
          RAISE EXCEPTION '코드 생성에 실패했습니다';
        END IF;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_coupon_use_code(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_coupon_use_code(_code text)
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.academies a
    WHERE a.id = v_coupon.academy_id
      AND a.owner_id = v_admin_id
  ) THEN
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

GRANT EXECUTE ON FUNCTION public.redeem_coupon_use_code(text) TO authenticated;
