# Environment variables

Names only. Do not paste real values into docs, tickets, or client code. Copy `.env.example` to `.env.local`. Never prefix LiveKit, SMTP, S3, or the grading key with `NEXT_PUBLIC_`.

`NODE_ENV` is set by Next.js. Development turns on debug logs and the eye-gaze debug panel. Production hides them.

## Required to boot the app

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `MONGODB_URI` | Yes | `src/lib/db.ts` | MongoDB connection string. Local or Atlas |
| `AUTH_SECRET` | Yes | `src/lib/auth.ts`, `src/lib/otp/crypto.ts` | JWT and OTP hashing. Generate a long random string |
| `AUTH_URL` | Yes in production | Auth.js | Public site origin, for example `http://localhost:3000` |
| `NEXTAUTH_URL` | Yes in production | Auth.js | Same origin. Set both |

## Demo login

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `ALLOW_DEMO_LOGIN` | No | `src/lib/actions/auth.ts` | `true` forces demo buttons on. `false` forces them off. In development they are on unless set to `false`. In production they are off unless set to `true` |

## SMTP

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `SMTP_HOST` | For real email | `src/lib/otp/email.ts` | SMTP server |
| `SMTP_PORT` | No | same | Default `587` |
| `SMTP_SECURE` | No | same | `true` for TLS |
| `SMTP_USER` | For real email | same | SMTP username |
| `SMTP_PASS` | For real email | same | SMTP password |
| `EMAIL_FROM` | No | same | From header. Default `CodeShield AI <noreply@codeshield.ai>` |
| `SMTP_FROM` | No | same | Fallback if `EMAIL_FROM` is empty |

Development without SMTP logs the OTP on the server. Production should set SMTP or users cannot receive codes.

## Code runner

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `CODE_RUNNER_PROVIDER` | No | `src/lib/coding/runner.ts` | `judge0` (default) or `piston` |
| `JUDGE0_URL` | For Judge0 | same | Default `https://ce.judge0.com`. Use a private host in production |
| `JUDGE0_API_KEY` | No | same | Sent only if set |
| `JUDGE0_AUTH_HEADER` | No | same | Default `X-Auth-Token` |
| `JUDGE0_RAPIDAPI_HOST` | No | same | Set when using RapidAPI |
| `PISTON_URL` | For Piston | same | Default `http://localhost:2000` |
| `PISTON_API_KEY` | No | same | Bearer token if the Piston host requires it |

`PHASE12_LIVE_RUNNER=1` is only for `scripts/verify-phase12-coding.ts`. The app does not read it.

## Recordings

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `STORAGE_PROVIDER` | No | `src/lib/storage/index.ts` | `local` (default) or `s3` |
| `RECORDINGS_DIR` | No | same | Local directory. Default `.data/recordings` |
| `S3_BUCKET` | When provider is `s3` | storage and LiveKit egress | Bucket name |
| `S3_REGION` | No | same | Default `auto` (useful for R2) |
| `S3_ENDPOINT` | For R2 or custom S3 | same | API endpoint |
| `S3_ACCESS_KEY_ID` | When provider is `s3` | same | Access key |
| `S3_SECRET_ACCESS_KEY` | When provider is `s3` | same | Secret key |
| `S3_FORCE_PATH_STYLE` | No | same | `true` for many R2 and MinIO setups |

Direct browser PUT to S3 needs bucket CORS. See the comment in `.env.example`.

## LiveKit

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `LIVEKIT_URL` | To open a room | `src/lib/livekit/config.ts` | WebSocket URL, `wss://…` |
| `LIVEKIT_API_KEY` | To open a room | same | Server key |
| `LIVEKIT_API_SECRET` | To open a room | same | Server secret |

All three must be set or `isLiveKitConfigured()` is false. Restart the dev server after changing them.

## Certificates

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `CERTIFICATE_DEFAULT_PASS_THRESHOLD` | No | `src/lib/certificates/config.ts` | Pass percent when an assessment has no `passThreshold`. Default 60 |

## AI grading assist

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `AI_GRADING_API_KEY` | For suggestions only | `src/lib/ai/subjective-grade.ts` | Bearer token for the chat API |
| `AI_GRADING_MODEL` | No | same | Default `gpt-4o-mini` |
| `AI_GRADING_BASE_URL` | No | same | Default `https://api.openai.com` |

Manual grading does not need these.

## Logs

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `DEBUG_LOGS` | No | `src/lib/debug.ts` | `false` silences logs. `true` forces them. Default on in development |
| `DEBUG_API_BODY` | No | same | Pretty-print action payloads. Off in production unless `true` |
| `DEBUG_STACK` | No | same | `false` hides stacks |

## Not read by the app

`.env.example` mentions a Vercel production checklist in a comment. There is no `VERCEL_*` variable the application code reads. There is no Redis URL.
