-- ============================================================
-- Raíz — Breathwork Schema
-- Run in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ── Routine Completions ──────────────────────────────────────
-- Tracks every completed breathwork session with mood data

CREATE TABLE IF NOT EXISTS breath_completions (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_type   TEXT        NOT NULL CHECK (routine_type IN ('morning', 'post_session', 'night')),
  completed_at   TIMESTAMPTZ DEFAULT NOW(),
  mood_before    SMALLINT    CHECK (mood_before    BETWEEN 1 AND 5),
  energy_before  SMALLINT    CHECK (energy_before  BETWEEN 1 AND 5),
  mood_after     SMALLINT    CHECK (mood_after     BETWEEN 1 AND 5),
  energy_after   SMALLINT    CHECK (energy_after   BETWEEN 1 AND 5),
  duration_sec   INTEGER
);

-- ── Row Level Security ───────────────────────────────────────

ALTER TABLE breath_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their completions"
  ON breath_completions FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_breath_completions_user
  ON breath_completions (user_id, routine_type, completed_at DESC);
