# Services and integrations

Only services the code actually calls are listed. There is no Redis client, no Temporal, and no BullMQ. Vercel is a possible host, not an SDK in this repo.

| Service | Role in CodeShield | Status |
|---|---|---|
| MongoDB | All product data | Required |
| Auth.js | Sessions | Required |
| MediaPipe | Face, head, gaze in the browser | Used during exams. Models come from public URLs |
| Judge0 or Piston | Run student code | Required for coding questions. Default public Judge0 is not for production exams |
| SMTP (Nodemailer) | OTP and password reset | Optional in development |
| S3-compatible storage | Recording objects | Optional. Default is local disk |
| LiveKit | Interview audio and video | Optional until you open a room |
| OpenAI-compatible HTTP API | Subjective grade suggestion | Optional. Manual grading works without it |

## MongoDB

Purpose: users, exams, attempts, proctoring events, interviews, notifications.

Used in: `src/lib/db.ts`, every file in `src/models/`.

Environment: `MONGODB_URI`.

Data flow: server action or route → `connectDB()` → Mongoose → collection.

Notes: the app expects a single connection cache. Monitoring does not use change streams. It polls. Seed with `npm run seed`.

## Auth.js

Purpose: credentials login and JWT session.

Used in:

- `src/lib/auth.ts`
- `src/lib/auth.config.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/components/providers/session-provider.tsx`

Environment: `AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_URL`.

Notes: passwords are bcrypt hashes on `User.passwordHash`. Role homes are chosen in `auth.config.ts`.

## MediaPipe

Purpose: face detection, head pose, and eye gaze during an exam.

Used in:

- `src/lib/face/detector.ts` (FaceDetector)
- `src/lib/face/head-pose-detector.ts` (FaceLandmarker)
- `src/lib/face/eye-gaze-estimator.ts` (pure geometry on landmarks)
- `src/hooks/use-face-detection.ts`
- `src/hooks/use-head-pose-monitoring.ts`
- `src/hooks/use-eye-gaze-monitoring.ts`

Environment: none. Model and WASM URLs are constants.

- WASM: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm` (`src/lib/face/constants.ts`)
- Face detector model: Google-hosted BlazeFace short-range (`FACE_DETECTOR_MODEL_URL`)
- Face landmarker model: `FACE_LANDMARKER_MODEL_URL` in `src/lib/face/head-pose-constants.ts`

Data flow:

```text
Camera
  → FaceDetector          count faces
  → FaceLandmarker        mesh
  → head orientation
  → eye gaze (LEFT / RIGHT / DOWN / CENTER)
  → warning timers
  → SecurityEvent type only
```

Important notes:

- Processing stays in the browser. The GPU delegate is requested.
- No raw eye landmarks are written to MongoDB.
- The exam page needs network access to the CDN and the model host the first time it loads them.
- Eye gaze is implemented. Thresholds are conservative, and real webcam calibration is still pending (`eye-gaze-calibration.ts` is empty in production).
- `/verify-face` does not use MediaPipe.

### Face detection

`getFaceDetector` loads one FaceDetector for the page. `countFacesInVideo` returns a count, or `-1` if the frame is not ready. The hook waits 3 seconds before a no-face event and 2 seconds before a multiple-face event, then cools down for 5 seconds (`src/lib/face/constants.ts`).

### Head pose

`getFaceLandmarker` loads the landmarker. `classifyHeadOrientation` maps the facial matrix to an orientation. Looking away starts at 25 degrees. The soft warning is 5 seconds. Prolonged is 10 seconds. Three episodes in 5 minutes can emit a repeated-looking-away event (`src/lib/face/head-pose-constants.ts`).

### Eye gaze

`estimateEyeGaze` reads left and right eye landmark indexes from `eye-gaze-landmarks.ts` and the thresholds in `eye-gaze-constants.ts`. `eye-gaze-warning.ts` decides when away becomes an event. The head-pose detector also returns a same-frame gaze sample so head and eyes can be fused later. Fusion of stored events is `src/lib/proctoring/head-eye-fusion.ts` (20-second window).

### Warnings

`use-proctoring-head-warning-ux.ts` drives `proctoring-head-warning-overlay.tsx`. `unlockProctoringAlertAudio` in `src/lib/proctoring/alert-audio.ts` plays the sound after a user gesture. Dev-only panels: `eye-gaze-debug-panel.tsx`, `head-pose-debug.ts`, `head-pose-simulation.ts`.

## OpenAI-compatible grading API

This is the only LLM call in the product. Proctoring summaries are rules in `src/lib/proctoring/summary.ts`, not model output.

Where it is initialized: there is no shared SDK client. `src/lib/ai/subjective-grade.ts` calls `fetch` on `{AI_GRADING_BASE_URL}/v1/chat/completions`.

What uses it: the Suggest control on an admin attempt, for one subjective question.

Model: `AI_GRADING_MODEL`, default `gpt-4o-mini`.

Where the prompt lives: `src/lib/ai/subjective-grade.ts`. It sends the question text, the student answer, max marks, and `Question.explanation` as the rubric. It does not send the student name, email, or other answers.

Server action: `suggestSubjectiveGradeAction` in `src/lib/actions/grading.ts`. It requires an admin, rejects MCQ and coding, rejects in-progress attempts and empty answers, and does not write `Result`.

Environment:

- `AI_GRADING_API_KEY` (required for this feature)
- `AI_GRADING_MODEL` (optional)
- `AI_GRADING_BASE_URL` (optional, default `https://api.openai.com`)

Behavior: missing key returns "AI grading is not configured." Timeout is 15 seconds. Suggestions are clamped to the question's max marks. Rate limit is 6 requests per admin per minute, in memory on that server process. The suggestion is not stored.

## Judge0 and Piston

Purpose: execute untrusted student source outside Next.js.

Used in: `src/lib/coding/runner.ts`, called by `src/lib/actions/coding.ts`.

Environment: `CODE_RUNNER_PROVIDER` (`judge0` or `piston`), plus the provider vars in `docs/08-ENVIRONMENT-VARIABLES.md`.

Data flow:

```text
ExamCodingPanel
  → runCodingVisibleAction or submitCodingAction
  → ownership check
  → runner.ts
  → Judge0 or Piston
  → evaluate.ts
  → CodingSubmission
```

Notes: Judge0 submissions set `enable_network: false`. HTTP calls time out. Output is clamped. The full setup, versions, and production warning are in `docs/CODE_RUNNER.md`. Do not point production exams at a public runner you do not control.

## S3-compatible storage

Purpose: store exam and interview recordings. Cloudflare R2 works because the client accepts a custom endpoint.

Where the client is configured: `createS3Provider` in `src/lib/storage/index.ts`. The SDK is imported only when `STORAGE_PROVIDER=s3`.

Upload helper: `getStorageProvider()` then `putObject` or `getSignedPutUrl`.

Key names:

- Exam: `exams/{attemptId}/{timestamp}-{nonce}.webm` (or `mp4` / `bin`)
- Interview: `interviews/{interviewId}/{timestamp}-{nonce}.webm`

Who uses it:

- `src/lib/actions/exam-recording.ts`
- `src/app/api/student/exam-recordings/[recordingId]/upload/route.ts` (local provider path)
- `src/lib/interview-recording/service.ts`
- `src/lib/livekit/egress.ts` (egress output)

Environment: `STORAGE_PROVIDER`, `RECORDINGS_DIR`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`.

Fallback: `STORAGE_PROVIDER` defaults to `local`. Files go under `.data/recordings` (or `RECORDINGS_DIR`). Playback is an authenticated Next route plus an opaque token, not a public URL.

Direct browser upload to S3 needs bucket CORS that allows `PUT` from the app origin. That note is in `.env.example`.

AWS access keys in the env file are the names above. This repo does not use `AWS_ACCESS_KEY_ID`.

## SMTP

Purpose: send a 6-digit code for registration and password reset.

Provider: Nodemailer against any SMTP server.

Initialization: `src/lib/otp/email.ts`, a transporter built per send.

Templates: inline text and HTML in that file. Subjects are "Your CodeShield verification code" and "Your CodeShield password reset code". There is no template directory.

Actions that send mail:

- `sendRegistrationOtpAction`
- password reset inside `requestPasswordResetAction`
- both go through `src/lib/otp/service.ts`

Environment: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (or `SMTP_FROM`).

Failure behavior: if `SMTP_HOST`, `SMTP_USER`, or `SMTP_PASS` is missing, development logs the code on the server and does not throw a missing-mailer error to the browser. Password reset still returns the same public sentence for unknown and suspended emails. The code is never included in the action result. Notification settings in `/admin/settings` do not send email.

## LiveKit

Purpose: real-time student and interviewer audio and video.

Status: implemented in code. A room only connects when the three LiveKit variables are set. Treat a first production room as needs real-world QA. Egress to the cloud needs S3. With local storage, the interviewer records in the browser instead.

Token route: `GET /api/interviews/[id]/room-token`.

Server SDK: `livekit-server-sdk` in `src/lib/livekit/room.ts` and `src/lib/livekit/egress.ts`.

Client: `livekit-client` in `src/hooks/use-interview-livekit-room.ts`. Video element helper: `src/components/interview/video-track.tsx`.

Room name: `interview:{interviewId}` from `getInterviewRoomName`.

Identity: `user:{userId}`.

Authorization: `authorizeInterviewRoomAccess` allows the candidate and the assigned interviewer while the interview is joinable (`scheduled` or `in_progress`). Grants are publish and subscribe for that room only. Token TTL is 15 minutes. Secrets stay on the server. The browser only receives the JWT and the WebSocket URL.

Lobby: `/interviewer/lobby/[id]` checks camera and microphone, then routes to the room.

Room: `/interviewer/room/[id]`. `startInterviewAction` runs after LiveKit reports connected, once per mount. End interview calls `completeInterviewAction` even if recording fails.

```text
Interview._id
  → GET /api/interviews/[id]/room-token
  → LiveKit JWT
  → student and interviewer
  → room interview:{id}
```

Environment: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

Restart `npm run dev` after changing them.

## What is not an integration

- Admin "AI" monitoring is a database poll over server-sent events.
- Risk scoring is local TypeScript.
- Certificate PDF is the browser print dialog.
- Slack, SMS, and webhooks exist only as unused booleans on `PlatformSettings`.
