SELECT
  id,
  member_id,
  name,
  icon,
  target_minutes,
  target_days
FROM app_practice_log__activities
WHERE archived_at = ''
ORDER BY created_at, id
LIMIT 200
