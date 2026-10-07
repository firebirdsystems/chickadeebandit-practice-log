-- The most recent day an activity was practised, as yyyy-mm-dd, or '' when it
-- never has been. The Today view reads one table, and "practised today" is a
-- fact about sessions, so the hub recomputes this column in the same
-- transaction as every session insert (see `write_effects` in manifest.json).
-- An adult who edits or removes a session sets it again from what remains.
-- A child cannot write it.
ALTER TABLE app_practice_log__activities ADD COLUMN last_practice_date TEXT NOT NULL DEFAULT '';
