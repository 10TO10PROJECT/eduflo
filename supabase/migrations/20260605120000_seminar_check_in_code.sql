-- 설명회 세션 코드 (QR 대체 직접 입력용, A-02 연동)

ALTER TABLE public.seminars
  ADD COLUMN IF NOT EXISTS check_in_code text;

CREATE UNIQUE INDEX IF NOT EXISTS seminars_check_in_code_unique_idx
  ON public.seminars (check_in_code)
  WHERE check_in_code IS NOT NULL;