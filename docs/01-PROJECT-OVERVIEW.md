# Project overview

CodeShield lets a school or hiring team assign assessments, watch them under browser proctoring, grade them, and run live interviews. Almost all product data lives in MongoDB. The browser handles the camera. The server handles scores, permissions, and external calls.

## Roles

| Role | Who | Main surfaces |
|---|---|---|
| Admin | Staff who create content and review integrity | `/admin/*` |
| Student | Candidate taking an exam or interview | `/student/*`, plus the shared interview lobby |
| Interviewer | Person conducting the live interview | `/interviewer/*` |
| Public | Anyone with a certificate serial | `/`, `/verify`, `/forgot-password` |

Auth is Auth.js credentials. Sessions are JWTs. Guards live in `src/lib/auth-guards.ts` and `src/lib/safe-auth.ts`.

## Product areas

### Authentication

What it does: register, email OTP, login, demo login, password reset, sign out.

Who uses it: everyone.

Main entry: `src/components/landing/auth-panel.tsx` on `/`, actions in `src/lib/actions/auth.ts`.

Depends on: MongoDB `User` and `EmailOtp`, SMTP when configured, `AUTH_SECRET`.

`/verify-face` is a visual placeholder. It does not run MediaPipe.

### Student portal

What it does: dashboard, published assessments, results, certificates, profile, interview list.

Who uses it: students.

Main entry: `src/app/student/layout.tsx` and `src/app/student/page.tsx`.

Depends on: `src/lib/student/dashboard-queries.ts`.

`/student/coding` is still mock data and is not in the nav.

### Admin portal

What it does: question bank, assessments, students, results, proctoring review, certificates, interviews, live monitoring, analytics, reports, settings.

Who uses it: admins.

Main entry: `src/app/admin/layout.tsx`.

Depends on: `src/lib/actions/admin.ts`, `src/lib/admin/queries.ts`, and the feature-specific action files.

### Interviewer portal

What it does: assigned interviews, candidates drawn from those interviews, evaluations, lobby, and live room.

Who uses it: interviewers. Students also open the lobby and room for their own interview.

Main entry: `src/app/interviewer/layout.tsx`, actions in `src/lib/actions/interviewer.ts`.

Depends on: `Interview`, `InterviewEvaluation`, LiveKit when video is configured.

### Assessments

What it does: create, edit, assign, schedule, and publish exams made of MCQ, subjective, and coding questions.

Who uses it: admins write them. Students see published ones they are allowed to take (`visibility: all` or their id in `assignedStudentIds`).

Main entry: `src/lib/actions/assessments.ts`, UI `src/components/admin/assessments-manager-client.tsx`.

Depends on: `Assessment`, `Question`, `Counter` (codes such as `ASM-201`).

### Exam engine

What it does: start an attempt, autosave answers, enforce the server timer, submit, and finalize.

Who uses it: students.

Main entry: `src/app/student/exam/[id]/page.tsx` (gate) and `src/app/student/exam/session/[attemptId]/page.tsx`.

Depends on: `src/lib/actions/exam.ts`, `src/lib/exam/finalize.ts`, `src/lib/exam/access.ts`.

### Coding questions

What it does: run visible tests and submit hidden tests inside an exam attempt. Student code is sent to Judge0 or Piston. It does not run inside Next.js.

Who uses it: students during an exam. Admins author the tests on the question.

Main entry: `src/components/exam/exam-coding-panel.tsx` and `src/lib/actions/coding.ts`.

Depends on: `src/lib/coding/runner.ts`. Details: `docs/CODE_RUNNER.md`.

The standalone practice page is mock. See Feature status.

### Proctoring

What it does: record browser events (tab, copy, fullscreen, camera) and vision events (face count, head pose, eye gaze), then turn them into evidence and a risk score for admins.

Who uses it: the student browser collects events. Admins review them. Students do not see the risk score.

Main entry: `src/components/exam/exam-session-client.tsx`.

Depends on: MediaPipe, `SecurityEvent`, `src/lib/proctoring/risk.ts`.

Risk is computed when an admin reads the attempt. It is not a stored grade, and it does not fail the student.

### Face detection

What it does: count faces in the webcam frame (none, one, many).

Who uses it: the exam session, when the assessment requires face detection.

Main entry: `src/hooks/use-face-detection.ts` and `src/lib/face/detector.ts`.

Depends on: MediaPipe FaceDetector, loaded in the browser from a CDN.

### Head pose

What it does: estimate whether the head is turned left, right, up, or down, and emit looking-away warnings.

Who uses it: the exam session, when head monitoring is enabled.

Main entry: `src/hooks/use-head-pose-monitoring.ts` and `src/lib/face/head-pose-detector.ts`.

Depends on: MediaPipe FaceLandmarker.

### Eye gaze

What it does: estimate LEFT, RIGHT, DOWN, or CENTER from the same face landmarks, then apply warning timing.

Who uses it: the exam session alongside head pose.

Main entry: `src/lib/face/eye-gaze-estimator.ts` and `src/hooks/use-eye-gaze-monitoring.ts`.

Depends on: the FaceLandmarker sample from head-pose detection. Eye weights in the risk score are conservative. Webcam calibration is still pending. The debug panel renders only outside production.

### Exam recording

What it does: record the exam webcam with `MediaRecorder`, upload the blob, and store an `ExamRecording` row.

Who uses it: students during the exam. Admins play it back from the attempt.

Main entry: `src/hooks/use-exam-recording.ts`.

Depends on: `src/lib/storage/index.ts` (local disk or S3).

A recording failure does not block exam submit.

### S3 storage

What it does: optional object storage for exam and interview recordings. The default provider is local files under `.data/recordings`.

Who uses it: recording upload and playback.

Main entry: `src/lib/storage/index.ts`.

Depends on: `STORAGE_PROVIDER` and the `S3_*` variables when `s3` is selected.

### AI grading assist

What it does: suggest marks and short feedback for one subjective answer. The admin must still press Save grade. Suggestions are not stored.

Who uses it: admins on an attempt detail page.

Main entry: `suggestSubjectiveGradeAction` in `src/lib/actions/grading.ts`, client call inside `src/lib/ai/subjective-grade.ts`.

Depends on: `AI_GRADING_API_KEY`. If it is missing, manual grading still works.

This is not a general chatbot, and it does not write the proctoring summary. That summary is rule-based.

### Results and grading

What it does: auto-score MCQ and coding, leave subjective items for an admin, then complete the evaluation and optionally issue a certificate.

Who uses it: students see their result. Admins grade and review.

Main entry: `src/lib/exam/finalize.ts` and `src/lib/actions/grading.ts`.

Depends on: `Result`, `Answer`, `CodingSubmission`.

### Interview scheduling

What it does: create, reschedule, reassign, and cancel interviews.

Who uses it: admins. Students and interviewers see their own rows.

Main entry: `src/lib/actions/interviews-admin.ts`.

Depends on: `Interview`. Notifications are created after the write succeeds.

### Live video interviews

What it does: put the student and interviewer in one LiveKit room named `interview:{interviewId}`.

Who uses it: the assigned student and interviewer.

Main entry: `src/app/api/interviews/[id]/room-token/route.ts` and `src/hooks/use-interview-livekit-room.ts`.

Depends on: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Without them, the room cannot connect.

The question list inside the room still comes from `src/lib/mock-data.ts`.

### Interview recording

What it does: record the interview. Prefer LiveKit room-composite egress when S3 is configured. Otherwise the interviewer uses `MediaRecorder` and the same storage helper.

Who uses it: the interviewer starts and stops it. Students do not.

Main entry: `src/hooks/use-interview-recording.ts` and `src/lib/interview-recording/service.ts`.

Depends on: `InterviewRecording`, LiveKit egress, storage.

### Notifications

What it does: in-app bell items for certificates, results, interview schedule changes, assessment assignment, and upcoming reminders.

Who uses it: the user the event belongs to. Admins do not see other people's bells.

Main entry: `src/components/layout/workspace-shell.tsx` and `src/lib/notifications/events.ts`.

Depends on: `Notification`. There is no email or push channel. Reminders run when someone polls the bell (about every 30 seconds), not on a cron.

### Reports and analytics

What it does: admin dashboard charts, a filterable report with CSV and print, a live monitoring feed, and a proctoring review queue.

Who uses it: admins.

Main entry: `src/app/admin/page.tsx`, `src/app/admin/analytics/page.tsx`, `src/app/admin/reports/page.tsx`, `src/app/admin/results/page.tsx`, `src/app/admin/monitoring/page.tsx`.

Depends on: MongoDB queries in `src/lib/admin/`. Monitoring uses server-sent events, not WebSockets.

### Certificates

What it does: issue a certificate when a completed result meets the pass threshold, let the student print it, let an admin revoke it, and let the public check a serial.

Who uses it: students, admins, public visitors.

Main entry: `src/lib/certificates/issue.ts`.

Depends on: `Certificate`. No PDF service. Print uses the browser.

### Platform settings

What it does: store organization, branding, notification, and security preferences.

Who uses it: admins at `/admin/settings`.

Main entry: `src/lib/actions/settings.ts`.

Three security toggles become the default for new assessments: face verification, tab monitoring, and copy/paste blocking. Email, SMS, Slack, webhooks, dev-tools detection, violation auto-submit, and coding-paste blocking are stored and not enforced.

## Feature status

| Feature | Status |
|---|---|
| Auth, exams, MCQ grading, results | PRODUCTION |
| Coding runner inside an exam | PRODUCTION, needs a private Judge0 or Piston in production |
| Face count and head-pose warnings | PRODUCTION, browser models load from a public CDN |
| Eye gaze | PARTIAL. Logic is in the exam, calibration against a real webcam is still pending, risk weights stay low |
| Exam recording | PRODUCTION for local disk. S3 path exists and needs bucket CORS for direct upload |
| LiveKit room | IMPLEMENTED, NEEDS REAL-WORLD QA with real credentials |
| LiveKit egress | PARTIAL. Requires S3. Default local storage uses the browser recorder instead |
| AI subjective suggestion | PARTIAL. Optional, not persisted, manual save is the real write |
| In-app notifications and reminders | PRODUCTION for in-app. Email, push, and cron are DEFERRED |
| SMTP | PRODUCTION for OTP and password reset only, when SMTP is set. Otherwise the code is logged on the server in development |
| Certificate verify and revoke | PRODUCTION |
| Admin monitoring SSE | PRODUCTION |
| `/student/coding` and `/student/code/[id]` | MOCK |
| `/verify-face` | MOCK |
| Interview room question list | MOCK (`interviewQuestions` from `src/lib/mock-data.ts`) |
| Settings: email/SMS/Slack/webhooks, dev-tools, auto-submit, coding paste block | DEFERRED (stored only) |
| Assessment deadline reminders | DEFERRED. Assessments have `scheduledAt` and no end field |
| Proctoring risk | PRODUCTION as decision support. It does not change the exam score |

## Numbering warning

Older README phases and later verification scripts reuse the same numbers for different work. `docs/PHASE-HISTORY.md` is the archive. Script names in `docs/09-DEVELOPER-QUICKSTART.md` are the ones that exist on disk.
