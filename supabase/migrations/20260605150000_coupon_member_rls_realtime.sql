-- BETA: 학원 멤버 쿠폰 조회 RLS + P-06 Realtime 구독

DROP POLICY IF EXISTS "Academy members can view coupons for their seminars" ON public.digital_coupons;

CREATE POLICY "Academy members can view coupons for their seminars"
ON public.digital_coupons
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.seminars s
    WHERE s.id = digital_coupons.seminar_id
      AND public.can_admin_manage_academy_coupons(auth.uid(), s.academy_id)
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.digital_coupons;