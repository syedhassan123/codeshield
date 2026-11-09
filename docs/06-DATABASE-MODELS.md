# Database models

MongoDB through Mongoose. Files are in `src/models/`. Roles are not separate collections. A `User.role` is `admin`, `student`, or `interviewer`.

## Relationship map

```text
User
 ├── student
 │    ├── Attempt
 │    │    ├── Answer
 │    │    ├── CodingSubmission
 │    │    ├── SecurityEvent
 │    │    ├── ExamRecording
 │    │    ├── Result
 │    │    │    └── Certificate
 │    │    └── ProctoringReview
 │    └── Interview (as candidate)
 │         ├── InterviewEvaluation
 │         └── InterviewRecording
 │
 ├── interviewer
 │    └── Interview (as interviewer)
 │
 └── admin
      ├── Assessment
      ├── Question
      └── PlatformSettings (updatedBy)

Assessment
 ├── Question (via questionIds)
 └── Attempt

EmailOtp  → User
Notification → User
Counter   → code sequences (ASM-201 and similar)
```

## User

Purpose: one account for every role.

Key fields: `email`, `passwordHash`, `name`, `role`, `status` (`active`, `pending`, `suspended`), `course`, `year`, `emailVerified`, `otpLoginVerifiedAt`, `faceVerifiedAt`.

Relations: referenced by almost every other model.

Used by: auth, directories, assignment checks.

## EmailOtp

Purpose: hashed one-time codes.

Key fields: `userId`, `email`, `purpose`, `codeHash`, `expiresAt`, `attempts`, `maxAttempts`, `consumedAt`, `lastSentAt`.

Relations: `userId` → `User`.

Used by: `src/lib/otp/service.ts`. Registration and password reset use different purposes so they do not invalidate each other.

## Assessment

Purpose: an exam definition.

Key fields: `code`, `title`, `type` (`mcq`, `subjective`, `coding`, `mixed`), `status` (`draft`, `scheduled`, `published`, `completed`), `durationMin`, `totalMarks`, `questionIds`, `visibility` (`all` or `assigned`), `assignedStudentIds`, `scheduledAt`, `publishedAt`, `security`, `passThreshold`, `createdBy`.

`security` holds `requireCamera`, `requireFullscreen`, `blockCopyPaste`, `monitorTabSwitching`, `requireFaceDetection`, `requireHeadMonitoring`.

There is no end or deadline field. `scheduledAt` is the start hint used by reminders.

Relations: questions by id. Attempts point back.

Used by: admin assessment screens, student catalog, exam start, reminders.

## Question

Purpose: one MCQ, subjective, or coding item.

Key fields: `code`, `prompt`, `type`, `category`, `difficulty`, `points`, `explanation`, `options`, `correctOptionKey`. Coding also has `constraints`, `examples`, `timeLimitMs`, `memoryLimitMb`, `codingLanguages`, `starterCode`, `testCases` (`input`, `expectedOutput`, `isHidden`, `weight`).

Relations: `createdBy` → `User`. Assessments store the ids.

Used by: question bank, exam session, AI rubric (`explanation`), coding runner.

## Attempt

Purpose: one student sitting one assessment.

Key fields: `studentId`, `assessmentId`, `status` (`in_progress`, `submitted`, `expired`), `startedAt`, `expiresAt`, `submittedAt`, `durationMin`, `assessmentTitle`, `totalMarks`, `resultId`.

Relations: unique in-progress pair of student and assessment. `resultId` → `Result`.

Used by: exam session, finalization, proctoring, recording.

## Answer

Purpose: the student's current response while the attempt is open.

Key fields: `attemptId`, `studentId`, `questionId`, `selectedOptionKey`, `textAnswer`.

Relations: attempt and question.

Used by: `saveAnswerAction`. The graded snapshot lives on `Result.questions`, not only here.

## Result

Purpose: the official score row. One per attempt.

Key fields: `attemptId`, `studentId`, `assessmentId`, section scores (`objective`, `subjective`, `coding`), `subjectivePendingCount`, `finalScore`, `totalMarks`, `evaluationStatus`, `questions[]`, `submittedAt`, `finalizedReason`, `evaluationCompletedAt`.

Each question snapshot includes `awardedPoints`, `evalStatus`, the answer, `feedback`, `gradedBy`, and coding pass counts.

Relations: unique on the attempt. Certificate points at `resultId`.

Used by: student results, admin grading, certificates, analytics.

## CodingSubmission

Purpose: one run or one submit for a coding question.

Key fields: `studentId`, `attemptId`, `assessmentId`, `questionId`, `language`, `sourceCode`, `kind` (run vs submit), `status`, `passedTests`, `totalTests`, `score`, `maxScore`, `visibleResults`, `finalized`.

Relations: attempt and question. A partial unique index keeps one finalized submit.

Used by: `src/lib/actions/coding.ts`. Hidden expected outputs are not stored in `visibleResults`.

## SecurityEvent

Purpose: one proctoring observation.

Key fields: `attemptId`, `userId`, `assessmentId`, `eventType`, `severity`, `timestamp`, `metadata`.

Event names are the list in `src/types/exam-security.ts` (clipboard, tab, camera, face, head, eye).

Relations: attempt. Risk is not stored on this document.

Used by: exam hooks, admin monitoring, evidence and risk.

## ExamRecording

Purpose: the webcam file for an attempt.

Key fields: `attemptId`, `userId`, `assessmentId`, `storageKey`, `storageProvider` (`local` or `s3`), `mimeType`, `durationSeconds`, `fileSizeBytes`, `startedAt`, `endedAt`, `status` (`RECORDING`, `UPLOADING`, `READY`, `FAILED`), `errorMessage`.

Relations: attempt. One active `RECORDING` row per attempt.

Used by: `use-exam-recording.ts` and admin playback.

## ProctoringReview

Purpose: the human decision for one attempt. Separate from the risk score.

Key fields: `attemptId` (unique), `version`, `decision` (`CLEARED`, `FLAGGED`, `NEEDS_FOLLOW_UP`), `note`, `reviewerId`, `reviewedAt`, `history[]` of previous decisions.

Relations: attempt and the admin user. No review document means unreviewed.

Used by: `src/lib/admin/proctoring-case.ts` and the results queue.

## Certificate

Purpose: a passing result the student can show.

Key fields: `studentId`, `resultId` (unique), `attemptId`, `assessmentId`, `assessmentTitle`, `score`, `passThreshold`, `certificateSerial`, `issuedAt`, `status`, `revokedAt`, `revokedBy`, `revokedReason`.

Relations: one certificate per passing result, so a retake can create another.

Used by: issue, student pages, public verify, admin revoke. Public verify must not return `revokedReason`.

## Interview

Purpose: a scheduled live interview.

Key fields: `candidateId`, `interviewerId`, `createdBy`, `title`, `type` (`Coding`, `Technical`, `HR`), `scheduledAt`, `durationMin`, `status` (`scheduled`, `in_progress`, `completed`, `cancelled`), `meetingUrl`.

Relations: candidate and interviewer are both `User` ids. Room name is derived from `_id`, not stored as a LiveKit id.

Used by: admin scheduling, both portals, reminders.

## InterviewEvaluation

Purpose: the interviewer's score after a completed interview.

Key fields: `interviewId` (one evaluation), `interviewerId`, `candidateId`, `score`, `notes`, `status`, `submittedAt`.

Relations: interview. A second submit does not create a second row.

Used by: `submitInterviewEvaluationAction`.

## InterviewRecording

Purpose: the interview media file.

Key fields: `interviewId`, `status`, `mode`, `egressId`, `storageKey`, `storageProvider`, `mimeType`, `startedAt`, `endedAt`, `sizeBytes`, `errorMessage`.

Relations: interview. Playback is interviewer or admin only.

Used by: `src/lib/interview-recording/service.ts`.

## Notification

Purpose: one in-app message for one user.

Key fields: `userId`, `type`, `title`, `message`, `link`, `read`, `readAt`, `dedupeKey`.

Types: `CERTIFICATE_ISSUED`, `CERTIFICATE_REVOKED`, `RESULT_READY`, `INTERVIEW_SCHEDULED`, `INTERVIEW_RESCHEDULED`, `INTERVIEW_CANCELLED`, `INTERVIEW_REMINDER`, `ASSESSMENT_ASSIGNED`, `ASSESSMENT_REMINDER`.

Relations: `userId` only. Metadata is not a full interview or assessment document. `dedupeKey` is unique and sparse.

Used by: `src/lib/notifications/` and the header bell.

## PlatformSettings

Purpose: one global settings document (`key: "global"`).

Key fields: `organizationName`, `organizationDomain`, `contactEmail`, `security`, `notifications`, `branding`, `updatedBy`.

Wired into new assessments: `enforceFaceVerification`, `blockTabSwitching`, `disableCopyPaste`.

Stored only: `detectDevTools`, `autoSubmitAfterViolations`, `allowPasteInCodingTest`, `emailAlerts`, `smsAlerts`, `webhookIntegrations`, `slackNotifications`, branding colors.

Used by: `/admin/settings` and `createAssessmentAction`.

## Counter

Purpose: incrementing sequences for human-readable codes.

Used by: assessment and question create.
