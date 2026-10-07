SELECT
  id,
  member_id,
  activity_id,
  practice_date,
  minutes,
  source,
  note,
  (verified_at <> '') AS verified
FROM app_practice_log__sessions
WHERE practice_date >= date(:today, '-35 days')
ORDER BY practice_date DESC, created_at DESC
LIMIT 200
