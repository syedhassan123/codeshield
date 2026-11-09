# Pages and routes

Layouts:

- `/admin/*` uses `src/app/admin/layout.tsx` (admin only).
- `/student/*` uses `src/app/student/layout.tsx` (student only). Exam, code, and certificate detail routes hide the normal chrome.
- `/interviewer/*` uses `src/app/interviewer/layout.tsx`. The `(portal)` group is the normal interviewer pages. Lobby and room are fullscreen. A student may open lobby and room only for an interview they are assigned to. That check is in `src/lib/interviewer/room-access.ts`, not in the layout role.

Data for most pages is loaded in the server `page.tsx` or by a server action. Client files own forms, cameras, and charts.

## Public

| Route | Purpose | Role | Entry | Data |
|---|---|---|---|---|
| `/` | Landing, login, register, demo login | Public | `src/app/page.tsx`, `auth-panel.tsx` | `loginAction`, `registerAction`, `demoLoginAction` |
| `/verify-otp` | Enter the registration code | Public, then student | `verify-otp-client.tsx` | `verifyRegistrationOtpAction` |
| `/verify-face` | Animated face check. Does not use the camera model | Signed-in | `verify-face-client.tsx` | Sets `faceVerified` on the session only |
| `/forgot-password` | Request and confirm a reset code | Public | `forgot-password-client.tsx` | `requestPasswordResetAction`, `confirmPasswordResetAction` |
| `/verify` | Search a certificate serial | Public | `src/app/verify/page.tsx` | `src/lib/certificates/public.ts` |
| `/verify/[serial]` | Show a valid, missing, or revoked certificate | Public | `src/app/verify/[serial]/page.tsx` | Same. Does not return email or revoke notes |

Auth.js HTTP handler: `/api/auth/[...nextauth]` → `src/app/api/auth/[...nextauth]/route.ts`.

## Student

| Route | Purpose | Entry | Data source | Important actions |
|---|---|---|---|---|
| `/student` | Dashboard: stats, upcoming work, recent activity | `src/app/student/page.tsx` | `src/lib/student/dashboard-queries.ts` | Links into assessments and interviews |
| `/student/assessments` | Published exams this student may open | `src/app/student/assessments/page.tsx` | `Assessment` filtered by status and visibility | Open `/student/exam/[id]` |
| `/student/exam/[id]` | Rules, camera pre-check, start | `page.tsx` + `exam-gate-client.tsx` | `findPublishedAssessmentForStudent` | `startExamAction` |
| `/student/exam/session/[attemptId]` | The live exam | `page.tsx` + `exam-session-client.tsx` | `loadExamSessionAction` | `saveAnswerAction`, `submitExamAction`, coding, proctoring, recording |
| `/student/exam/result/[attemptId]` | Score after submit. No risk score | `page.tsx` + `exam-result-client.tsx` | `getExamResultAction` | — |
| `/student/results` | Past results | `src/app/student/results/page.tsx` | `listStudentResultsAction` | Open a result |
| `/student/interviews` | Interviews where this user is the candidate | `src/app/student/interviews/page.tsx` | `src/lib/student/interview-queries.ts` | Join → `/interviewer/lobby/[id]` |
| `/student/certificates` | Issued certificates | `src/app/student/certificates/page.tsx` | `src/lib/certificates/queries.ts` | Open one certificate |
| `/student/certificates/[id]` | Print view. Other students get 404 | `src/app/student/certificates/[id]/page.tsx` | Certificate owned by the session | `window.print()` |
| `/student/profile` | Profile fields already on the user | `src/app/student/profile/page.tsx` | `User` | — |
| `/student/coding` | Mock problem table. Not linked in the nav | `src/app/student/coding/page.tsx` | `mockCodingProblems` | — |
| `/student/code/[id]` | Mock editor for `twoSumProblem` | `code-editor-client.tsx` | `src/lib/mock-data.ts` | Not the exam runner |

Exam session client also calls, from the browser:

- `runCodingVisibleAction` / `submitCodingAction`
- `recordExamSecurityEventAction`
- recording actions in `src/lib/actions/exam-recording.ts`

## Admin

| Route | Purpose | Entry | Data source | Important actions |
|---|---|---|---|---|
| `/admin` | Counts, charts, recent alerts and assessments | `src/app/admin/page.tsx` | `src/lib/admin/queries.ts` | — |
| `/admin/questions` | Question bank | `question-bank-client.tsx` | `Question` | `createQuestionAction`, `updateQuestionAction`, `deleteQuestionAction` |
| `/admin/assessments` | List and create | `assessments-manager-client.tsx` | `Assessment` | `createAssessmentAction` |
| `/admin/assessments/[id]` | Edit questions, assignment, schedule, publish | `assessment-detail-client.tsx` | One assessment | `updateAssessmentAction`, `setAssessmentStatusAction` |
| `/admin/students` | Student accounts, search, paging | `admin-students-client.tsx` | `listAdminStudentsAction` | — |
| `/admin/results` | Attempts plus proctoring queue | `admin-results-client.tsx` | `listProctoringReviewQueueAction` | Filter by window, risk, review state |
| `/admin/results/[attemptId]` | Answers, grade, AI suggestion, recording, risk, human review | `admin-attempt-detail-client.tsx` | `getAdminAttemptDetailAction` | `gradeQuestionAction`, `suggestSubjectiveGradeAction`, `completeEvaluationAction`, `submitProctoringReviewAction` |
| `/admin/monitoring` | Active exams and a live event feed | `admin-monitoring-client.tsx` | SSE `GET /api/admin/monitoring/stream` | Reconnects on its own |
| `/admin/analytics` | Weekly scores, skills, growth, languages, security trend | `src/app/admin/analytics/page.tsx` | Analytics queries used by the page | — |
| `/admin/reports` | Filtered attempt report | `admin-reports-client.tsx` | `listAdminReportsAction` | `exportAdminReportsCsvAction`, `exportAdminReportsPdfAction` |
| `/admin/interviews` | Schedule, reschedule, cancel | `admin-interviews-client.tsx` | `src/lib/admin/interviews.ts` | `createInterviewAction`, `updateInterviewAction`, `cancelInterviewAction` |
| `/admin/certificates` | Search, revoke, reinstate | `admin-certificates-client.tsx` | `listAdminCertificatesAction` | `revokeCertificateAction`, `reinstateCertificateAction` |
| `/admin/settings` | Organization and security defaults | `admin-settings-client.tsx` | `PlatformSettings` | `saveAdminSettingsAction` |

Playback of an exam recording uses `GET /api/admin/recordings/[recordingId]` or a signed S3 URL from `getRecordingPlaybackUrlAction`.

## Interviewer

| Route | Purpose | Entry | Data source | Important actions |
|---|---|---|---|---|
| `/interviewer` | Assigned work summary | `src/app/interviewer/(portal)/page.tsx` | `loadInterviewerDashboardAction` | — |
| `/interviewer/interviews` | My interviews | `(portal)/interviews/page.tsx` | `loadInterviewerInterviewsAction` | Open lobby |
| `/interviewer/candidates` | People who appear on my interviews | `(portal)/candidates/page.tsx` | `loadInterviewerCandidatesAction` | — |
| `/interviewer/evaluations` | Pending and submitted evaluations | `(portal)/evaluations/page.tsx` | `loadInterviewerEvaluationsAction` | Open a form |
| `/interviewer/evaluations/[interviewId]` | Score and notes after the interview is completed | `(portal)/evaluations/[interviewId]/page.tsx` | `loadEvaluationFormContextAction` | `submitInterviewEvaluationAction` |
| `/interviewer/lobby/[id]` | Device check, then enter the room | `lobby/[id]/page.tsx`, `lobby-client.tsx` | `loadInterviewForParticipantAction` | Continue to the room |
| `/interviewer/room/[id]` | LiveKit room, recording, end interview | `room/[id]/page.tsx`, `room-client.tsx` | Room token route, LiveKit | `startInterviewAction` after connect, `completeInterviewAction` |

Students join the same lobby and room URLs. The token route rejects everyone except the candidate and the assigned interviewer.

## HTTP routes that are not pages

| Route | Method | Who | What |
|---|---|---|---|
| `/api/auth/[...nextauth]` | Auth.js | Browser | Session cookies |
| `/api/interviews/[id]/room-token` | GET | Candidate or assigned interviewer | LiveKit URL and JWT |
| `/api/interviews/[id]/recording` | GET | Owning interviewer or admin | Playback URL when status is READY. Start and stop use server actions, not this route |
| `/api/interviews/[id]/recording/file` | GET | Owning interviewer or admin | Local recording bytes |
| `/api/student/exam-recordings/[recordingId]/upload` | PUT | Owning student with token | Local recording body |
| `/api/admin/recordings/[recordingId]` | GET | Admin with token | Exam recording bytes |
| `/api/admin/monitoring/stream` | GET | Admin | `text/event-stream`, refresh about every 5 seconds |
