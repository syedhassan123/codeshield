# CodeShield AI

Next.js assessment and proctoring platform — Lovable UI preserved, real auth, MongoDB-backed exams, grading, coding runner, and proctoring.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui primitives + Lucide
- MongoDB + Mongoose
- Auth.js (NextAuth v5) credentials + JWT sessions
- Judge0 / Piston isolated code runner
- MediaPipe face + head-pose monitoring during exams

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env and set MongoDB Atlas (or local) URI:

```bash
cp .env.example .env.local
```

Required:

- `MONGODB_URI` — MongoDB Atlas connection string
- `AUTH_SECRET` — long random string

Optional (see `.env.example`):

- Code runner (`JUDGE0_URL`, `CODE_RUNNER_PROVIDER`)
- Exam recording storage (`STORAGE_PROVIDER`, S3/R2 vars)
- SMTP for registration OTP

3. Seed demo users:

```bash
npm run seed
```

4. Start:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@codeshield.ai` | `password123` |
| Student | `rohan@codeshield.edu` | `password123` |
| Interviewer | `kabir@codeshield.ai` | `password123` |
| Student (landing default) | `demo@codeshield.ai` | `password123` |

- **Quick-login** buttons sign in fully verified (skips OTP/face).
- **Email/password** registration uses email OTP; `/verify-face` remains optional mock UI.

## Completed phases

| Phase | Scope |
|-------|--------|
| **0** | Route migration, design tokens, workspace shells, User model, RBAC, seed users |
| **1** | Question bank + assessment CRUD, publish/unpublish |
| **2** | Exam attempts, timer, autosave, submit, MCQ auto-score |
| **3** | Results list, manual subjective grading, evaluation completion |
| **4** | Registration email OTP, verified login flow |
| **5** | Isolated coding runner, visible/hidden tests, auto coding score |
| **6** | Exam security events (tab switch, copy/paste, fullscreen) |
| **7** | Webcam recording during exams, admin playback |
| **8A** | Face count monitoring (no face / multiple faces) |
| **8B** | Head-pose / looking-away monitoring |
| **9** | Admin dashboard, monitoring, students, reports wired to MongoDB; CSV/PDF export |
| **10** | Proctoring infrastructure hardening — camera pre-check, recording lifecycle, upload retry, idempotency, security monitoring cleanup, admin playback states |
| **11** | Advanced AI proctoring analysis — evidence aggregation, temporal correlation, explainable risk scoring, unified timeline, automated review summary |
| **11.5** | Student dashboard wired to real MongoDB data (stats, activity, assessments) |
| **12** | Coding execution security hardening — isolated runner limits, authz, hidden tests, compile/timeout handling, duplicate-run guards |

## Phase 12 — Coding execution & security hardening

Audited and hardened the existing Judge0/Piston pipeline (student code **never** runs in Next.js):

- `src/lib/coding/runner.ts` — external sandbox only; `enable_network: false` (Judge0); HTTP timeouts; output clamping
- `src/lib/coding/evaluate.ts` — weighted scoring; compile-error short-circuit; structured statuses
- `src/lib/coding/security.ts` — source validation; sanitized student error messages
- `src/lib/actions/coding.ts` — attempt ownership; visible vs hidden tests; run cooldown; upsert run drafts
- Exam UI — separate Run/Submit in-flight guards

Supported languages: `python`, `javascript`, `java`, `cpp` (pinned versions in `src/lib/coding/config.ts`).

```bash
npx tsx --env-file=.env.local scripts/verify-phase12-coding.ts
# Optional live sandbox:
PHASE12_LIVE_RUNNER=1 npx tsx --env-file=.env.local scripts/verify-phase12-coding.ts
```

Production: deploy a **private** Judge0 or Piston instance; see `docs/CODE_RUNNER.md`.

## Phase 11 — Advanced AI proctoring

Builds an intelligence layer on top of existing Phase 8A/8B vision monitoring and Phase 10 recording — **without replacing them**.

- Aggregates `SecurityEvent` evidence (browser + vision + camera/recording)
- Debounced face/head signals preserved from Phase 8A/8B
- Temporal correlation windows for multi-signal review periods
- Explainable risk score (0–100) with documented factor weights
- Unified proctoring timeline with recording-relative timestamps
- Cautious automated review summary (decision-support only — **does not auto-fail students or change grades**)
- Admin attempt detail: `/admin/results/[attemptId]`

```bash
npx tsx --env-file=.env.local scripts/verify-phase11-ai-proctoring.ts
```

## Phase 10 — Proctoring & recording hardening

Reliability improvements for the existing proctoring pipeline (no new AI detection):

- Assessment security settings (`requireCamera`, fullscreen, copy/paste, tab monitoring) drive exam behavior
- Camera pre-check with permission/unavailable/browser error handling
- MediaRecorder MIME fallback, error handling, and accurate recording status UI
- Recording idempotency (one active `RECORDING` row per attempt; resume after refresh)
- Upload retry on submit, server-side attempt ownership validation
- Security event linkage and listener cleanup on submit/unmount
- Admin playback handles READY / FAILED / in-progress recording states

```bash
npx tsx --env-file=.env.local scripts/verify-phase10-proctoring.ts
```

## Phase 9 — Admin real data

The Admin area now reads from MongoDB instead of `mock-data.ts`:

- `/admin` — stat cards, charts, recent security alerts, recent assessments
- `/admin/monitoring` — active attempts, security event stream (30s refresh)
- `/admin/students` — real student users with search/filter/pagination
- `/admin/reports` — attempt/result/proctoring reports with filters, CSV export, printable PDF

## Still mock / future work

- `/admin/interviews` and all interview/WebRTC pages
- Student/interviewer dashboard mock widgets (notifications, certificates, etc.)
- Standalone `/student/coding` practice editor
- AI subjective evaluation assist
- Live WebSocket monitoring (Phase 9 uses polling)
- External LLM-generated summaries (Phase 11 uses rule-based automated review text)

## Verification scripts

```bash
npx tsx --env-file=.env.local scripts/verify-phase2-exam.ts
npx tsx --env-file=.env.local scripts/verify-phase3-grading.ts
npx tsx --env-file=.env.local scripts/verify-exam-security.ts
npx tsx --env-file=.env.local scripts/verify-phase10-proctoring.ts
npx tsx --env-file=.env.local scripts/verify-phase11-ai-proctoring.ts
npx tsx --env-file=.env.local scripts/verify-phase11-5-student-dashboard.ts
npx tsx --env-file=.env.local scripts/verify-phase12-coding.ts
```

See `docs/CODE_RUNNER.md` for code runner setup.
