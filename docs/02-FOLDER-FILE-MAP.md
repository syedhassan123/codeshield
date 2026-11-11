# Folder and file map

Read this before searching the tree. Files are grouped by feature. Tiny UI primitives (`src/components/ui/button.tsx` and similar) are omitted.

Importance:

- CORE: start here. Changing it changes behavior.
- SUPPORTING: constants, formatting, guards used by a core file.
- UI: the screen a person sees.
- TEST / VERIFY: `scripts/verify-*.ts`. They are not imported by the app.
- LEGACY / MOCK: not a production data source.

## I want to change…

| Task | Start here |
|---|---|
| Login, register, OTP, password reset | `src/lib/actions/auth.ts` |
| Session and route protection | `src/lib/auth.ts`, `src/lib/auth-guards.ts` |
| Assessment create and assign | `src/lib/actions/assessments.ts` |
| Question bank | `src/lib/actions/questions.ts` |
| Start or submit an exam | `src/lib/actions/exam.ts` |
| Exam screen | `src/components/exam/exam-session-client.tsx` |
| Autosave and timer | `src/lib/actions/exam.ts`, `src/lib/exam/finalize.ts` |
| Coding run and submit | `src/lib/actions/coding.ts` |
| Judge0 / Piston | `src/lib/coding/runner.ts` |
| Face detection | `src/lib/face/detector.ts` |
| Head warning | `src/hooks/use-head-pose-monitoring.ts` |
| Eye gaze | `src/lib/face/eye-gaze-estimator.ts` |
| Eye-away timing | `src/lib/face/eye-gaze-warning.ts` |
| Browser security events | `src/hooks/use-exam-security.ts` |
| Persist a proctoring event | `src/lib/actions/exam-security.ts` |
| Risk score | `src/lib/proctoring/risk.ts` |
| Evidence and timeline | `src/lib/proctoring/evidence.ts` |
| Head and eye counted once | `src/lib/proctoring/head-eye-fusion.ts` |
| Admin proctoring review decision | `src/lib/admin/proctoring-case.ts` |
| Admin results and queue | `src/app/admin/results/page.tsx` |
| Exam recording | `src/hooks/use-exam-recording.ts` |
| S3 or local upload | `src/lib/storage/index.ts` |
| LiveKit token | `src/app/api/interviews/[id]/room-token/route.ts` |
| LiveKit room client | `src/hooks/use-interview-livekit-room.ts` |
| Interview schedule | `src/lib/actions/interviews-admin.ts` |
| Interview evaluation | `src/lib/actions/interviewer.ts` |
| Interview recording | `src/lib/interview-recording/service.ts` |
| AI grade suggestion | `src/lib/ai/subjective-grade.ts` |
| Manual grading | `src/lib/actions/grading.ts` |
| Certificates | `src/lib/certificates/issue.ts` |
| Public certificate check | `src/lib/certificates/public.ts` |
| In-app notifications | `src/lib/notifications/events.ts` |
| Reminders | `src/lib/notifications/reminders.ts` |
| SMTP | `src/lib/otp/email.ts` |
| Admin monitoring feed | `src/app/api/admin/monitoring/stream/route.ts` |
| Workspace search | `src/lib/search/queries.ts` |
| Platform settings | `src/lib/actions/settings.ts` |
| Seed users | `scripts/seed.ts` |

## `src/app/`

Purpose: Next.js routes. A `page.tsx` is the URL. A `route.ts` is an HTTP endpoint. Most pages load data on the server and hand it to a client component.

### Auth and public

| File | Purpose | Level |
|---|---|---|
| `src/app/page.tsx` | Landing and login | UI |
| `src/app/verify-otp/page.tsx` | Registration OTP screen | UI |
| `src/app/verify-face/page.tsx` | Fake face-check progress | LEGACY / MOCK |
| `src/app/forgot-password/page.tsx` | Password reset | UI |
| `src/app/verify/page.tsx` | Public certificate search | UI |
| `src/app/verify/[serial]/page.tsx` | Public certificate result | UI |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth.js handler | CORE |

### Student

| File | Purpose | Level |
|---|---|---|
| `src/app/student/layout.tsx` | Student nav. Coding link is commented out | UI |
| `src/app/student/page.tsx` | Dashboard | UI |
| `src/app/student/assessments/page.tsx` | Published assessments | UI |
| `src/app/student/exam/[id]/page.tsx` | Exam gate before start | UI |
| `src/app/student/exam/session/[attemptId]/page.tsx` | Live exam. Loads `ExamSessionClient` | CORE |
| `src/app/student/exam/result/[attemptId]/page.tsx` | Student result | UI |
| `src/app/student/results/page.tsx` | Result list | UI |
| `src/app/student/interviews/page.tsx` | Interview list. Join goes to the lobby | UI |
| `src/app/student/certificates/page.tsx` | Issued certificates | UI |
| `src/app/student/certificates/[id]/page.tsx` | Printable certificate | UI |
| `src/app/student/profile/page.tsx` | Profile | UI |
| `src/app/student/coding/page.tsx` | Mock problem list | LEGACY / MOCK |
| `src/app/student/code/[id]/page.tsx` | Mock editor | LEGACY / MOCK |

### Admin

| File | Purpose | Level |
|---|---|---|
| `src/app/admin/layout.tsx` | Admin nav | UI |
| `src/app/admin/page.tsx` | Dashboard | UI |
| `src/app/admin/questions/page.tsx` | Question bank | UI |
| `src/app/admin/assessments/page.tsx` | Assessment list | UI |
| `src/app/admin/assessments/[id]/page.tsx` | Assessment editor | UI |
| `src/app/admin/students/page.tsx` | Student directory | UI |
| `src/app/admin/results/page.tsx` | Results and proctoring queue | CORE |
| `src/app/admin/results/[attemptId]/page.tsx` | Attempt detail, grading, review | CORE |
| `src/app/admin/monitoring/page.tsx` | Live monitoring | UI |
| `src/app/admin/analytics/page.tsx` | Charts | UI |
| `src/app/admin/reports/page.tsx` | Filterable reports | UI |
| `src/app/admin/interviews/page.tsx` | Schedule interviews | UI |
| `src/app/admin/certificates/page.tsx` | Revoke and reinstate | UI |
| `src/app/admin/settings/page.tsx` | Platform settings | UI |

### Interviewer

| File | Purpose | Level |
|---|---|---|
| `src/app/interviewer/layout.tsx` | Interviewer nav. Lobby and room are fullscreen | UI |
| `src/app/interviewer/(portal)/page.tsx` | Dashboard | UI |
| `src/app/interviewer/(portal)/interviews/page.tsx` | Assigned interviews | UI |
| `src/app/interviewer/(portal)/candidates/page.tsx` | Candidates from owned interviews | UI |
| `src/app/interviewer/(portal)/evaluations/page.tsx` | Evaluation list | UI |
| `src/app/interviewer/(portal)/evaluations/[interviewId]/page.tsx` | Evaluation form | UI |
| `src/app/interviewer/lobby/[id]/page.tsx` | Camera and mic check. Students use this too | CORE |
| `src/app/interviewer/room/[id]/page.tsx` | Live room page | CORE |
| `src/app/interviewer/room/[id]/room-client.tsx` | Room UI. Question list is mock | UI |

### API routes

| File | Purpose | Level |
|---|---|---|
| `src/app/api/interviews/[id]/room-token/route.ts` | LiveKit JWT after ownership check | CORE |
| `src/app/api/interviews/[id]/recording/route.ts` | Playback metadata when the interview recording is READY | CORE |
| `src/app/api/interviews/[id]/recording/file/route.ts` | Interview recording bytes for a local file | SUPPORTING |
| `src/app/api/student/exam-recordings/[recordingId]/upload/route.ts` | Local exam upload | CORE |
| `src/app/api/admin/recordings/[recordingId]/route.ts` | Admin exam playback | CORE |
| `src/app/api/admin/monitoring/stream/route.ts` | Admin monitoring SSE | CORE |

## `src/components/`

### Exam

| File | Purpose | Level |
|---|---|---|
| `exam-session-client.tsx` | Wires timer, answers, coding, camera, warnings, recording, submit | CORE |
| `exam-gate-client.tsx` | Rules and camera pre-check before start | UI |
| `exam-coding-panel.tsx` | Run and Submit for a coding question | CORE |
| `exam-security-banner.tsx` | In-exam security status | UI |
| `camera-precheck.tsx` | Camera permission UI | UI |
| `proctoring-head-warning-overlay.tsx` | Looking-away warning | UI |
| `eye-gaze-debug-panel.tsx` | Dev-only gaze readout. Hidden in production | TEST / VERIFY |
| `exam-result-client.tsx` | Student result view | UI |

Used by: the student exam routes above.

### Admin

| File | Purpose | Level |
|---|---|---|
| `admin-results-client.tsx` | Results table and proctoring queue filters | UI |
| `admin-attempt-detail-client.tsx` | Grade answers, AI suggestion, recording playback | UI |
| `admin-proctoring-review.tsx` | Queue presentation | UI |
| `admin-proctoring-case-review.tsx` | Clear / flag / follow-up form | UI |
| `admin-proctoring-analysis-report.tsx` | Evidence, timeline, risk | UI |
| `admin-interviews-client.tsx` | Create and edit interviews | UI |
| `assessments-manager-client.tsx` | Assessment list actions | UI |
| `assessment-detail-client.tsx` | Assessment editor | UI |
| `question-bank-client.tsx` | Question CRUD | UI |
| `admin-monitoring-client.tsx` | SSE client for monitoring | UI |
| `admin-reports-client.tsx` | Report filters and export | UI |
| `admin-settings-client.tsx` | Settings form | UI |
| `admin-certificates-client.tsx` | Certificate admin | UI |
| `admin-students-client.tsx` | Student table | UI |

### Interview, auth, layout

| File | Purpose | Level |
|---|---|---|
| `src/components/interview/video-track.tsx` | Attaches a LiveKit track to a video element | UI |
| `src/components/landing/auth-panel.tsx` | Login, register, demo login | UI |
| `src/components/auth/verify-otp-client.tsx` | OTP form | UI |
| `src/components/auth/forgot-password-client.tsx` | Reset form | UI |
| `src/components/auth/verify-face-client.tsx` | Simulated face check | LEGACY / MOCK |
| `src/components/layout/workspace-shell.tsx` | Sidebar, bell, sign out | CORE |
| `src/components/layout/workspace-search.tsx` | Header search | UI |
| `src/components/layout/role-layout-client.tsx` | Shell plus fullscreen exceptions | SUPPORTING |
| `src/components/coding/code-editor-client.tsx` | Mock practice editor | LEGACY / MOCK |
| `src/components/charts/simple-charts.tsx` | Recharts wrappers | UI |

## `src/hooks/`

All of these run in the browser during an exam or interview.

| File | Purpose | Level |
|---|---|---|
| `use-face-detection.ts` | Face count loop | CORE |
| `use-head-pose-monitoring.ts` | Head orientation loop and warning timing | CORE |
| `use-eye-gaze-monitoring.ts` | Gaze warning timing and security events | CORE |
| `use-proctoring-head-warning-ux.ts` | Overlay timing shared by head and eye warnings | UI |
| `use-exam-security.ts` | Tab, blur, fullscreen, copy, paste, cut, context menu | CORE |
| `use-exam-recording.ts` | MediaRecorder, stop, upload, retry | CORE |
| `use-interview-livekit-room.ts` | Connect, publish, refresh the 15-minute token | CORE |
| `use-interview-recording.ts` | Interviewer-side interview recording | CORE |

## `src/lib/face/`

Purpose: MediaPipe face count, head pose, and eye gaze. This folder runs in the browser. It does not write MongoDB itself. Hooks persist events through `recordExamSecurityEventAction`.

| File | Purpose | Level |
|---|---|---|
| `detector.ts` | MediaPipe FaceDetector. Counts faces | CORE |
| `head-pose-detector.ts` | FaceLandmarker. Head orientation plus a same-frame gaze sample | CORE |
| `head-pose-orientation.ts` | Turns the face matrix into left/right/up/down/center | CORE |
| `eye-gaze-estimator.ts` | LEFT / RIGHT / DOWN / CENTER from eye landmarks | CORE |
| `eye-gaze-warning.ts` | How long gaze must stay away before an event | CORE |
| `eye-gaze-smoothing.ts` | Smooths noisy frame-to-frame gaze | SUPPORTING |
| `eye-gaze-landmarks.ts` | Which landmark indexes are the eyes | SUPPORTING |
| `eye-gaze-constants.ts` | Gaze thresholds | SUPPORTING |
| `eye-gaze-calibration.ts` | Dev calibration helper. Returns nothing in production | SUPPORTING |
| `head-pose-constants.ts` | Head angles, warning times, landmarker model URL | SUPPORTING |
| `constants.ts` | Face-count timings and FaceDetector model URL | SUPPORTING |
| `head-pose-debug.ts` | Dev-only debug switch | TEST / VERIFY |
| `head-pose-simulation.ts` | Dev-only simulated pose | TEST / VERIFY |

Used by: `exam-session-client.tsx` and the monitoring hooks.

Raw eye landmarks are not stored. Persisted rows are event types such as `EYE_GAZE_AWAY`.

## `src/lib/proctoring/`

Purpose: turn stored `SecurityEvent` rows into evidence, a timeline, a score, and review copy. This does not run MediaPipe.

| File | Purpose | Level |
|---|---|---|
| `risk.ts` | Score 0–100. LOW under 25, MEDIUM under 50, HIGH under 75, CRITICAL from 75. Cap 100 | CORE |
| `evidence.ts` | Group events into evidence items | CORE |
| `head-eye-fusion.ts` | Head and eye events in the same 20-second window count once | CORE |
| `correlation.ts` | Multi-signal time clusters | SUPPORTING |
| `analyze.ts` | One attempt analysis used by the admin report | CORE |
| `summary.ts` | Rule-based review text. Not an LLM | SUPPORTING |
| `review.ts` | Queue row shaping | SUPPORTING |
| `global-analytics.ts` | Windowed admin analytics over attempts | CORE |
| `case-review.ts` | Clear / flag / follow-up state machine | CORE |
| `types.ts` | Shared proctoring types | SUPPORTING |
| `alert-audio.ts` | Unlocks the in-exam warning sound | UI |

Used by: `src/lib/actions/grading.ts`, `src/lib/admin/proctoring-analytics.ts`, `src/lib/admin/proctoring-case.ts`.

If you change an event type, also update `src/types/exam-security.ts`, `risk.ts`, the exam hooks, and the verify scripts listed in `docs/09-DEVELOPER-QUICKSTART.md`.

## `src/lib/exam/`

| File | Purpose | Level |
|---|---|---|
| `finalize.ts` | Submit or expire an attempt, write `Result`, issue certificate, notify | CORE |
| `access.ts` | Which published assessment a student may open | CORE |
| `score.ts` | MCQ scoring helper | SUPPORTING |
| `security.ts` | Server-side security event rules | CORE |
| `recording-finalize.ts` | Close leftover recording rows when an attempt ends | SUPPORTING |

## `src/lib/coding/`

| File | Purpose | Level |
|---|---|---|
| `runner.ts` | Judge0 and Piston HTTP calls. `enable_network: false` on Judge0 | CORE |
| `evaluate.ts` | Visible vs hidden tests, weighted score | CORE |
| `security.ts` | Source size and student-safe errors | CORE |
| `config.ts` | Pinned language versions | SUPPORTING |
| `normalize.ts` | Compare outputs | SUPPORTING |

Actions: `src/lib/actions/coding.ts`. UI: `exam-coding-panel.tsx`.

## `src/lib/storage/`

| File | Purpose | Level |
|---|---|---|
| `index.ts` | `local` or `s3` provider. Key helpers `exams/{attemptId}/…` and `interviews/{interviewId}/…` | CORE |
| `local-upload-tokens.ts` | Short-lived token for the local upload route | SUPPORTING |
| `local-playback-tokens.ts` | Short-lived token for local playback | SUPPORTING |

## `src/lib/livekit/`

| File | Purpose | Level |
|---|---|---|
| `config.ts` | Reads `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | CORE |
| `room.ts` | Room name `interview:{id}`, identity `user:{userId}`, 15-minute JWT | CORE |
| `egress.ts` | Room-composite egress when S3 is configured | SUPPORTING |

## `src/lib/notifications/`

| File | Purpose | Level |
|---|---|---|
| `events.ts` | Copy and recipients for each product event | CORE |
| `create.ts` | Insert with dedupe. Failures are logged and not thrown | CORE |
| `queries.ts` | List 20 newest, mark read, scoped by `userId` | CORE |
| `reminders.ts` | 30 minutes before an interview, 1 hour before an assessment | CORE |

Actions: `src/lib/actions/notifications.ts`. UI: `workspace-shell.tsx`.

## `src/lib/certificates/`

| File | Purpose | Level |
|---|---|---|
| `issue.ts` | Issue once per passing result | CORE |
| `config.ts` | Default pass percent from `CERTIFICATE_DEFAULT_PASS_THRESHOLD` | SUPPORTING |
| `public.ts` | Public lookup by serial | CORE |
| `admin-queries.ts` | Revoke and reinstate | CORE |
| `queries.ts` | Student list | SUPPORTING |

## `src/lib/otp/`

| File | Purpose | Level |
|---|---|---|
| `email.ts` | Nodemailer. Logs the code in development when SMTP is missing | CORE |
| `service.ts` | Create, send, and verify OTP rows | CORE |
| `crypto.ts` | Hash the code with `AUTH_SECRET` | SUPPORTING |

There is no separate template folder. HTML is built inside `email.ts`.

## `src/lib/ai/`

| File | Purpose | Level |
|---|---|---|
| `subjective-grade.ts` | OpenAI-compatible chat call for one subjective answer | CORE |

Prompt text is in this file. The model defaults to `gpt-4o-mini`.

## `src/lib/admin/` and `src/lib/interviewer/` and `src/lib/student/`

| Path | Purpose | Level |
|---|---|---|
| `src/lib/admin/queries.ts` | Dashboard, monitoring, students, reports | CORE |
| `src/lib/admin/proctoring-analytics.ts` | Review queue query | CORE |
| `src/lib/admin/proctoring-case.ts` | Save a human review | CORE |
| `src/lib/admin/interviews.ts` | Admin interview reads and assignable users | SUPPORTING |
| `src/lib/admin/export.ts` | CSV and printable report | SUPPORTING |
| `src/lib/interviewer/queries.ts` | Interviewer lists | CORE |
| `src/lib/interviewer/lifecycle.ts` | Start and complete an interview | CORE |
| `src/lib/interviewer/room-access.ts` | Who may join a room | CORE |
| `src/lib/interviewer/evaluations.ts` | Evaluation reads | SUPPORTING |
| `src/lib/student/dashboard-queries.ts` | Student home | SUPPORTING |
| `src/lib/student/interview-queries.ts` | Student interview list | SUPPORTING |
| `src/lib/interview-recording/service.ts` | Interview recording lifecycle | CORE |
| `src/lib/search/queries.ts` | Role-scoped header search | SUPPORTING |
| `src/lib/settings/queries.ts` | Settings singleton | SUPPORTING |

## `src/lib/` root files worth knowing

| File | Purpose | Level |
|---|---|---|
| `auth.ts` | Auth.js config and credentials provider | CORE |
| `auth.config.ts` | Edge-safe auth config and role home paths | CORE |
| `auth-guards.ts` | `requireAdmin`, `requireSession`, `ActionError` | CORE |
| `safe-auth.ts` | Page-level role redirect | CORE |
| `db.ts` | Mongoose connection | CORE |
| `mock-data.ts` | Demo problems and interview questions | LEGACY / MOCK |
| `serializers.ts` | Documents to plain JSON for the client | SUPPORTING |
| `debug.ts` | Server log helper. On in development unless `DEBUG_LOGS=false` | SUPPORTING |

## `src/lib/actions/`

Server actions. The browser calls these. They check the session, then talk to MongoDB or an external service.

| File | Owns |
|---|---|
| `auth.ts` | Login, register, OTP, password reset, demo login, logout |
| `exam.ts` | Start, load, save answer, submit, student result |
| `exam-security.ts` | Write and read `SecurityEvent` |
| `exam-recording.ts` | Begin, upload URL, confirm, fail, playback |
| `coding.ts` | Run visible tests, submit hidden tests |
| `assessments.ts` | Admin and student assessment actions |
| `questions.ts` | Question bank |
| `grading.ts` | Admin grading, AI suggestion, proctoring queue, review submit, student result detail |
| `admin.ts` | Monitoring, students, reports, export |
| `interviews-admin.ts` | Create, update, cancel interviews and their notifications |
| `interviewer.ts` | Interviewer dashboard, start, complete, evaluate |
| `interview-recording.ts` | Start, finalize, upload, play interview recordings |
| `notifications.ts` | List, mark read, reminder sweep |
| `certificates-admin.ts` | List, revoke, reinstate |
| `settings.ts` | Load and save platform settings |
| `search.ts` | Header search |

## `src/models/`

One Mongoose model per file. Field-level notes are in `docs/06-DATABASE-MODELS.md`.

| Model | Level |
|---|---|
| `User`, `Assessment`, `Question`, `Attempt`, `Answer`, `Result` | CORE |
| `SecurityEvent`, `ExamRecording`, `CodingSubmission` | CORE |
| `Interview`, `InterviewEvaluation`, `InterviewRecording` | CORE |
| `Certificate`, `Notification`, `ProctoringReview` | CORE |
| `PlatformSettings`, `EmailOtp`, `Counter` | SUPPORTING |

## `src/types/`

Enums shared by models and UI. Important ones: `exam-security.ts` (event names), `exam.ts` (attempt and evaluation status), `assessment.ts`, `interview.ts`, `user.ts`, `eye-gaze.ts`, `exam-recording.ts`.

## `scripts/`

`scripts/seed.ts` creates demo users and sample content. `scripts/verify-*.ts` are manual checks run with `npx tsx`. They are not the app. The map is in `docs/09-DEVELOPER-QUICKSTART.md`.

`scripts/backfill-phase16-certificates.ts` issues certificates for older passing results. Run it on purpose. It is not part of `npm run dev`.

## `docs/`

| File | Purpose |
|---|---|
| `CODE_RUNNER.md` | Existing Judge0 and Piston guide. Still accurate for the runner |
| `PHASE-HISTORY.md` | Old README. Historical. Phase numbers collide with later scripts |
| `01` through `09` | Current developer map |
