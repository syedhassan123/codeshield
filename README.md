# CodeShield

CodeShield is an assessment, proctoring, and interview platform. Admins build exams and review integrity. Students take proctored assessments and join interviews. Interviewers run live interviews and submit evaluations.

## Tech stack

- Next.js 15 (App Router) and TypeScript
- React 19, Tailwind CSS v4
- MongoDB and Mongoose
- Auth.js (NextAuth v5) with credentials and JWT sessions
- MediaPipe in the browser for face, head pose, and eye gaze
- Judge0 or Piston for isolated code execution
- LiveKit for interview audio and video
- S3-compatible storage or local disk for recordings
- Nodemailer SMTP for one-time passwords

## Roles

| Role | Home | What they do |
|---|---|---|
| Admin | `/admin` | Questions, assessments, results, proctoring review, interviews, certificates, monitoring |
| Student | `/student` | Take exams, see results and certificates, join interviews |
| Interviewer | `/interviewer` | See assigned interviews, join the room, evaluate candidates |

## Product areas

Authentication, assessments, the exam engine, coding questions, browser proctoring, exam recording, grading and results, certificates, interviews and LiveKit, in-app notifications, and admin analytics.

## Where to start

```text
README.md                         this page
docs/01-PROJECT-OVERVIEW.md       what each product area does
docs/02-FOLDER-FILE-MAP.md        which folder owns which feature
docs/03-PAGES-ROUTES-MAP.md       routes by role
docs/04-FEATURES-ARCHITECTURE.md  how a feature moves through the code
docs/05-SERVICES-INTEGRATIONS.md  MediaPipe, OpenAI, S3, SMTP, LiveKit, sandbox
docs/06-DATABASE-MODELS.md        MongoDB models and relationships
docs/07-DATA-FLOWS.md             end-to-end flows
docs/08-ENVIRONMENT-VARIABLES.md  env var names only
docs/09-DEVELOPER-QUICKSTART.md   first-day reading order and commands
docs/CODE_RUNNER.md               Judge0 / Piston setup (existing)
docs/PHASE-HISTORY.md             archived phase notes from the old README
```

The lookup table in [docs/02-FOLDER-FILE-MAP.md](docs/02-FOLDER-FILE-MAP.md) is the fastest way to find a file.

## Local setup

```bash
npm install
cp .env.example .env.local
```

Set `MONGODB_URI` and `AUTH_SECRET` in `.env.local`. Other services are optional for a first run. See [docs/08-ENVIRONMENT-VARIABLES.md](docs/08-ENVIRONMENT-VARIABLES.md).

```bash
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Seed logins are in `scripts/seed.ts` (`password123` for the demo accounts).

Do not commit `.env.local` or real API keys.
