# Deploy to Vercel

## 1. Repository

Example remote: [github.com/znn-cmd/wre-bdd](https://github.com/znn-cmd/wre-bdd.git) (empty until you push).

```bash
git init
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/znn-cmd/wre-bdd.git
git push -u origin main
```

If GitHub asks for credentials, use a **Personal Access Token** (classic: `repo` scope) as the password, or configure SSH.

## 2. New Vercel project

- Import the repo.
- Framework preset: **Next.js**.
- Root directory: repository root (`WRE_BD`).

## 3. Environment variables

Add in **Project → Settings → Environment Variables** (Production + Preview as needed):

| Name | Value |
|------|--------|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Spreadsheet ID from URL |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Entire JSON key as a **single-line** string (paste minified JSON) |
| `SESSION_JWT_SECRET` | Random ≥32 characters |
| `APP_BASE_URL` | `https://your-domain.vercel.app` (or custom domain) |
| `TELEGRAM_DEFAULT_BOT_TOKEN` | Optional |

**Note:** For multiline JSON in Vercel UI, minify the JSON or replace newlines; the app parses with `JSON.parse`.

## 4. Google Sheet sharing

Share the master sheet with the **service account client_email** from the JSON (role: **Editor**).

## 5. Initialize structure

From a machine with env vars set (or CI):

```bash
npm run init-sheet
```

Or run once locally pointing at production spreadsheet ID.

## 6. Deploy

Trigger deploy. Smoke-test:

1. Open `/access/<admin-token>` → lands on dashboard.
2. Create a test lead → row appears in `Leads`, `Audit_Log`, optional `Telegram_Log`.
3. Open partner token → only that partner’s rows.

## 7. Custom domain

Attach domain in Vercel; update `APP_BASE_URL` to the canonical HTTPS URL.

## Build without secrets (CI)

Set `SKIP_ENV_VALIDATION=1` for `next build` only. Do **not** use this in production runtime.
