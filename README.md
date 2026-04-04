# Lead Hub

Production-oriented lead operations console for **Vercel** with **Google Sheets** as the system of record. Access is **magic-link only** (no passwords). Roles, row-level scope, audit logging, dashboards, and **Telegram** notifications are implemented server-side.

## Why this stack

- **Next.js App Router** fits Vercel’s serverless model and keeps sensitive logic on the server (Sheets + Telegram tokens never ship to the browser).
- **Google Sheets** is acceptable for MVP/working volume if reads are batched, reference data cached (`unstable_cache`), and mutations go through a small repository layer (`server/sheets/*`) that can later be swapped for PostgreSQL without rewriting UI contracts.
- **shadcn-style UI** (Radix + Tailwind) keeps the interface compact for daily ops.

## Architecture (layers)

| Layer | Location |
|--------|-----------|
| UI | `app/`, `components/` |
| Auth / session | `middleware.ts`, `app/access/[token]/route.ts`, `server/auth/*`, `lib/token.ts` |
| RBAC | `server/auth/rbac.ts` |
| Data adapter | `server/sheets/client.ts`, `server/sheets/repository.ts`, `config/spreadsheet.ts` |
| Audit | `Audit_Log` sheet + `appendAuditRow` in actions |
| Telegram | `server/telegram/notify-new-lead.ts`, `Telegram_Log` sheet |
| Dashboard | `lib/dashboard-stats.ts`, `components/dashboard/*` |

## Quick start

1. **Create a Google Cloud project** → enable **Google Sheets API** → create a **service account** → download JSON key.
2. **Create an empty spreadsheet** and **share it** with the service account email as **Editor**.
3. Copy `.env.example` → `.env.local` and fill values (see below).
4. **Initialize tabs + headers**:

   ```bash
   npm install
   npm run init-sheet
   ```

5. **Seed** reference rows (countries, partners, statuses, users) — see `docs/seed-demo.md`.
6. Run locally:

   ```bash
   npm run dev
   ```

7. Open an access link: `http://localhost:3000/access/<PLAIN_TOKEN>`  
   The plain token is shown **once** when an admin creates a user (stored hash-only in `Users.token_hash`).

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | yes | Master spreadsheet ID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | yes | Full JSON credentials (string) |
| `SESSION_JWT_SECRET` | yes | ≥32 chars; signs httpOnly session cookie after token exchange |
| `APP_BASE_URL` | recommended | Public URL for Telegram deep links (fallback: `VERCEL_URL`) |
| `TELEGRAM_DEFAULT_BOT_TOKEN` | optional | Used when a partner row leaves `telegram_bot_token` empty |
| `SKIP_ENV_VALIDATION` | CI only | `1` to build without real secrets (runtime will fail for Sheets) |

## User flows

1. User opens `/access/<token>` → server hashes token, loads `Users`, checks `is_active` + optional `token_expires_at` → issues **7-day** JWT in httpOnly cookie → redirect `/app/dashboard`.
2. `/app/*` is protected by **middleware** (JWT) + **server-side** RBAC on every action.
3. **Our manager** creates a lead → row in `Leads` → `Audit_Log` → optional Telegram to partner chat.
4. **Partner** opens their link → sees only `partner_id` rows → updates allowed fields → audit entries.

Further detail: `docs/tokens.md`, `docs/rbac.md`, `docs/telegram.md`. **First admin (RU):** `docs/add-admin.md`.

## Deploy on Vercel

Step-by-step: **`docs/deploy-vercel.md`**.

Summary: set the same env vars in the Vercel project, connect the Git repo, deploy. Ensure `APP_BASE_URL` matches the production domain for correct Telegram links.

## Scripts

- `npm run init-sheet` — creates missing tabs and writes header row for each sheet defined in `config/spreadsheet.ts`.

## Acceptance & scaling

- **`docs/acceptance-checklist.md`** — implementation checklist.
- **`docs/scaling.md`** — moving off Sheets, rate limits, Postgres outline.

## License

Private / your org — adjust as needed.
