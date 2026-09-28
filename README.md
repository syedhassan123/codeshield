# CodeShield AI

Next.js assessment and proctoring platform — Lovable UI preserved, real auth, MongoDB-backed exams, grading, coding runner, and proctoring.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui primitives + Lucide
- MongoDB + Mongoose
- Auth.js (NextAuth v5) credentials + JWT sessions
- Judge0 / Piston isolated code runner
- MediaPipe face + head-pose monitoring during exams

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env and set MongoDB Atlas (or local) URI:

```bash
cp .env.example .env.local
```

Required:

- `MONGODB_URI` — MongoDB Atlas connection string
- `AUTH_SECRET` — long random string

Optional (see `.env.example`):

- Code runner (`JUDGE0_URL`, `CODE_RUNNER_PROVIDER`)
- Exam recording storage (`STORAGE_PROVIDER`, S3/R2 vars)
- SMTP for registration OTP

3. Seed demo users:

```bash
npm run seed
```

4. Start:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).



## Completed phases

| Phase | Scope |
|-------|--------|
| **0** | Route migration, design tokens, workspace shells, User model, RBAC, seed users |
| **1** | Question bank + assessment CRUD, publish/unpublish |
| **2** | Exam attempts, timer, autosave, submit, MCQ auto-score |
| **3** | Results list, manual subjective grading, evaluation completion |
| **4** | Registration email OTP, verified login flow |
| **5** | Isolated coding runner, visible/hidden tests, auto coding score |
| **6** | Exam security events (tab switch, copy/paste, fullscreen) |
| **7** | Webcam recording during exams, admin playback |
| **8A** | Face count monitoring (no face / multiple faces) |
| **8B** | Head-pose / looking-away monitoring |
| **9** | Admin dashboard, monitoring, students, reports wired to MongoDB; CSV/PDF export |
| **10** | Proctoring infrastructure hardening — camera pre-check, recording lifecycle, upload retry, idempotency, security monitoring cleanup, admin playback states |
| **11** | Advanced AI proctoring analysis — evidence aggregation, temporal correlation, explainable risk scoring, unified timeline, automated review summary |
| **11.5** | Student dashboard wired to real MongoDB data (stats, activity, assessments) |
| **12** | Coding execution security hardening — isolated runner limits, authz, hidden tests, compile/timeout handling, duplicate-run guards |
| **13** | Production hardening & end-to-end QA — attempt/submit/recording idempotency, auth isolation, timer authority, result uniqueness |
| **15** | LiveKit real-time video interviews — room tokens, ownership-gated access, lobby camera/mic checks |
| **16** | Certificate issuance — real data, auto-issued on graded pass, DB-unique idempotency, non-guessable serials |
| **17** | Public certificate verification (`/verify`) + admin certificate management/revocation |
| **18** | Platform settings — real persistence for `/admin/settings`, wired into new-assessment security defaults |
| **19** | Live admin monitoring — Server-Sent Events push feed replaces 30s polling on `/admin/monitoring` |
| **20** | Real in-app notifications — shared bell/dropdown across admin, student, and interviewer portals |
| **21** | Admin analytics — `/admin/analytics` charts read real MongoDB series |
| **22** | Password reset — `/forgot-password` issues a 6-digit OTP and updates the hash |
| **23** | Workspace search — shared header search queries role-scoped MongoDB data |

## Phase 13 — Production hardening

Hardened the existing assessment/proctoring pipeline (no new features):

- Atomic attempt finalization + one result per attempt
- Recording leftover `RECORDING`/`UPLOADING` rows close to `FAILED` when the attempt completes
- Autosave flush before submit; exam submit no longer deadlocks on recording upload failure
- Registration always creates `student`; `skipVerification` removed from credentials
- Demo login gated by `ALLOW_DEMO_LOGIN` (off in production unless enabled)
- Server-side remaining-time authority unchanged; overdue attempts expire on touch / monitoring

```bash
npx tsx --env-file=.env.local scripts/verify-phase13-hardening.ts
```

Standalone `/student/coding` practice remains **deferred**. Interviewer production integration is **not in this phase**.

## Phase 12 — Coding execution & security hardening

Audited and hardened the existing Judge0/Piston pipeline (student code **never** runs in Next.js):

- `src/lib/coding/runner.ts` — external sandbox only; `enable_network: false` (Judge0); HTTP timeouts; output clamping
- `src/lib/coding/evaluate.ts` — weighted scoring; compile-error short-circuit; structured statuses
- `src/lib/coding/security.ts` — source validation; sanitized student error messages
- `src/lib/actions/coding.ts` — attempt ownership; visible vs hidden tests; run cooldown; upsert run drafts
- Exam UI — separate Run/Submit in-flight guards

Supported languages: `python`, `javascript`, `java`, `cpp` (pinned versions in `src/lib/coding/config.ts`).

```bash
npx tsx --env-file=.env.local scripts/verify-phase12-coding.ts
# Optional live sandbox:
PHASE12_LIVE_RUNNER=1 npx tsx --env-file=.env.local scripts/verify-phase12-coding.ts
```

Production: deploy a **private** Judge0 or Piston instance; see `docs/CODE_RUNNER.md`.

## Phase 11 — Advanced AI proctoring

Builds an intelligence layer on top of existing Phase 8A/8B vision monitoring and Phase 10 recording — **without replacing them**.

- Aggregates `SecurityEvent` evidence (browser + vision + camera/recording)
- Debounced face/head signals preserved from Phase 8A/8B
- Temporal correlation windows for multi-signal review periods
- Explainable risk score (0–100) with documented factor weights
- Unified proctoring timeline with recording-relative timestamps
- Cautious automated review summary (decision-support only — **does not auto-fail students or change grades**)
- Admin attempt detail: `/admin/results/[attemptId]`

```bash
npx tsx --env-file=.env.local scripts/verify-phase11-ai-proctoring.ts
```

## Phase 10 — Proctoring & recording hardening

Reliability improvements for the existing proctoring pipeline (no new AI detection):

- Assessment security settings (`requireCamera`, fullscreen, copy/paste, tab monitoring) drive exam behavior
- Camera pre-check with permission/unavailable/browser error handling
- MediaRecorder MIME fallback, error handling, and accurate recording status UI
- Recording idempotency (one active `RECORDING` row per attempt; resume after refresh)
- Upload retry on submit, server-side attempt ownership validation
- Security event linkage and listener cleanup on submit/unmount
- Admin playback handles READY / FAILED / in-progress recording states

```bash
npx tsx --env-file=.env.local scripts/verify-phase10-proctoring.ts
```

## Phase 9 — Admin real data

The Admin area now reads from MongoDB instead of `mock-data.ts`:

- `/admin` — stat cards, charts, recent security alerts, recent assessments
- `/admin/monitoring` — active attempts, security event stream (live push as of Phase 19; was 30s refresh)
- `/admin/students` — real student users with search/filter/pagination
- `/admin/reports` — attempt/result/proctoring reports with filters, CSV export, printable PDF

## Phase 15 — LiveKit video interviews

Real-time Student ↔ Interviewer audio/video uses [LiveKit](https://livekit.io/). Configure in `.env.local`:

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

Room names derive from the canonical `Interview._id` (`interview:{id}`). Tokens are issued server-side at `/api/interviews/[id]/room-token` after ownership verification. **Never** put API secrets in `NEXT_PUBLIC_*`.

Verify:

```bash
npx tsx --env-file=.env.local scripts/verify-phase15-video-interview.ts
npx tsx --env-file=.env.local scripts/verify-phase14-6-interview-e2e.ts
```

## Phase 16 — Certificate issuance

Replaces the mock `/student/certificates` page with real `Certificate` documents. No new external dependency (no PDF service, no LLM key).

- **Auto-issue trigger:** any path that sets a `Result.evaluationStatus` to `"completed"` with a passing score — `finalizeAttempt` (all-auto-graded exams), `gradeQuestionAction`, and `completeEvaluationAction` (manually graded exams) all call `issueCertificateIfEligible`.
- **Pass threshold resolution:** `Assessment.passThreshold` (percent, optional, no admin UI yet) if set, else the global default in `src/lib/certificates/config.ts` (`CERTIFICATE_DEFAULT_PASS_THRESHOLD` env, default `60`). Single resolution path — never duplicated.
- **Retake policy (explicit):** one certificate **per passing Result**, not per assessment — a student who retakes and re-passes accumulates another certificate.
- **Idempotency:** `Certificate.resultId` has a **DB-level unique index**; issuance treats a duplicate-key error as "already issued," so concurrent/retried completions can't double-issue.
- **Serial numbers:** `CERT-{year}-{cryptographically-random}` — never sequential or derived from `_id`, so certificates can't be enumerated.
- **Ownership:** the list page (`/student/certificates`) and the printable detail page (`/student/certificates/[id]`) each independently scope by the logged-in student — direct navigation to another student's certificate URL 404s.
- **Download:** browser-native `window.print()` on the detail page (no PDF library) — same "printable" approach as Phase 9's report export, applied per-certificate instead of per-report.
- **Backfill:** `scripts/backfill-phase16-certificates.ts` issues certificates for Results that completed before this phase shipped, using the same idempotent path.
- **Out of scope:** interview-based certificates, admin certificate management/revocation UI (model fields exist, unused), and public third-party verification (e.g. `/verify/[serial]` for employers) — flagged as a likely future phase.

```bash
npx tsx --env-file=.env.local scripts/verify-phase16-certificates.ts
npx tsx --env-file=.env.local scripts/backfill-phase16-certificates.ts
```

## Phase 17 — Certificate verification + admin management

Extends Phase 16 with the two things deliberately left out of scope there.

- **Public verification:** `/verify` (search form) and `/verify/[serial]` (result) — unauthenticated, no login required. Looks up by `certificateSerial` only (never a raw Mongo id). Returns the minimal fields an employer needs — student name, assessment title, score, issued date — and never returns `revokedReason` (may contain internal admin notes) or the student's email/internal ids. "Not found" and "revoked" are distinct outcomes so a real revoked certificate doesn't look like a typo, without leaking more than that.
- **Admin management:** `/admin/certificates` — search/filter by status, revoke (with a required reason, stored on the certificate) and reinstate. Both actions are idempotent (revoking an already-revoked certificate, or reinstating an already-issued one, is a no-op, not an error).
- Revoking a certificate automatically removes it from the student's `/student/certificates` list and dashboard count — both already filter on `status: "issued"` from Phase 16, so no extra wiring was needed there.
- Linked from the student's printable certificate (Phase 16) and the landing page footer for discoverability.

```bash
npx tsx --env-file=.env.local scripts/verify-phase17-certificate-admin-verification.ts
```

## Phase 18 — Platform settings

`/admin/settings` was previously 100% decorative — every field was an uncontrolled `defaultValue`/`defaultChecked`, and "Save settings" had no `onClick` at all. Now backed by a real singleton `PlatformSettings` document.

- **Organization / Notifications / Branding:** persisted as admin preferences. Notifications and Branding are stored only — no delivery integration or theme engine reads them yet (flagged in the UI itself with an inline hint).
- **Security & Proctoring — 3 of 6 toggles are functionally wired, not just stored:** "Enforce face verification," "Block tab switching," and "Disable copy/paste" map directly to `Assessment.security.requireFaceDetection` / `.monitorTabSwitching` / `.blockCopyPaste` and become the **default security applied to every newly created assessment** (`createAssessmentAction` in `src/lib/actions/assessments.ts`) — meaningful because the assessment create form has no per-assessment security UI today, so this platform default always takes effect. "Detect dev tools," "Auto-submit after 3 violations," and "Allow paste in coding test" are persisted but have no enforcement engine yet — labeled as such in the UI.
- **Singleton, not a growing collection:** `PlatformSettings.key` has a unique index; saves always upsert the one document, never create a second.
- Existing/legacy assessments are untouched — this only changes the *default* used when `security` isn't explicitly provided at creation time.

```bash
npx tsx --env-file=.env.local scripts/verify-phase18-platform-settings.ts
```

## Phase 19 — Live admin monitoring (SSE push)

`/admin/monitoring` polled `getAdminMonitoringAction()` on a plain 30-second `setInterval`. The underlying data was already real (Phase 9) — this phase only changes *how* it's delivered. No new dependency and no LiveKit/LLM keys needed: native browser `EventSource` + a streaming Next.js Route Handler.

- **`src/app/api/admin/monitoring/stream/route.ts`** — admin-gated (`requireAdmin()`, checked once when the connection opens, not per tick). Responds with `Content-Type: text/event-stream` over a `ReadableStream`, re-reading MongoDB every 5s via the same query functions the old action used (`getMonitoringSummary`, `getActiveMonitoringSessions`, `getMonitoringEventStream`, `getMonitoringSystemHealth`) and pushing a `monitoring` event with the fresh payload. The interval is cleared via `req.signal`'s `abort` listener when the client disconnects — no orphaned timers.
- **Deliberately no Mongo change streams** — those require a replica set, which a plain standalone/local MongoDB doesn't provide. Server-side interval polling (now 5s instead of the client's old 30s) is the compatible, zero-infra choice.
- **Client (`admin-monitoring-client.tsx`)** subscribes via `new EventSource(...)` instead of `setInterval` + server action. Auto-reconnects (3s backoff) on a dropped connection; the header badge reflects real connection state (`● LIVE` / `○ Reconnecting…`) instead of a static label.
- **Naming gotcha avoided:** server-side query failures are pushed as a custom `monitoring_error` event, deliberately *not* named `error` — `EventSource` treats any event named `error` (including custom server-sent ones) as a connection-level failure and fires `onerror`, which would incorrectly trigger the reconnect path for a mere query hiccup instead of an actual dropped connection.

```bash
npx tsx --env-file=.env.local scripts/verify-phase19-live-monitoring.ts
```

## Phase 20 — Real in-app notifications

The bell icon in `src/components/layout/workspace-shell.tsx` (shared header for **all three portals** — admin, student, interviewer) previously had no `onClick` at all, and its red "unread" dot was hardcoded to always show. Now backed by a real `Notification` model, wired into existing events — no new dependency, no LiveKit/LLM key.

- **Deliberately separate from Phase 18's notification settings** — `emailAlerts`/`smsAlerts`/`webhookIntegrations`/`slackNotifications` remain stored-only preferences with no external delivery. This is a different, additive feature: real in-app events for the actual signed-in user.
- **Hooked into real event points, not a new "notifications" admin surface:**
  - `issueCertificateIfEligible` (Phase 16) → student gets `CERTIFICATE_ISSUED`, linking straight to the certificate.
  - `revokeCertificate` (Phase 17) → student gets `CERTIFICATE_REVOKED`.
  - `finalizeAttempt` (auto-graded exams) and both manual-grading completion paths (`gradeQuestionAction`, `completeEvaluationAction`) → student gets `RESULT_READY`, exactly once per genuine pending→completed transition (guarded so re-grading an already-completed result doesn't spam a duplicate).
  - `createInterviewAction` → both the candidate and the assigned interviewer get `INTERVIEW_SCHEDULED`.
- **Best-effort writes:** `createNotification` catches and logs its own failures rather than throwing — a notification bug must never break certificate issuance, grading, or interview scheduling.
- **IDOR-safe:** `markNotificationRead` scopes by `{ _id, userId }`; a different user's mark-read call is a silent no-op, not an error or leak.
- **UI:** the bell badge reflects a real unread count (polled every 30s + refreshed on open); the dropdown lists recent notifications with relative timestamps, click-to-navigate-and-mark-read, and "mark all read."

```bash
npx tsx --env-file=.env.local scripts/verify-phase20-notifications.ts
```

## Phase 21 — Admin analytics

`/admin/analytics` rendered the same chart components as the dashboard, but with no data, so every panel stayed on its empty state. It now loads real MongoDB series. No new dependency.

- **Performance Trend** — average completed-result score (%) for each of the last 8 weeks (`getWeeklyPerformanceChart`). Weeks with no completed results are `0`.
- **Skill Distribution** — average completed-result score grouped by the assessment title stored on the result (top 6). Uses that denormalized title so historical scores still chart if the assessment document is gone. Distinct from the language chart.
- **User Growth** — the dashboard's existing 8-month student/interviewer registration series.
- **Coding Language Mix** — finalized coding submissions by language.
- **Security Trend** — violation events per day for the last 7 days.
- Chart tooltips take a `seriesName` so "Avg score" and "Violations" are labeled correctly. The dashboard keeps the previous default labels.

```bash
npx tsx --env-file=.env.local scripts/verify-phase21-analytics.ts
```

## Phase 22 — Password reset

`/forgot-password` was a dead form (uncontrolled email, `type="button"` with no handler). It now uses the existing OTP pipeline. No new dependency.

- **Request:** email only. Unknown addresses and suspended accounts get the same copy — "If an account exists for that email, we sent a code." — and never create an `EmailOtp`. Active accounts get a 6-digit `password_reset` code (10-minute TTL, 60s resend cooldown, 5 sends/hour, 5 attempts). SMTP sends when configured; otherwise the code is logged server-side only and is never returned to the browser.
- **Confirm:** code + new password + confirmation in one action. The hash is written only after the code verifies. bcrypt cost matches registration (12). The used code is consumed and cannot be reused. The user is not signed in; they return to `/?reset=1`.
- **Isolation:** `password_reset` codes do not invalidate registration/login codes, and verifying a reset code does not set `emailVerified` or `otpLoginVerifiedAt`.

```bash
npx tsx --env-file=.env.local scripts/verify-phase22-password-reset.ts
```

## Phase 23 — Workspace search

The header search box in `workspace-shell.tsx` was decorative (no `onChange`, no results). It now queries MongoDB, scoped to the signed-in role. No new dependency.

- **Admin:** assessments (title/code/category), students (name/email/course), questions (prompt/code).
- **Student:** published assessments they can take, their own results, their own issued certificates. Drafts and other students' certificates never appear.
- **Interviewer:** only interviews (and those interviews' candidates) assigned to them.
- Queries shorter than 2 characters return nothing. Regex metacharacters are escaped. Each group is capped at 5 hits. The dropdown closes on Escape, outside click, or selecting a result.

```bash
npx tsx --env-file=.env.local scripts/verify-phase23-workspace-search.ts
```

## Still mock / future work

- Interview room question list and local code/notes panels (static/local-only)
- Interview recording — **deferred** (needs LiveKit configured)
- Student coding practice (`/student/coding`) — **deferred**
- AI subjective evaluation assist
- External LLM-generated summaries (Phase 11 uses rule-based automated review text)
- Dev-tools detection, violation-based auto-submit, and coding-editor paste-blocking enforcement (Phase 18 stores these preferences but does not yet enforce them)

## Verification scripts

```bash
npx tsx --env-file=.env.local scripts/verify-phase2-exam.ts
npx tsx --env-file=.env.local scripts/verify-phase3-grading.ts
npx tsx --env-file=.env.local scripts/verify-exam-security.ts
npx tsx --env-file=.env.local scripts/verify-phase10-proctoring.ts
npx tsx --env-file=.env.local scripts/verify-phase11-ai-proctoring.ts
npx tsx --env-file=.env.local scripts/verify-phase11-5-student-dashboard.ts
npx tsx --env-file=.env.local scripts/verify-phase12-coding.ts
npx tsx --env-file=.env.local scripts/verify-phase13-hardening.ts
npx tsx --env-file=.env.local scripts/verify-phase14-6-interview-e2e.ts
npx tsx --env-file=.env.local scripts/verify-phase15-video-interview.ts
npx tsx --env-file=.env.local scripts/verify-phase16-certificates.ts
npx tsx --env-file=.env.local scripts/verify-phase17-certificate-admin-verification.ts
npx tsx --env-file=.env.local scripts/verify-phase18-platform-settings.ts
npx tsx --env-file=.env.local scripts/verify-phase19-live-monitoring.ts
npx tsx --env-file=.env.local scripts/verify-phase20-notifications.ts
npx tsx --env-file=.env.local scripts/verify-phase21-analytics.ts
npx tsx --env-file=.env.local scripts/verify-phase22-password-reset.ts
npx tsx --env-file=.env.local scripts/verify-phase23-workspace-search.ts
npx tsx --env-file=.env.local scripts/verify-production-submission-recording.ts
```

See `docs/CODE_RUNNER.md` for code runner setup.
