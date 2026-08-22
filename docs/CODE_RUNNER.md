# Code Runner Architecture (Phase 5 + Phase 12 hardening)

## Why not execute on Vercel / Next.js?

Vercel serverless functions must not run arbitrary student code via `eval`,
`child_process`, or local language runtimes. Student code is sent from the
Next.js server to an **isolated sandbox** only.

```
Student Browser
      ↓
Next.js Server Actions (authz + validation + scoring)
      ↓
Isolated Code Runner (Judge0 or Piston)
      ↓
Safe results
      ↓
Next.js Server → Student / MongoDB
```

## Providers

### Judge0 (default)

- Env: `CODE_RUNNER_PROVIDER=judge0`
- `JUDGE0_URL` — CE / RapidAPI / self-hosted base URL
- `JUDGE0_API_KEY` — optional
- `JUDGE0_AUTH_HEADER` — `X-Auth-Token` or `X-RapidAPI-Key`
- `JUDGE0_RAPIDAPI_HOST` — when using RapidAPI
- Submissions use `enable_network: false` explicitly

Adapter: `src/lib/coding/runner.ts` → `executeJudge0`

### Self-hosted Piston

- Env: `CODE_RUNNER_PROVIDER=piston`
- `PISTON_URL=http://localhost:2000` (or private host)
- `PISTON_API_KEY` — optional bearer token

Local:

```bash
docker compose -f docker-compose.code-runner.yml up -d
```

Public EMKC Piston may require auth; prefer self-hosted for exams.

## Pinned language versions

Documented in `src/lib/coding/config.ts` (`CODING_RUNTIME_VERSIONS`):

| Language | Judge0 id | Piston version |
|----------|-----------|----------------|
| python | 71 | 3.10.0 |
| javascript | 63 | 18.15.0 |
| java | 62 | 15.0.2 |
| cpp | 54 | 10.2.0 |

## Security controls (Phase 12)

- Auth.js session + Student role checked server-side
- Attempt ownership + assessment membership verified (`loadCodingContext`)
- Run = visible tests only (inputs/outputs returned safely)
- Submit = hidden tests; inputs/expected outputs never returned
- Score calculated only on the server from sandbox results
- Time / memory / max output limits enforced by the runner
- HTTP timeout on runner API calls; compile errors stop remaining tests
- Source size capped (100k chars); stdout/stderr clamped server-side
- Student-facing errors sanitized (no paths, env vars, Mongo URIs)
- Run cooldown + UI in-flight guards prevent duplicate executions
- Credentials stay in server env vars only — never passed to sandbox

## Production deployment

- **Do not** run student code inside Next.js on Vercel.
- Point `JUDGE0_URL` or `PISTON_URL` to a **private** runner reachable only from your app server.
- For production exams, prefer self-hosted Judge0 or Piston on a separate VM/container host.
- Optional live verification: `PHASE12_LIVE_RUNNER=1 npx tsx scripts/verify-phase12-coding.ts`

## Replaceability

Swap providers by changing `CODE_RUNNER_PROVIDER` and related env vars.
No client changes required — all calls go through `executeInSandbox`.
