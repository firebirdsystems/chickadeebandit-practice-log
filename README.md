# Practice Log

A [Chickadee Bandit](https://chickadeebandit.com/app-library/practice-log) app.

Kids time or log practice for piano, a language, free throws or anything else. A parent verifies each session, and verified minutes count toward a weekly goal.

## Features

- An activity is whatever a member practises, with a goal a parent sets: minutes a day, and days a week.
- Two ways to log: start a timer, or type in the minutes afterwards. A timer started on one device can be stopped on another.
- A session a child logs waits for a parent. Only verified minutes count toward the weekly goal.
- A week of dots per activity shows the days the goal was met, the days waiting for a parent, and the days that fell short.
- Parents see a queue of sessions to verify, can correct the minutes, and can log a session themselves.
- A home-screen badge counts the sessions waiting to be verified.
- Each activity is a task on Today, ticked once it has been practised that day.

## Who can do what

| | Child | Adult |
|---|---|---|
| See activities and sessions | Their own | Everyone's |
| Add or change an activity and its goal | No | Yes |
| Log a session | For themselves | For anyone, verified as it is written |
| Change or remove a session | No | Yes |
| Verify a session | No | Yes |

The hub enforces every row of this table through the `row_policies` in `manifest.json`. `scenarios.json` replays each rule against the real runtime.

## Events

Both are published by an adult's device, and the hub refuses them from a child.

| Event | When | Payload |
|---|---|---|
| `practice-log.session_verified` | A session is verified. Once per session. | `session_id`, `member_id`, `activity_id`, `minutes`, `practice_date` |
| `practice-log.weekly_goal_met` | Verifying a session completes the week's goal. Once per activity and week. | `member_id`, `activity_id`, `week_start`, `days_met` |

The member who practised is the event's `subject_id`.

Both are in the hub's event catalog, so a household can build automations on them. Three apps suggest one when installed alongside this app: Piggy Bank banks verified minutes as screen time, and Rewards and Points & Recognition award points for a met weekly goal.

## Install

In your hub, go to **Apps → Install from URL** and paste:

```
https://github.com/firebirdsystems/chickadeebandit-practice-log/releases/latest/download/bundle.json
```

## Development

```bash
make setup     # once: enables the pre-push hook
npm install
npm run dev    # http://localhost:3001, with demo data and a "preview as" bar
npm test
npm run build
```

Pure logic lives in `src/logic.js` and is tested in `__tests__/logic.test.mjs`. See the [app-template](https://github.com/firebirdsystems/chickadeebandit-app-template) for the full manifest field reference.
