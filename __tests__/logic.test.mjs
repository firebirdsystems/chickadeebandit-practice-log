import { describe, it, expect } from "vitest";
import {
  isDate, addDays, weekStart, weekDates, dayLabel, dayLetter,
  clampMinutes, formatMinutes, elapsedMs, timerMinutes, formatClock, MAX_MINUTES,
  canManageActivities, canVerify, canLogFor, canEditSession, isVerified,
  activityWeek, crossedWeeklyGoal, pendingSessions, membersWithActivities, minutesOn,
  searchableFields,
} from "../src/logic.js";

const adult = { id: "p1", role: "adult" };
const admin = { id: "p2", role: "admin" };
const kid = { id: "k1", role: "child" };
const guest = { id: "g1", role: "guest" };

describe("dates", () => {
  it("recognises real calendar dates only", () => {
    expect(isDate("2026-10-06")).toBe(true);
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("2026-1-5")).toBe(false);
    expect(isDate("")).toBe(false);
    expect(isDate(null)).toBe(false);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("nope", 1)).toBe("");
  });

  it("starts the week on Monday", () => {
    expect(weekStart("2026-10-06")).toBe("2026-10-05"); // Tuesday
    expect(weekStart("2026-10-05")).toBe("2026-10-05"); // Monday itself
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // Sunday belongs to the week before it ends
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
    expect(weekStart("bad")).toBe("");
  });

  it("lists the seven dates of the week", () => {
    const dates = weekDates("2026-10-08");
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe("2026-10-05");
    expect(dates[6]).toBe("2026-10-11");
    expect(weekDates("bad")).toEqual([]);
    expect(dayLetter(0)).toBe("M");
    expect(dayLetter(6)).toBe("S");
    expect(dayLetter(9)).toBe("");
  });

  it("labels today and yesterday from the date it is given", () => {
    expect(dayLabel("2026-10-06", "2026-10-06")).toBe("Today");
    expect(dayLabel("2026-10-05", "2026-10-06")).toBe("Yesterday");
    expect(dayLabel("2026-09-30", "2026-10-06")).not.toBe("");
    expect(dayLabel("bad", "2026-10-06")).toBe("");
  });
});

describe("minutes and timers", () => {
  it("clamps minutes to a whole number from 1 to the cap", () => {
    expect(clampMinutes("30")).toBe(30);
    expect(clampMinutes(29.6)).toBe(30);
    expect(clampMinutes(0)).toBeNull();
    expect(clampMinutes(-5)).toBeNull();
    expect(clampMinutes("abc")).toBeNull();
    expect(clampMinutes(100000)).toBe(MAX_MINUTES);
  });

  it("formats minutes", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(75)).toBe("1 h 15 min");
    expect(formatMinutes(undefined)).toBe("0 min");
  });

  it("never reports a negative elapsed time", () => {
    const start = "2026-10-06T10:00:00.000Z";
    const t0 = Date.parse(start);
    expect(elapsedMs(start, t0 + 5000)).toBe(5000);
    expect(elapsedMs(start, t0 - 5000)).toBe(0);
    expect(elapsedMs("garbage", t0)).toBe(0);
  });

  it("turns a stopped timer into minutes", () => {
    const start = "2026-10-06T10:00:00.000Z";
    const t0 = Date.parse(start);
    expect(timerMinutes(start, t0 + 10_000)).toBe(1);            // counts as one minute
    expect(timerMinutes(start, t0 + 29 * 60_000 + 40_000)).toBe(30);
    expect(timerMinutes(start, t0 + 48 * 3600_000)).toBe(MAX_MINUTES); // left running
  });

  it("formats a running clock", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65_000)).toBe("1:05");
    expect(formatClock(3_600_000 + 5 * 60_000 + 9_000)).toBe("1:05:09");
    expect(formatClock(-1)).toBe("0:00");
  });
});

describe("gates mirror the row policies", () => {
  it("only adults manage activities, verify, and edit sessions", () => {
    for (const gate of [canManageActivities, canVerify, canEditSession]) {
      expect(gate(adult)).toBe(true);
      expect(gate(admin)).toBe(true);
      expect(gate(kid)).toBe(false);
      expect(gate(guest)).toBe(false);
      expect(gate(null)).toBe(false);
    }
  });

  it("a child logs only for themselves; an adult logs for anyone", () => {
    expect(canLogFor(kid, "k1")).toBe(true);
    expect(canLogFor(kid, "k2")).toBe(false);
    expect(canLogFor(adult, "k1")).toBe(true);
    expect(canLogFor(null, "k1")).toBe(false);
    expect(canLogFor(kid, "")).toBe(false);
  });

  it("a session is verified once it carries a stamp", () => {
    expect(isVerified({ verified_at: "2026-10-06T10:00:00Z" })).toBe(true);
    expect(isVerified({ verified_at: "" })).toBe(false);
    expect(isVerified(null)).toBe(false);
  });
});

describe("weekly progress", () => {
  const piano = { id: "a1", member_id: "k1", target_minutes: 30, target_days: 2 };
  const today = "2026-10-08"; // Thursday; the week is Oct 5–11
  const s = (id, date, minutes, verified, extra = {}) => ({
    id, activity_id: "a1", member_id: "k1", practice_date: date, minutes,
    verified_at: verified ? "2026-10-08T12:00:00Z" : "", created_at: `${date}T09:00:00Z`, ...extra,
  });

  it("classifies each day", () => {
    const week = activityWeek(piano, [
      s("1", "2026-10-05", 30, true),   // met
      s("2", "2026-10-06", 20, true),   // waiting: 20 verified + 15 not = 35 logged
      s("3", "2026-10-06", 15, false),
      s("4", "2026-10-07", 10, false),  // partial
    ], today);
    expect(week.days.map(d => d.state)).toEqual(["met", "waiting", "partial", "none", "none", "none", "none"]);
    expect(week.metDays).toBe(1);
    expect(week.goalMet).toBe(false);
    expect(week.loggedMinutes).toBe(75);
    expect(week.verifiedMinutes).toBe(50);
    expect(week.days[3].isToday).toBe(true);
    expect(week.days[4].isFuture).toBe(true);
    expect(week.days[2].isFuture).toBe(false);
  });

  it("counts only verified minutes toward the goal", () => {
    const unverified = [s("1", "2026-10-05", 60, false), s("2", "2026-10-06", 60, false)];
    expect(activityWeek(piano, unverified, today).goalMet).toBe(false);
    const verified = unverified.map(x => ({ ...x, verified_at: "2026-10-08T12:00:00Z" }));
    expect(activityWeek(piano, verified, today).goalMet).toBe(true);
  });

  it("ignores other activities and other weeks", () => {
    const week = activityWeek(piano, [
      s("1", "2026-10-04", 30, true),                          // the Sunday before
      s("2", "2026-10-12", 30, true),                          // the Monday after
      s("3", "2026-10-05", 30, true, { activity_id: "a2" }),   // another activity
    ], today);
    expect(week.loggedMinutes).toBe(0);
    expect(week.metDays).toBe(0);
  });

  it("survives a missing or nonsense goal", () => {
    const week = activityWeek({ id: "a1", target_minutes: 0, target_days: 99 }, [s("1", "2026-10-05", 5, true)], today);
    expect(week.target).toBe(1);
    expect(week.targetDays).toBe(7);
    expect(week.days[0].state).toBe("met");
  });

  it("reports the goal as crossed once, on the verification that completes it", () => {
    const first = s("1", "2026-10-05", 30, true);
    const second = s("2", "2026-10-06", 30, false);
    const secondVerified = { ...second, verified_at: "2026-10-08T12:00:00Z" };
    expect(crossedWeeklyGoal(piano, [first, second], [first, secondVerified], "2026-10-06")).toBe(true);
    // Already met: a third verified day is not a second crossing.
    const third = s("3", "2026-10-07", 30, false);
    const thirdVerified = { ...third, verified_at: "2026-10-08T12:00:00Z" };
    expect(crossedWeeklyGoal(piano, [first, secondVerified, third], [first, secondVerified, thirdVerified], "2026-10-07")).toBe(false);
    // Not yet met.
    expect(crossedWeeklyGoal(piano, [second], [secondVerified], "2026-10-06")).toBe(false);
  });
});

describe("lists", () => {
  it("queues unverified sessions oldest first", () => {
    const rows = [
      { id: "c", practice_date: "2026-10-06", created_at: "2026-10-06T18:00:00Z", verified_at: "" },
      { id: "a", practice_date: "2026-10-05", created_at: "2026-10-05T18:00:00Z", verified_at: "" },
      { id: "b", practice_date: "2026-10-06", created_at: "2026-10-06T08:00:00Z", verified_at: "" },
      { id: "v", practice_date: "2026-10-01", created_at: "2026-10-01T08:00:00Z", verified_at: "2026-10-01T09:00:00Z" },
    ];
    expect(pendingSessions(rows).map(r => r.id)).toEqual(["a", "b", "c"]);
  });

  it("lists only members who have an activity, in roster order", () => {
    const members = [{ id: "p1" }, { id: "k1" }, { id: "k2" }];
    expect(membersWithActivities(members, [{ member_id: "k2" }, { member_id: "k1" }, { member_id: "k1" }]).map(m => m.id))
      .toEqual(["k1", "k2"]);
  });

  it("totals a member's minutes for a day", () => {
    const rows = [
      { member_id: "k1", practice_date: "2026-10-06", minutes: 20 },
      { member_id: "k1", practice_date: "2026-10-06", minutes: 15 },
      { member_id: "k2", practice_date: "2026-10-06", minutes: 99 },
      { member_id: "k1", practice_date: "2026-10-05", minutes: 99 },
    ];
    expect(minutesOn(rows, "k1", "2026-10-06")).toBe(35);
  });

  it("is findable by activity name and by note, not just the date", () => {
    const fields = searchableFields({ note: "left hand finally clicked", practice_date: "2026-10-06" }, "Piano");
    expect(fields).toContain("Piano");
    expect(fields).toContain("left hand finally clicked");
  });
});
