# Data flows

These are the paths that matter when you are debugging a real user action. File names match `docs/02-FOLDER-FILE-MAP.md`.

## Assessment flow

```text
Admin
  → question-bank-client / assessments-manager-client
  → Question and Assessment saved
  → publish (status published)
  → student opens /student/assessments
  → /student/exam/[id]
  → startExamAction
  → Attempt
  → exam-session-client autosaves Answer rows
  → submitExamAction
  → finalizeAttempt
  → Result
  → certificate if the score passes
  → student opens /student/exam/result/[attemptId]
```

If the paper has subjective questions, `evaluationStatus` stays pending. An admin opens `/admin/results/[attemptId]`, calls `gradeQuestionAction`, then `completeEvaluationAction`. That second step can issue the certificate and the result notification.

The server clock is `Attempt.expiresAt`. An overdue attempt is expired when it is touched, not by a separate cron.

## Coding flow

```text
Student, inside the exam session
  → ExamCodingPanel
  → Run: runCodingVisibleAction
       visible tests only
       messages returned
  → Submit: submitCodingAction
       hidden tests included
       inputs and expected outputs stay on the server
  → runner.ts
  → Judge0 or Piston
  → evaluate.ts writes CodingSubmission
  → finalizeAttempt copies the score onto Result
```

A failed sandbox call does not invent a score. Compile errors stop the rest of the cases. See `docs/CODE_RUNNER.md`.

## Proctoring flow

```text
Camera and browser
  → face / head / eye hooks and use-exam-security
  → recordExamSecurityEventAction
  → SecurityEvent
  → evidence.ts
  → head-eye-fusion.ts (same 20 second window counts once)
  → risk.ts (0–100, derived)
  → summary.ts (rule text)
  → /admin/results queue
  → admin submits ProctoringReview
```

Students never receive this score. The review decision does not change `Result`.

## Recording flow

```text
getUserMedia
  → MediaRecorder in use-exam-recording.ts
  → chunks kept in the browser
  → stop, wait for the last dataavailable
  → Blob
  → beginExamRecordingAction (ExamRecording status RECORDING)
  → upload
       local: PUT /api/student/exam-recordings/[id]/upload
       s3: signed PUT
  → confirmExamRecordingUploadAction
  → status READY
  → admin playback
```

If upload fails, status becomes `FAILED`, a security event is stored, and exam submit still returns the result. Leftover `RECORDING` or `UPLOADING` rows are closed when the attempt finalizes.

## Interview flow

```text
Admin
  → createInterviewAction
  → Interview status scheduled
  → notifications to candidate and interviewer
  → both open /interviewer/lobby/[id]
  → /interviewer/room/[id]
  → room token
  → LiveKit room interview:{id}
  → startInterviewAction (in_progress) after connect
  → interviewer may record
  → completeInterviewAction (completed)
  → submitInterviewEvaluationAction
  → InterviewEvaluation
```

Reschedule and cancel write the interview first, then notify. Reminders for cancelled or completed interviews are not created.

## Notification flow

```text
Successful product write
  → events.ts builds title, message, link, dedupeKey
  → Notification
  → bell poll (about 30 seconds) calls getNotificationsAction
  → processDueReminders adds due reminders if missing
  → user clicks
  → markNotificationReadAction sets read and readAt
  → router pushes the in-app link
```

If nobody has the app open during a reminder window, that reminder is not created later. There is no background cron.

## Certificate flow

```text
Result completed and score >= pass threshold
  → issueCertificateIfEligible
  → Certificate
  → student prints /student/certificates/[id]
  → public /verify/[serial]
  → admin may revoke
  → student list hides revoked rows
  → student gets CERTIFICATE_REVOKED
```

## Admin monitoring flow

```text
Browser EventSource
  → GET /api/admin/monitoring/stream
  → every few seconds, read active attempts and recent SecurityEvents
  → push a monitoring event
  → admin-monitoring-client renders it
```

This is not the proctoring risk engine. It is a live operational feed.

## AI suggestion flow

```text
Admin opens one subjective answer
  → suggestSubjectiveGradeAction
  → subjective-grade.ts
  → OpenAI-compatible API
  → suggested marks and feedback returned to the form
  → nothing is saved until gradeQuestionAction
```
