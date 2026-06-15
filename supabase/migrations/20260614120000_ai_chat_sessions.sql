-- AI 챗봇 파이프라인: chat_sessions + chat_messages

CREATE TABLE public.chat_sessions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           TEXT        NOT NULL CHECK (role IN ('parent', 'student')),
  profile_tags   JSONB       NOT NULL DEFAULT '[]',
  surface        TEXT        NOT NULL DEFAULT 'preference_result',
  turn_count     INT         NOT NULL DEFAULT 0,
  total_cost_krw INT         NOT NULL DEFAULT 0,
  status         TEXT        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'completed', 'expired', 'error')),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID        NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  turn_index     INT         NOT NULL,
  role           TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content_blocks JSONB       NOT NULL,
  model_meta     JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user    ON public.chat_sessions(user_id, created_at DESC);
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id, turn_index);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sessions" ON public.chat_sessions
  FOR ALL USING (user_id = auth.uid());

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_messages" ON public.chat_messages
  FOR ALL USING (
    session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid())
  );
