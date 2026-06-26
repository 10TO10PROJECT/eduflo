-- AI chat safety constraints added after initial table rollout.

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_session_turn_unique
  ON public.chat_messages(session_id, turn_index);

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_content_blocks_array
  CHECK (jsonb_typeof(content_blocks) = 'array');

ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_profile_tags_array
  CHECK (jsonb_typeof(profile_tags) = 'array');
