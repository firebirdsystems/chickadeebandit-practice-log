-- What a member practises, and the goal a parent set for it. Adults create and
-- edit these; a child reads only their own (see `activities` in manifest.json).
-- target_minutes is the daily goal and target_days is how many days a week it
-- should be met. archived_at is '' while the activity is in use.
CREATE TABLE IF NOT EXISTS app_practice_log__activities (
  id             TEXT PRIMARY KEY,
  member_id      TEXT NOT NULL,
  name           TEXT NOT NULL,
  icon           TEXT NOT NULL DEFAULT '🎵',
  target_minutes INTEGER NOT NULL DEFAULT 20,
  target_days    INTEGER NOT NULL DEFAULT 5,
  archived_at    TEXT NOT NULL DEFAULT '',
  created_by     TEXT NOT NULL,
  created_at     TEXT NOT NULL
);

-- Serves the first-render read: WHERE archived_at = '' ORDER BY created_at, id.
CREATE INDEX IF NOT EXISTS app_practice_log__activities_active_idx
  ON app_practice_log__activities (archived_at, created_at, id);

-- One practice session. The member who practised owns the row and may only
-- insert it; changing it afterwards, and filling verified_by / verified_at, is
-- for adults (see `sessions` in manifest.json). practice_date is the household-
-- local day as yyyy-mm-dd. source is 'timer' or 'manual'.
CREATE TABLE IF NOT EXISTS app_practice_log__sessions (
  id            TEXT PRIMARY KEY,
  activity_id   TEXT NOT NULL,
  member_id     TEXT NOT NULL,
  practice_date TEXT NOT NULL,
  minutes       INTEGER NOT NULL,
  source        TEXT NOT NULL DEFAULT 'manual',
  note          TEXT NOT NULL DEFAULT '',
  verified_by   TEXT NOT NULL DEFAULT '',
  verified_at   TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);

-- Serves the first-render read and the glance: a recent window, newest first.
CREATE INDEX IF NOT EXISTS app_practice_log__sessions_recent_idx
  ON app_practice_log__sessions (practice_date DESC, created_at DESC);

-- Serves a child's own reads, where the row policy adds member_id = caller.
CREATE INDEX IF NOT EXISTS app_practice_log__sessions_member_idx
  ON app_practice_log__sessions (member_id, practice_date DESC);

-- Serves the cascade when an activity is deleted.
CREATE INDEX IF NOT EXISTS app_practice_log__sessions_activity_idx
  ON app_practice_log__sessions (activity_id);

-- A running timer: at most one per member, so a timer started on one device
-- can be stopped on another. Stopping it inserts a session and deletes the row.
CREATE TABLE IF NOT EXISTS app_practice_log__timers (
  member_id   TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  started_at  TEXT NOT NULL
);
