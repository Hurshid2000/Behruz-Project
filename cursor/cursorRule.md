# Project Rules (MUST FOLLOW ALWAYS)

You are Cursor working on a production-ready web app for truck/car weighing logs at a factory.
Stack:

* Frontend: Next.js (React) + TypeScript + Tailwind (responsive: mobile input + desktop dashboard)
* Backend: Node.js + TypeScript REST API (Fastify or Express) + PostgreSQL
* ORM: Prisma
* Exports: Excel (.xlsx) via exceljs; Invoice DOCX via docxtemplater
* Deploy: Frontend on Vercel, Backend + Postgres on Railway

## 0) Non-negotiable principles

1. Do NOT break existing functionality. If changes are needed, refactor safely with minimal diffs.
2. Keep a stable architecture. No random framework swaps mid-way.
3. TypeScript strict everywhere. No `any` unless absolutely unavoidable and documented.
4. Validate all inputs on the server using Zod (or equivalent). Never trust client.
5. Net/Tare totals must ALWAYS be computed server-side:

   * tare_total = tare_count * tare_weight
   * net_weight = gross_weight - tare_total
6. Store photos outside the DB. DB stores only `photo_url` + metadata.
7. Every feature must have an acceptance checklist and basic tests where feasible.

## 1) Repository structure (monorepo)

Use pnpm workspaces:

/apps
/web        # Next.js frontend
/api        # Node.js backend (REST API)
/packages
/shared     # shared types/zod schemas (optional, but preferred)
/prisma       # prisma schema, migrations (can live under apps/api as well, but choose ONE place and keep it consistent)
README.md
.env.example

Do NOT create multiple overlapping backends or duplicate Prisma schemas.

## 2) Environment variables (single source of truth)

Maintain `.env.example` with ALL vars and comments.

Backend required:

* DATABASE_URL=
* JWT_SECRET=
* CORS_ORIGIN=
* FILE_STORAGE_MODE=local|s3
  If local:
* UPLOAD_DIR=./uploads
  If s3:
* S3_ENDPOINT=
* S3_BUCKET=
* S3_ACCESS_KEY_ID=
* S3_SECRET_ACCESS_KEY=
* S3_PUBLIC_BASE_URL=

Frontend required:

* NEXT_PUBLIC_API_URL=

Never hardcode URLs. Always use env.

## 3) Database model (must match exactly)

Tables:

* users: id, email, password_hash, role (admin|operator|viewer), created_at
* suppliers: id, name (unique), created_at
* weighings:
  id (uuid)
  created_at
  created_by (FK users)
  car_number (text)
  supplier_id (FK suppliers, nullable allowed in MVP but prefer required)
  gross_weight (numeric)
  tare_count (int)
  tare_weight (numeric)
  tare_total (numeric)   # computed server-side
  net_weight (numeric)   # computed server-side
  photo_url (text, nullable)
  note (text, nullable)

Migrations via Prisma only. No manual DB edits.

## 4) Backend API (REST) contracts

Base path: /api

Auth:

* POST /auth/login  -> returns token + user
* GET /auth/me      -> returns current user
  Use JWT. Protect routes by role.

Suppliers:

* GET /suppliers
* POST /suppliers (admin/operator)
* PATCH /suppliers/:id (admin/operator)

Weighings:

* POST /weighings (admin/operator)
* GET /weighings?from=&to=&supplierId=&carNumber=&page=&pageSize=
* GET /weighings/:id
* PATCH /weighings/:id (admin; operator optional policy, default admin-only edits)
* DELETE /weighings/:id (admin-only)

Uploads:

* POST /upload (multipart) -> returns { photoUrl }
  OR presigned URL approach (allowed), but keep it simple for MVP.

Exports:

* GET /export/excel?from=&to=&supplierId=&carNumber= -> downloads .xlsx
* GET /weighings/:id/invoice.docx -> downloads .docx (invoice filled for ONE weighing)

Stats:

* GET /stats/summary?from=&to=
  Returns:
  totals: { totalCars, totalNet, totalGross }
  dailySeries: [{ date, cars, net }]
  topSuppliers: [{ supplierName, net, cars }]

All endpoints must:

* validate input
* return consistent errors: { message, code, details? }
* use pagination for lists

## 5) Invoice DOCX rules

* Keep a single template at: apps/api/templates/invoice_template.docx
* Use placeholders exactly like:
  {{car_number}}, {{supplier_name}}, {{gross_weight}}, {{tare_count}}, {{tare_weight}}, {{tare_total}}, {{net_weight}}, {{date}}, {{time}}, {{operator_name}}
* Backend fills and returns a .docx as attachment download.
* Do not attempt PDF in MVP.

## 6) Frontend UX rules

Two primary modes:
A) Mobile/Tablet "Input"

* Simple form with big controls
* Auto-calc net on client for preview ONLY (server is source of truth)
* Photo capture from camera
* "Save" shows success and resets form

B) Desktop/Tablet "Dashboard"

* Table with filters (date range, supplier, car number)
* Row click -> details modal/page with photo
* Buttons:

  * Export Excel (current filters)
  * Download Invoice DOCX (selected record)
* Charts page/section:

  * daily net series
  * top suppliers

Must be responsive. No separate codebases for mobile/desktop.

## 7) Quality gates (must pass before moving on)

* `pnpm lint` passes
* `pnpm typecheck` passes
* API starts and connects to DB
* Web builds successfully
* Create weighing -> appears in dashboard
* Export Excel works with filters
* Invoice DOCX downloads and has correct placeholders filled

## 8) Step-by-step implementation plan (follow in order)

Phase 1: Project bootstrap

1. Init pnpm workspace + apps/web + apps/api
2. Setup ESLint/Prettier/TS strict
3. Setup Prisma + Postgres, migrations, seed admin user

Phase 2: Backend core
4) Auth (JWT) + RBAC middleware
5) Suppliers CRUD
6) Weighings CRUD with server-side calculations

Phase 3: Files & exports
7) Upload endpoint (local mode first)
8) Excel export endpoint (exceljs)
9) DOCX invoice endpoint (docxtemplater)

Phase 4: Frontend
10) Login page + auth store
11) Mobile Input form + photo upload
12) Dashboard table + filters + detail view
13) Charts view using stats endpoints
14) Export buttons integration

Phase 5: Deploy docs
15) Railway deploy guide + envs
16) Vercel deploy guide + envs
17) Final README with run commands

## 9) Working style rules for Cursor

* Before coding a phase, list files you will create/modify.
* Make small commits/patches; don't rewrite everything at once.
* Never invent features not in scope.
* If you hit ambiguity, choose the simplest stable approach and document it in README.
