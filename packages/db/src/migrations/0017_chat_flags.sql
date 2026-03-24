-- Community flagging for chat messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS flag_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS chat_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_flags_unique ON chat_flags (message_id, user_id);
