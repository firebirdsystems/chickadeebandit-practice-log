SELECT
  member_id,
  activity_id,
  COUNT(*) AS session_count,
  COALESCE(SUM(minutes), 0) AS logged_minutes,
  COALESCE(SUM(CASE WHEN verified_at <> '' THEN minutes ELSE 0 END), 0) AS verified_minutes
FROM app_practice_log__sessions
WHERE practice_date >= date(:today, 'weekday 0', '-6 days')
GROUP BY member_id, activity_id
ORDER BY member_id, activity_id
LIMIT 200
