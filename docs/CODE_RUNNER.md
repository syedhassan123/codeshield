# Code Runner Architecture (Phase 5)

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

## Security controls

- Auth.js session + Student role checked server-side
- Attempt ownership + assessment membership verified
- Run = visible tests only (inputs/outputs returned safely)
- Submit = hidden tests; inputs/expected outputs never returned
- Score calculated only on the server from sandbox results
- Time / memory / max output limits enforced by the runner
- Credentials stay in server env vars only

## Replaceability

Swap providers by changing `CODE_RUNNER_PROVIDER` and related env vars.
No client changes required — all calls go through `executeInSandbox`.
