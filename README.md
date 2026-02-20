# Weighing Logs

Factory vehicle weighing logs web app — mobile input + desktop dashboard, Node.js API + PostgreSQL.

## Tech Stack

- **Frontend:** Next.js 14 (React), TypeScript, Tailwind CSS
- **Backend:** Node.js, Fastify, TypeScript
- **Database:** PostgreSQL, Prisma ORM

## Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL (local or cloud)

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

At minimum for local dev:

- `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/weighing_logs`)
- `JWT_SECRET` — any secure random string (e.g. `openssl rand -hex 32`)
- `NEXT_PUBLIC_API_URL` — `http://localhost:4000/api`

### 3. Database

Create the database, then run migrations and seed:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Seed creates admin user: `admin@local` / `Admin123!`

## How to Run Locally

### Option A: Two terminals

**Terminal 1 — API:**

```bash
pnpm dev:api
```

API runs at `http://localhost:4000` (health: `GET /api/health`).

**Terminal 2 — Web:**

```bash
pnpm dev:web
```

Web runs at `http://localhost:3000`.

### Option B: Single terminal (background)

```bash
pnpm dev:api &
pnpm dev:web
```

## Scripts

| Command       | Description                     |
|---------------|---------------------------------|
| `pnpm lint`   | Lint all packages               |
| `pnpm typecheck` | Type-check all packages     |
| `pnpm dev:web`   | Start Next.js dev server    |
| `pnpm dev:api`   | Start API dev server        |
| `pnpm build`     | Build all apps              |
| `pnpm db:generate` | Generate Prisma client   |
| `pnpm db:migrate`  | Run migrations            |
| `pnpm db:seed`     | Seed admin user           |

## Project Structure

```
apps/
  web/     # Next.js frontend
  api/     # Fastify REST API
packages/
  prisma/  # Prisma schema, migrations, seed
```

## Phase 1 (Current)

- [x] pnpm monorepo (web + api)
- [x] ESLint + Prettier + TypeScript strict
- [x] Prisma schema + migration + admin seed
- [x] README with run instructions
