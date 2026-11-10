# Reminder scheduler (Phase 20.1)

Interview and assessment **start** reminders are created by a server sweep.
The header bell only **reads** notifications. It does not generate reminders.

## Canonical engine

```text
src/lib/notifications/reminders.ts → processDueReminders()
```

Used by:

1. `POST /api/cron/notification-reminders` (production)
2. `scripts/run-notification-reminders.ts` (local / support)

## Endpoint

```text
POST https://<production-domain>/api/cron/notification-reminders
```

### Header

```http
Authorization: Bearer <CRON_SECRET>
```

Do not put the secret in the query string, body, or any `NEXT_PUBLIC_*` variable.

### Recommended schedule

```text
*/5 * * * *
```

Every 5 minutes. Grace applies to the **reminder due time** (`scheduledAt - lead`), not after the interview starts. Example: interview at 8:00, lead 30m → due 7:30 → eligible about 7:30–7:35. One missed tick can still fire; once `scheduledAt` has passed, no upcoming reminder is created.

### Expected success body

```json
{
  "ok": true,
  "interviewReminders": 0,
  "assessmentReminders": 0,
  "durationMs": 120
}
```

`401` = missing or wrong secret.  
`503` = `CRON_SECRET` is not set on the server.  
`500` = sweep failed (logged server-side).

`GET` is accepted for simple monitors. Prefer `POST` for production schedulers.

## Why not Vercel Cron alone

Vercel Hobby cron is limited to about one run per day. A daily job cannot serve a 30-minute interview window. This app stays provider-neutral: any HTTP scheduler that can `POST` every 5 minutes with a Bearer secret works (cron-job.org, GitHub Actions `schedule`, Cloud Scheduler, UptimeRobot-style authenticated jobs, and similar).

Do not add a misleading `vercel.json` `crons` entry that cannot meet a 5-minute cadence.

## Production setup

1. Generate a long random secret: `openssl rand -base64 32`
2. Add `CRON_SECRET` to the Vercel **Production** environment (and Preview if you test there)
3. Redeploy if the new env var is not yet available to the running deployment
4. In your external scheduler, create a job:
   - Frequency: every 5 minutes
   - Method: `POST`
   - URL: `https://<your-domain>/api/cron/notification-reminders`
   - Header: `Authorization: Bearer <same CRON_SECRET>`
5. Trigger the job once manually
6. Confirm HTTP `200` and `{ "ok": true, ... }`
7. Confirm a due interview/assessment creates a MongoDB `Notification` with the expected `dedupeKey`
8. Trigger again immediately — expect **no** second document for the same key
9. Open the app later: the bell should show the reminder without anyone having been logged in when it was created

## Local / support

```bash
npx tsx --env-file=.env.local scripts/run-notification-reminders.ts
```

Uses the same `processDueReminders()` engine. No browser required.

## Reminder windows (unchanged)

| Kind | Lead | Grace after dueAt | Status filter |
|---|---|---|---|
| Interview | 30 minutes before `scheduledAt` | 5 minutes after dueAt; never after `scheduledAt` | `scheduled` only |
| Assessment start | 1 hour before `scheduledAt` | 5 minutes after dueAt; never after `scheduledAt` | `scheduled` or `published`, assigned students, skip submitted/expired attempts |

There is no assessment **due-date** reminder: the Assessment model has no deadline field.

## Safety

- Cancelled / completed interviews never remind
- Reschedule uses the current `scheduledAt` in the dedupe key
- Concurrent cron calls are safe: unique sparse `dedupeKey` + upsert
- Evaluation-pending notices stay event-driven on interview complete (not this cron)
