-- Chat messages for Buzz feature (ephemeral, auto-purged after 24h)
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'user',
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_match_created ON chat_messages (match_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages (created_at);
