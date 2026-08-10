# CodeShield AI (Phase 0)

Next.js migration of the Lovable CodeShield AI prototype — UI preserved, real auth + MongoDB foundation, mock domain data.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui primitives + Lucide
- MongoDB + Mongoose
- Auth.js (NextAuth v5) credentials + JWT sessions

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
- **Email/password** goes through `/verify-otp` → `/verify-face` (mock UI, session flags updated server-side).

## Phase 0 scope

Included: route migration, design tokens, workspace shells, User model, RBAC middleware, seed users.

Still mock: assessments, proctoring, coding runner, interviews/WebRTC, AI evaluation, reports export.
