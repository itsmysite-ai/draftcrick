-- Live Mini-Predictions system
-- Community-driven predictions during live matches that award fantasy points

-- Add prediction_points column to fantasy_teams
ALTER TABLE fantasy_teams ADD COLUMN IF NOT EXISTS prediction_points DECIMAL(8,2) NOT NULL DEFAULT 0;

-- Live predictions table
CREATE TABLE IF NOT EXISTS live_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id),
  match_id UUID NOT NULL REFERENCES matches(id),
  creator_id UUID NOT NULL REFERENCES users(id),

  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,

  difficulty TEXT NOT NULL DEFAULT 'easy',
  pts_correct INTEGER NOT NULL DEFAULT 5,
  pts_wrong INTEGER NOT NULL DEFAULT -2,

  deadline_type TEXT NOT NULL DEFAULT 'end_of_over',
  deadline_at TIMESTAMPTZ,

  result TEXT,
  ai_explanation TEXT,
  ai_roast TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,

  votes_a INTEGER NOT NULL DEFAULT 0,
  votes_b INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_predictions_contest ON live_predictions(contest_id);
CREATE INDEX IF NOT EXISTS idx_live_predictions_match ON live_predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_live_predictions_status ON live_predictions(status);

-- Live prediction votes table
CREATE TABLE IF NOT EXISTS live_prediction_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES live_predictions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  picked_option TEXT NOT NULL,
  points_awarded INTEGER,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prediction_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_prediction_votes_prediction ON live_prediction_votes(prediction_id);
