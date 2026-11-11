# Developer quickstart

## What to read first

1. [README.md](../README.md) for what the product is.
2. [01-PROJECT-OVERVIEW.md](01-PROJECT-OVERVIEW.md) for which areas are real, partial, or mock.
3. The "I want to change…" table in [02-FOLDER-FILE-MAP.md](02-FOLDER-FILE-MAP.md).
4. The route you will touch in [03-PAGES-ROUTES-MAP.md](03-PAGES-ROUTES-MAP.md).
5. The matching section in [04-FEATURES-ARCHITECTURE.md](04-FEATURES-ARCHITECTURE.md).
6. If the task calls a vendor, [05-SERVICES-INTEGRATIONS.md](05-SERVICES-INTEGRATIONS.md).
7. The flow in [07-DATA-FLOWS.md](07-DATA-FLOWS.md) before you change a write path.

You do not need the whole `scripts/` folder on day one.

## Fifteen files to open first

| Order | File | Why |
|---|---|---|
| 1 | `src/lib/auth.ts` | How a session is created |
| 2 | `src/lib/auth-guards.ts` | How actions reject the wrong role |
| 3 | `src/lib/actions/exam.ts` | Start, save, submit |
| 4 | `src/lib/exam/finalize.ts` | Where a result is born |
| 5 | `src/components/exam/exam-session-client.tsx` | The exam screen and its hooks |
| 6 | `src/lib/actions/assessments.ts` | How exams are published and assigned |
| 7 | `src/lib/actions/coding.ts` | Run versus submit |
| 8 | `src/lib/coding/runner.ts` | The sandbox boundary |
| 9 | `src/lib/face/head-pose-detector.ts` | MediaPipe landmarker entry |
| 10 | `src/lib/proctoring/risk.ts` | How a score is explained |
| 11 | `src/lib/actions/grading.ts` | Admin grade, AI suggestion, review |
| 12 | `src/hooks/use-exam-recording.ts` | Recording lifecycle |
| 13 | `src/lib/storage/index.ts` | Local versus S3 |
| 14 | `src/lib/livekit/room.ts` | Interview room name and token |
| 15 | `src/lib/notifications/events.ts` | Who gets told after a write |

## Install

```bash
npm install
cp .env.example .env.local
```

Put a real `MONGODB_URI` and `AUTH_SECRET` in `.env.local`. Leave LiveKit, S3, SMTP, and `AI_GRADING_API_KEY` empty until you need those features.

```bash
npm run seed
npm run dev
```

Open http://localhost:3000. Demo accounts and the shared password are created in `scripts/seed.ts`.

Coding questions need a runner. Local Piston:

```bash
docker compose -f docker-compose.code-runner.yml up -d
```

Then set `CODE_RUNNER_PROVIDER=piston` and `PISTON_URL=http://localhost:2000`. Details are in [CODE_RUNNER.md](CODE_RUNNER.md).

## Commands you will actually run

```bash
npm run dev
npm run seed
npx tsc --noEmit
```

Verification scripts are opt-in. They are not `npm test`. Many open MongoDB, so they need `--env-file=.env.local`. Run one at a time. Parallel runs have timed out against Atlas.

```bash
npx tsx --env-file=.env.local scripts/verify-phase2-exam.ts
```

## Verification scripts by feature

| Feature | Script |
|---|---|
| Exam start and submit | `scripts/verify-phase2-exam.ts` |
| Manual grading | `scripts/verify-phase3-grading.ts` |
| Registration OTP | `scripts/verify-registration-otp.ts`, `scripts/verify-phase4-otp.ts` |
| Login without OTP | `scripts/verify-login-no-otp.ts` |
| Browser security events | `scripts/verify-exam-security.ts` |
| Recording foundation | `scripts/verify-exam-recording-foundation.ts` |
| Recording plus submit | `scripts/verify-production-submission-recording.ts` |
| Face detection | `scripts/verify-face-detection-foundation.ts` |
| Head pose | `scripts/verify-head-pose-monitoring.ts` |
| Eye gaze math | `scripts/verify-eye-gaze-estimator.ts` |
| Head and eye fusion | `scripts/verify-head-eye-warning-fusion.ts` |
| Warning UX | `scripts/verify-proctoring-warning.ts` |
| Proctoring hardening | `scripts/verify-phase10-proctoring.ts` |
| Risk and evidence analysis | `scripts/verify-phase11-ai-proctoring.ts` |
| Proctoring evidence integrity | `scripts/verify-phase16-proctoring-evidence.ts` |
| Student dashboard | `scripts/verify-phase11-5-student-dashboard.ts` |
| Coding runner | `scripts/verify-phase12-coding.ts` |
| Submit and auth hardening | `scripts/verify-phase13-hardening.ts` |
| Interviewer portal | `scripts/verify-phase14-2-interviewer.ts` |
| Interviewer candidates | `scripts/verify-phase14-3-candidates.ts` |
| Interview evaluations | `scripts/verify-phase14-4-evaluations.ts` |
| Admin and student interviews | `scripts/verify-phase14-5-admin-student.ts` |
| Interview end to end | `scripts/verify-phase14-6-interview-e2e.ts` |
| LiveKit token and access | `scripts/verify-phase15-video-interview.ts` |
| LiveKit room and recording | `scripts/verify-phase24-livekit-interview.ts` |
| Certificates | `scripts/verify-phase16-certificates.ts` |
| Public verify and revoke | `scripts/verify-phase17-certificate-admin-verification.ts` |
| Platform settings | `scripts/verify-phase18-platform-settings.ts` |
| Admin monitoring SSE | `scripts/verify-phase19-live-monitoring.ts` |
| Proctoring admin report | `scripts/verify-phase17-admin-proctoring.ts` |
| Global proctoring analytics | `scripts/verify-phase18-global-proctoring.ts` |
| Human review decisions | `scripts/verify-phase19-proctoring-review.ts` |
| In-app notifications | `scripts/verify-phase20-notifications.ts` |
| Analytics charts | `scripts/verify-phase21-analytics.ts` |
| Password reset | `scripts/verify-phase22-password-reset.ts` |
| Header search | `scripts/verify-phase23-workspace-search.ts` |
| AI grade suggestion | `scripts/verify-phase25-ai-grading.ts` |
| Question type rules | `scripts/verify-assessment-question-type.ts` |

Script phase numbers do not match the archived README one-for-one. Trust the filename and the header comment inside the script.

## Where logs show up

`src/lib/debug.ts` prints server actions while `DEBUG_LOGS` is on. OTP codes print from `src/lib/otp/email.ts` when SMTP is unset. AI suggestion traces use the `[AI-GRADING]` prefix in `src/lib/ai/subjective-grade.ts`. Browser proctoring logs are dev-only inside the face hooks.

## Mock and legacy files

Do not treat these as production sources.

| Path | What it really is |
|---|---|
| `src/lib/mock-data.ts` | Static problems and interview questions |
| `src/app/student/coding/page.tsx` | Renders that mock list. Nav link is commented out |
| `src/app/student/code/[id]/page.tsx` | Renders the mock editor |
| `src/components/coding/code-editor-client.tsx` | Same mock problem |
| `src/app/interviewer/room/[id]/room-client.tsx` | Imports `interviewQuestions` from mock data for the side panel |
| `src/components/auth/verify-face-client.tsx` | A timer that sets `faceVerified`. No camera model |
| `docs/PHASE-HISTORY.md` | Old README. Useful history, stale where later work reused phase numbers |

Do not delete these until a product change replaces the screens.

## Common mistakes

- Editing `PlatformSettings` notification toggles and expecting email. SMTP is only used for OTP.
- Looking for reminder generation in the bell poll. Reminders run via `POST /api/cron/notification-reminders` or `scripts/run-notification-reminders.ts` — see `docs/REMINDER-SCHEDULER.md`.
- Putting LiveKit secrets in `NEXT_PUBLIC_*`. The token route is the only client path.
- Running student code with `child_process` in a server action. Add a case in `runner.ts` instead.
- Showing `riskScore` on a student result. That page is intentionally free of it.
- Changing risk weights without reading `src/lib/proctoring/head-eye-fusion.ts`. Head and eye can be one incident.

## Change impact, short form

| If you touch | Re-check |
|---|---|
| Security event names | Hooks, `risk.ts`, admin report, the proctoring verify scripts |
| `finalize.ts` | Submit, certificate, result notification |
| `storage/index.ts` | Exam upload and interview playback |
| `livekit/room.ts` | Token route and both lobby clients |
| `notifications/events.ts` | Interview admin actions, grading, certificates, the bell |
