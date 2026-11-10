# Feature architecture

Each section is the path a change actually takes. Server actions live in `src/lib/actions/`. Models live in `src/models/`.

## Authentication

```text
auth-panel.tsx
        ↓
loginAction / registerAction / demoLoginAction
        ↓
src/lib/auth.ts  (Auth.js credentials)
        ↓
User
        ↓
OTP when registering or resetting a password
        ↓
src/lib/otp/service.ts → src/lib/otp/email.ts → SMTP or server log
        ↓
EmailOtp
```

Password reset does not mark the email verified and does not sign the user in. Demo login is on in development unless `ALLOW_DEMO_LOGIN=false`. In production it stays off unless `ALLOW_DEMO_LOGIN=true`.

`/verify-face` does not call MediaPipe.

## Assessment authoring

```text
assessments-manager-client.tsx
assessment-detail-client.tsx
        ↓
createAssessmentAction / updateAssessmentAction / setAssessmentStatusAction
        ↓
Assessment + Question
        ↓
notifyAssessmentAssigned (only newly added student ids)
        ↓
Notification
```

New assessments copy security defaults from `PlatformSettings` when the form does not send a security object. The create form has no per-assessment security UI, so those defaults matter.

Publishing requires at least one question (`setAssessmentStatusAction`).

## Exam attempt

```text
/student/exam/[id]
        ↓
exam-gate-client.tsx
        ↓
startExamAction
        ↓
Attempt  (one in-progress attempt per student and assessment)
        ↓
/student/exam/session/[attemptId]
        ↓
exam-session-client.tsx
        ↓
saveAnswerAction → Answer
submitExamAction → finalizeAttempt
        ↓
Result
        ↓
issueCertificateIfEligible → Certificate
notifyResultReady → Notification
```

The server owns the deadline (`Attempt.expiresAt`). Submitting twice is safe: finalization is idempotent. Subjective questions stay pending until an admin grades them. MCQ and coding can complete in `finalizeAttempt`.

## Coding inside an exam

```text
ExamCodingPanel
        ↓
runCodingVisibleAction     visible tests only, returns case messages
submitCodingAction         hidden tests, score only
        ↓
load coding context (student owns the attempt and the question is on it)
        ↓
src/lib/coding/runner.ts
        ↓
Judge0 or Piston
        ↓
src/lib/coding/evaluate.ts
        ↓
CodingSubmission
        ↓
Result coding score when the attempt is finalized
```

Run is cooled down so a double click does not fire two sandbox jobs. Hidden inputs and expected outputs are not returned to the browser. Languages are pinned in `src/lib/coding/config.ts`: python, javascript, java, cpp.

`/student/coding` does not use this path.

## Proctoring collection

```text
exam-session-client.tsx
        ↓
use-face-detection          FaceDetector, face count
use-head-pose-monitoring    FaceLandmarker, head orientation
use-eye-gaze-monitoring     same landmarks, gaze direction
use-exam-security           tab, blur, fullscreen, clipboard
use-exam-recording          camera file
        ↓
MediaPipe in the browser (face and head and gaze)
        ↓
recordExamSecurityEventAction
        ↓
SecurityEvent
```

Face and head and gaze run only when the assessment security flags ask for them. Events are debounced in the hooks (`FACE_EVENT_COOLDOWN_MS`, `HEAD_EVENT_COOLDOWN_MS`). The database stores the event type, severity, and time. It does not store landmark coordinates.

### Face, head, and eyes

```text
Camera
  → FaceDetector          src/lib/face/detector.ts
  → FaceLandmarker        src/lib/face/head-pose-detector.ts
       → head orientation src/lib/face/head-pose-orientation.ts
       → eye gaze         src/lib/face/eye-gaze-estimator.ts
  → warning timers        head-pose hook, eye-gaze-warning.ts
  → overlay               proctoring-head-warning-overlay.tsx
  → SecurityEvent
```

Head warning starts after 5 seconds past 25 degrees (`head-pose-constants.ts`). Prolonged looking away is 10 seconds. Eye-away events use lower risk points until calibration exists (`EYE_GAZE_AWAY` is 2 points, prolonged is 4).

### From events to an admin decision

```text
SecurityEvent
        ↓
evidence.ts + head-eye-fusion.ts + correlation.ts
        ↓
risk.ts   (derived, not stored on the attempt)
        ↓
analyze.ts + summary.ts
        ↓
/admin/results and /admin/results/[attemptId]
        ↓
submitProctoringReviewAction
        ↓
ProctoringReview   (CLEARED, FLAGGED, or NEEDS_FOLLOW_UP)
```

Absence of a `ProctoringReview` means unreviewed. Review does not edit `SecurityEvent` rows and does not change the exam score. In-progress attempts cannot be reviewed. The student result page does not include the review or the risk score.

Head and eye events that agree inside a 20-second window are one incident in the derived report.

## Exam recording

```text
Camera + microphone
        ↓
use-exam-recording.ts
        ↓
MediaRecorder chunks
        ↓
stop, then the final dataavailable
        ↓
Blob
        ↓
beginExamRecordingAction          creates ExamRecording (RECORDING)
getExamRecordingUploadUrlAction   local token URL, or S3 PUT URL
        ↓
PUT /api/student/exam-recordings/[id]/upload
   or browser PUT to S3
        ↓
confirmExamRecordingUploadAction  READY
        ↓
ExamRecording
```

Failure calls `markExamRecordingFailedAction` and logs `RECORDING_UPLOAD_FAILED`. Submit still finishes. One active recording row is kept per attempt. Upload retries up to 3 times in the hook. Object keys look like `exams/{attemptId}/{timestamp}-{nonce}.webm`.

Admin playback: `getRecordingPlaybackUrlAction` then either a signed URL or `/api/admin/recordings/[recordingId]`.

## Interview

```text
admin-interviews-client.tsx
        ↓
createInterviewAction / updateInterviewAction / cancelInterviewAction
        ↓
Interview
        ↓
notifyInterviewScheduled / Rescheduled / Cancelled
        ↓
Student bell and interviewer bell
        ↓
/interviewer/lobby/[id]
        ↓
/interviewer/room/[id]
        ↓
GET /api/interviews/[id]/room-token
        ↓
LiveKit room interview:{id}
        ↓
startInterviewAction after the room connects
        ↓
completeInterviewAction
        ↓
submitInterviewEvaluationAction
        ↓
InterviewEvaluation
```

Cancelled and completed interviews are not joinable. Tokens last 15 minutes. The hook fetches a new one on reconnect. Recording failure does not block completion.

The room's question cards are static mock data.

## Interview recording

```text
use-interview-recording.ts  (interviewer only)
        ↓
startInterviewRecordingAction
        ↓
If S3 is configured: LiveKit egress → S3 key interviews/{id}/…
Else: MediaRecorder → uploadInterviewRecordingAction → local or S3
        ↓
InterviewRecording  RECORDING → UPLOADING → READY or FAILED
        ↓
Playback for the owning interviewer or an admin
```

## Notifications

```text
Product write succeeds (interview, assessment, result, certificate)
        ↓
src/lib/notifications/events.ts
        ↓
createNotification (dedupe key, never throws)
        ↓
Notification for one userId
        ↓
workspace-shell polls getNotificationsAction every 30s (read only)
        ↓
Click → mark read → in-app link
```

Reminders (interview 30 min, assessment start 1 hour) come from
`POST /api/cron/notification-reminders` → `processDueReminders`.
See `docs/REMINDER-SCHEDULER.md`. There is no queue and no email for these events.

## Certificates

```text
Result.evaluationStatus becomes completed and the score passes
        ↓
issueCertificateIfEligible
        ↓
Certificate (unique on resultId, serial CERT-{year}-{random})
        ↓
/student/certificates/[id]  print
/verify/[serial]             public
/admin/certificates          revoke or reinstate
```

Pass mark is `Assessment.passThreshold` when set, otherwise `CERTIFICATE_DEFAULT_PASS_THRESHOLD` (default 60).

## Admin monitoring

```text
/admin/monitoring
        ↓
EventSource
        ↓
GET /api/admin/monitoring/stream
        ↓
requireAdmin once
        ↓
re-read monitoring queries about every 5s
        ↓
event name "monitoring"
```

Query failures use a `monitoring_error` event so the browser does not treat them as a dropped socket.

## If you change this, also test that

| You change | Also check |
|---|---|
| `SECURITY_EVENT_TYPES` in `src/types/exam-security.ts` | `exam-security.ts` action, hooks that emit the type, `risk.ts` points, evidence labels, verify scripts for face, head, eyes, and evidence |
| `src/lib/proctoring/risk.ts` weights or bands | Admin results queue, attempt report, `verify-phase11-ai-proctoring.ts`, `verify-phase18-global-proctoring.ts`. Do not expect the student result to show the score |
| `ProctoringReview` decisions | `case-review.ts`, `proctoring-case.ts`, results UI, `verify-phase19-proctoring-review.ts` |
| `finalizeAttempt` | Submit, expire, certificate issue, `RESULT_READY` notification, recording leftover rows |
| `src/lib/coding/runner.ts` or `config.ts` | Run, submit, hidden tests, `docs/CODE_RUNNER.md`, `verify-phase12-coding.ts` |
| `src/lib/storage/index.ts` key shape | Exam upload route, interview recording, playback routes. Existing files keep their old keys |
| LiveKit room name or token grants | Token route, `use-interview-livekit-room.ts`, lobby, `verify-phase15-video-interview.ts` |
| `Notification` types or `read` / `readAt` | `events.ts`, bell UI, `verify-phase20-notifications.ts`. Certificate and result callers must keep working |
| `User.role` or auth guards | All three layouts, token route, grading actions |
| Assessment `assignedStudentIds` | Student catalog, reminders, assignment notification dedupe |
