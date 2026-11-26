# Arab Computers — Client Management & Maintenance Contracts

Internal system for **Arab Computers (العربية للحاسبات)**, Alexandria, Egypt. It manages clients, software contracts, annual maintenance (AMC) schedules, client requests, quotations, printable bilingual documents, reminders and client emails.

- Bilingual UI (Arabic RTL / English LTR), switchable from the header and remembered per user
- Light and dark mode, responsive layout
- Roles: **Admin**, **Account Manager**, **Viewer**

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS v4, shadcn/ui (Radix) |
| Database | PostgreSQL on Neon (Vercel Marketplace), Prisma 7 with the `pg` driver adapter |
| Auth | Auth.js v5: email/password (bcrypt) with JWT sessions |
| i18n | next-intl (locale from user profile / cookie, no locale in URL) |
| PDF | `@react-pdf/renderer` with embedded IBM Plex Sans Arabic (no Chromium) |
| Files | Vercel Blob |
| Email | Resend (default) or SMTP via Nodemailer |
| Jobs | Vercel Cron → `GET /api/cron/daily` (protected by `CRON_SECRET`) |
| Tests | Vitest |

## Local development

Requirements: Node 22+, PostgreSQL 15+.

```bash
npm install
```

```bash
cp .env.example .env
```

Edit `.env`: set `DATABASE_URL`, `AUTH_SECRET` (`openssl rand -base64 32`) and `CRON_SECRET`.

```bash
npx prisma migrate dev
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Open http://localhost:3000.

### Demo accounts (created by the seed)

| Email | Password | Role |
|---|---|---|
| admin@arab-computers.com | `SEED_ADMIN_PASSWORD` or `Admin@12345` | Admin |
| manager@arab-computers.com | `Manager@12345` | Account manager |
| karim@arab-computers.com | `Manager@12345` | Account manager |
| viewer@arab-computers.com | `Viewer@12345` | Viewer |

> **Change these passwords (or delete the demo users) before going live.**

### Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit tests (AMC engine, notification scheduling, …) |
| `npm run lint` / `npm run typecheck` | Static checks |
| `npm run db:seed` | Seed settings, lookups, templates, users and demo data. Demo data is only created on an empty DB |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`) |

## Deploying to Vercel (step by step)

1. **Push this repository to GitHub.**
2. **Create the project.** In Vercel, go to *Add New → Project*, import the repository and keep the defaults (framework *Next.js*). Don't deploy yet.
3. **Add the database.** In the project, open *Storage → Create Database → Neon (Postgres)*, then connect it to **all environments**. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
   - With Neon's preview branching on, each preview deployment gets its own database branch.
4. **Add file storage.** Open *Storage → Create → Blob* and connect it to the project. This sets `BLOB_READ_WRITE_TOKEN`.
5. **Set environment variables** under *Settings → Environment Variables*:
   - `AUTH_SECRET`: from `openssl rand -base64 32`
   - `CRON_SECRET`: from `openssl rand -hex 24`. Vercel Cron sends it automatically as a Bearer token
   - `APP_URL`: e.g. `https://clients.arab-computers.com`
   - Email:
     - Resend: set `RESEND_API_KEY` and verify your sending domain at resend.com. Resend is also available from the Vercel Marketplace.
     - SMTP: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER` and `SMTP_PASSWORD`, then choose SMTP in *Settings → Email* inside the app.
   - `SEED_ADMIN_PASSWORD`: a strong password for the first admin
6. **Deploy.** The `vercel-build` script runs `prisma generate`, then `prisma migrate deploy`, then `next build`, so migrations apply on every deploy.
7. **Seed once** from your machine, against the production database:
   ```bash
   npx vercel env pull .env.production.local
   ```
   ```bash
   DOTENV_CONFIG_PATH=.env.production.local npm run db:seed
   ```
8. **Sign in** as `admin@arab-computers.com`. Then update company info in *Settings*, create real users, and remove or disable the demo users.
9. **Custom domain** (optional): *Settings → Domains*.

### Scheduled job

`vercel.json` schedules `GET /api/cron/daily` at **05:00 UTC (07:00/08:00 Cairo)** every day. The job refreshes AMC statuses (Pending → Overdue), creates in-app notifications for the configured intervals, and emails the admins and the assigned account manager. **Nothing is ever sent to clients automatically.**

> Vercel now also offers **Vercel Schedules**, the successor to Cron Jobs. The `crons` entry keeps working. To migrate, move the same path and schedule to a `schedules` entry. The route handler does not change.

To test it manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/daily
```

## Project structure

```
prisma/                 schema.prisma, migrations/, seed.ts
messages/               ar.json, en.json (every UI string)
brand/                  original logo assets (from arab-computers.com)
public/brand/           logo + mark served by the app
src/
  app/
    (auth)/login        sign-in
    (app)/…             authenticated screens (dashboard, clients, contracts, …)
    api/                auth, cron, pdf, files, exports
  components/
    ui/                 shadcn/ui primitives
    layout/             sidebar, header, toggles
    shared/             page header, empty state, KPI card, …
  i18n/                 next-intl config (locale from cookie / user profile)
  lib/
    amc/engine.ts       AMC schedule calculation (pure, unit-tested)
    format.ts           locale-aware dates / numbers / money
    numbering.ts        document numbering formats
    templates/          default bilingual document & email templates
  pdf/                  React-PDF templates + embedded Arabic fonts
  server/
    actions/            server actions per module (validate with zod, check role, audit)
    services/           business logic (settings, dashboard, amc, email, notifications…)
    auth-guard.ts       role / permission matrix
  auth.ts, auth.config.ts, proxy.ts
tests/                  Vitest unit tests
```

### Roles and permissions

Defined in `src/server/auth-guard.ts`.

| Permission | Admin | Account manager | Viewer |
|---|:-:|:-:|:-:|
| View everything | ✓ | ✓ | ✓ |
| Create / edit / delete business data | ✓ | ✓ | |
| Send client emails | ✓ | ✓ | |
| Settings, templates, users | ✓ | | |

### AMC calculation rules

Implemented in `src/lib/amc/engine.ts` and covered by `tests/amc-engine.test.ts`.

- **Base AMC** = contract value × AMC % (default 10%). **Year 1 = base.**
- **Compounded:** each year = previous year's amount × (1 + increase %).
- **Simple:** each year = base × (1 + sum of increases so far).
- **Per-year overrides:**
  - An increase-% override changes that year's rate, and the following years recalculate.
  - An amount override fixes that year's amount. In compounded mode, later years build on it. In simple mode, it affects that year only.
- **Paid years are locked** and never recalculated.
- Due dates are one year apart, starting at the AMC start date (default: contract date + 1 year).

### Notifications

- The daily job creates alerts for **upcoming AMC renewals, overdue AMC payments, requests due soon and overdue requests**.
  - Alerts go to the client's account manager (or the request's assignee) **and all admins**.
  - Intervals are set in *Settings → Notifications & email*, e.g. 30/14/3 days before, plus overdue alerts repeated every N days.
  - Re-running the job never duplicates alerts: each (user, trigger) pair is unique.
- Alerts appear in the header bell and on *Notifications* (read/unread, dismiss/restore, mark all read). Each one has **Prepare email to client**, which opens the reviewed compose form.
- If enabled, each recipient also gets **one digest email per run** in their own language. Admins can trigger the same job with **Run daily check now**.
- The scheduling rules live in `src/lib/notifications/schedule.ts` and are covered by `tests/notifications.test.ts`.

### Reports

*Reports* has four tabs: AMC schedule, Requests (by status, by client, details), Quotations (latest versions, acceptance rate) and Client statement. Each has filters and exports to **PDF** (landscape, on the letterhead) and **Excel** (summary sheet plus one sheet per table, with numeric money and date columns).

### Documents & email

- **PDFs** (`/api/pdf/{contract|amc|quotation}/{id}?lang=ar|en`) are rendered on the server with `@react-pdf/renderer` on the company letterhead: logo, address, footer and page numbers. They default to the client's preferred language.
  - Templates are edited in *Settings → Templates*; placeholders such as `{{client_name}}` are filled automatically.
  - The logo and footer are set in *Settings → Company & letterhead*.
- **Email** is always reviewed by a person: *Email to client* opens a prefilled form with recipients from the client's contacts, CC, subject and body in the client's language, and the PDF attached. Nothing is sent to clients automatically.
  - Every send (or failure) is logged in *Sent emails* and on the client timeline, together with the exact PDF that was sent.
  - Choose the provider in *Settings → Notifications & email*, and use *Send test email* to verify it.
  - Local development without credentials: set `EMAIL_DEV_OUTBOX=1` and emails are written to `.uploads/outbox/` instead of being sent. In production, a missing provider shows an error instead of silently dropping mail.

### Notes

- **PDF digits:** PDFs always use Latin digits (1,234.50). @react-pdf mis-orders Arabic-Indic decimal separators. The "Arabic-Indic digits" setting applies to the on-screen UI only.
- Fonts: IBM Plex Sans Arabic (SIL OFL), stored in `src/pdf/fonts`.
- react-pdf caveat: never set `lineHeight` on a `<Page>` style. It makes fixed footers disappear, so set it on text styles instead (see `src/pdf/letterhead.tsx`).
