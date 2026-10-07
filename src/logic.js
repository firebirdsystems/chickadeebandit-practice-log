// Pure, testable logic extracted from index.html.
// No DOM, no network — safe to import from Node for unit tests.

import { isAdult } from "./shared.js";
export { isAdult };

export const MAX_MINUTES = 600;
export const DEFAULT_ICON = "🎵";
export const ICON_CHOICES = ["🎹", "🎻", "🎸", "🥁", "🎺", "🎤", "🗣️", "📖", "✏️", "🏀", "⚽", "🩰", "♟️", "🎨", "🎵"];

// ── Dates ────────────────────────────────────────────────────────────────────
// Every date here is a household-local "yyyy-mm-dd" string. The arithmetic runs
// on UTC parts only so that the device's own zone can never shift a day.

function parts(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? ""));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function isDate(dateStr) {
  const p = parts(dateStr);
  if (!p) return false;
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}

export function addDays(dateStr, n) {
  const p = parts(dateStr);
  if (!p) return "";
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

/** The Monday of the week `dateStr` falls in. Matches the named SQL's
 *  `date(:today, 'weekday 0', '-6 days')`. */
export function weekStart(dateStr) {
  const p = parts(dateStr);
  if (!p) return "";
  const dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); // 0 = Sunday
  return addDays(dateStr, -((dow + 6) % 7));
}

export function weekDates(dateStr) {
  const start = weekStart(dateStr);
  return start ? Array.from({ length: 7 }, (_, i) => addDays(start, i)) : [];
}

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
export function dayLetter(index) { return DAY_LETTERS[index] ?? ""; }

/** "Today", "Yesterday", or a short date. `today` is passed in, never read
 *  from a clock, so the label agrees with the household's calendar. */
export function dayLabel(dateStr, today) {
  if (dateStr === today) return "Today";
  if (dateStr === addDays(today, -1)) return "Yesterday";
  const p = parts(dateStr);
  if (!p) return "";
  return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// ── Minutes and timers ───────────────────────────────────────────────────────

/** A whole number of minutes from 1 to MAX_MINUTES, or null. */
export function clampMinutes(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, MAX_MINUTES);
}

export function formatMinutes(total) {
  const n = Math.max(0, Math.round(Number(total) || 0));
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60), m = n % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Milliseconds a timer has been running; never negative, even when the
 *  device clock is behind the one that started it. */
export function elapsedMs(startedAtIso, nowMs) {
  const start = Date.parse(startedAtIso);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, nowMs - start);
}

/** Minutes a stopped timer is worth. A timer that ran at all counts as one
 *  minute, and one left running overnight is capped. */
export function timerMinutes(startedAtIso, nowMs) {
  return Math.min(MAX_MINUTES, Math.max(1, Math.round(elapsedMs(startedAtIso, nowMs) / 60000)));
}

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ── Who may do what ──────────────────────────────────────────────────────────
// These mirror the row policies in manifest.json exactly. A gate that is more
// generous than the hub shows a button that answers 403.

/** `activities` is adult_writable. */
export function canManageActivities(me) { return isAdult(me); }

/** `sessions.verified_by` / `verified_at` are writable by adults only. */
export function canVerify(me) { return isAdult(me); }

/** `sessions` is owner_only with member_can_update:false — a child inserts
 *  their own row and nothing else; an adult inserts for anyone. */
export function canLogFor(me, memberId) {
  if (!me || !memberId) return false;
  return isAdult(me) || me.id === memberId;
}

/** Only adults may change or remove a session once it exists. */
export function canEditSession(me) { return isAdult(me); }

export function isVerified(session) { return !!session?.verified_at; }

// ── Weekly progress ──────────────────────────────────────────────────────────

/**
 * One activity's week. Each day is:
 *   "met"     — verified minutes reached the daily goal
 *   "waiting" — logged minutes reached it, but some still need a parent
 *   "partial" — some practice, short of the goal
 *   "none"
 * Only "met" days count toward the weekly goal, so a child cannot reach it
 * with minutes nobody has confirmed.
 */
export function activityWeek(activity, sessions, today) {
  const dates = weekDates(today);
  const target = Math.max(1, Number(activity?.target_minutes) || 1);
  const targetDays = Math.min(7, Math.max(1, Number(activity?.target_days) || 1));
  const byDate = new Map(dates.map(d => [d, { logged: 0, verified: 0 }]));
  for (const s of sessions) {
    if (s.activity_id !== activity?.id) continue;
    const day = byDate.get(s.practice_date);
    if (!day) continue;
    const minutes = Number(s.minutes) || 0;
    day.logged += minutes;
    if (isVerified(s)) day.verified += minutes;
  }
  let loggedMinutes = 0, verifiedMinutes = 0, metDays = 0;
  const days = dates.map((date, index) => {
    const { logged, verified } = byDate.get(date);
    loggedMinutes += logged;
    verifiedMinutes += verified;
    const state = verified >= target ? "met" : logged >= target ? "waiting" : logged > 0 ? "partial" : "none";
    if (state === "met") metDays++;
    return { date, index, logged, verified, state, isToday: date === today, isFuture: date > today };
  });
  return { days, metDays, targetDays, target, loggedMinutes, verifiedMinutes, goalMet: metDays >= targetDays };
}

/** Whether verifying has just carried a week over its goal: it is met now and
 *  was not before. Published once per activity and week. */
export function crossedWeeklyGoal(activity, before, after, dateInWeek) {
  return !activityWeek(activity, before, dateInWeek).goalMet && activityWeek(activity, after, dateInWeek).goalMet;
}

// ── Lists ────────────────────────────────────────────────────────────────────

/** Sessions waiting for a parent, oldest first so nothing sits forgotten. */
export function pendingSessions(sessions) {
  return sessions.filter(s => !isVerified(s)).sort((a, b) =>
    a.practice_date === b.practice_date
      ? String(a.created_at).localeCompare(String(b.created_at))
      : a.practice_date.localeCompare(b.practice_date));
}

/** Members who have at least one activity, in roster order. */
export function membersWithActivities(members, activities) {
  const ids = new Set(activities.map(a => a.member_id));
  return members.filter(m => ids.has(m.id));
}

/** The most recent day an activity was practised among these sessions, or "".
 *  Mirrors what the hub stores in `activities.last_practice_date`. */
export function latestPracticeDate(sessions, activityId) {
  let latest = "";
  for (const s of sessions) if (s.activity_id === activityId && s.practice_date > latest) latest = s.practice_date;
  return latest;
}

export function minutesOn(sessions, memberId, dateStr) {
  let total = 0;
  for (const s of sessions) if (s.member_id === memberId && s.practice_date === dateStr) total += Number(s.minutes) || 0;
  return total;
}

/**
 * Fields the in-app search matches against (see hub-sdk `searchMatch`). A
 * session row carries only an activity id, so the name is passed in. The note
 * counts too — "the day I finally got the left hand" is how a session is found.
 */
export function searchableFields(session, activityName) {
  return [activityName, session.note, session.practice_date];
}
