-- ============================================================
-- Life Journal — Supabase Schema
-- Run in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ── Journal Entries ─────────────────────────────────────────
-- sections: thoughts, relationships, ideas

CREATE TABLE IF NOT EXISTS journal_entries (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section    TEXT        NOT NULL CHECK (section IN ('thoughts', 'relationships', 'ideas')),
  content    TEXT        NOT NULL,
  tags       TEXT[]      DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── To-Do Items ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_todos (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  notes          TEXT,
  deadline       TIMESTAMPTZ,
  is_recurring   BOOLEAN     DEFAULT FALSE,
  recur_interval TEXT        CHECK (recur_interval IN ('daily', 'weekly', 'monthly', 'yearly')),
  is_done        BOOLEAN     DEFAULT FALSE,
  done_at        TIMESTAMPTZ,
  tags           TEXT[]      DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ───────────────────────────────────────

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_todos   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their entries"
  ON journal_entries FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own their todos"
  ON journal_todos FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_entries_user_section
  ON journal_entries (user_id, section, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_todos_user
  ON journal_todos (user_id, is_done, deadline ASC NULLS LAST);

-- ── Auto updated_at trigger ───────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER todos_updated_at
  BEFORE UPDATE ON journal_todos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
