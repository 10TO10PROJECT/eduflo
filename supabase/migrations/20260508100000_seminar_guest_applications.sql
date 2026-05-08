-- 비로그인(anon) 사용자도 모집 중인 설명회에 신청할 수 있도록 허용
ALTER TABLE public.seminar_applications
ALTER COLUMN user_id DROP NOT NULL;

CREATE POLICY "Guests can insert seminar applications"
ON public.seminar_applications
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.seminars s
    WHERE s.id = seminar_applications.seminar_id
    AND s.status = 'recruiting'
  )
);
