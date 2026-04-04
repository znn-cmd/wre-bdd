# Demo / seed data

After `npm run init-sheet`, add minimal rows so the app is usable.

## Countries (`Countries`)

| country_code | country_name | local_currency | fx_rate_to_usd | active_flag |
|--------------|--------------|----------------|----------------|-------------|
| DE | Germany | EUR | 1.08 | true |
| AE | UAE | AED | 0.27 | true |

## Partners (`Partners`)

| partner_id | partner_name | country_code | country_codes | source_manager_ids | active_flag | telegram_chat_id | notification_enabled | default_currency |
|------------|--------------|--------------|---------------|----------------------|-------------|------------------|----------------------|------------------|
| P-DEMO-1 | Demo Partner GmbH | DE | AE | SM-1 | true | YOUR_CHAT_ID | true | EUR |

`country_code` + `country_codes` together define all countries the partner operates in (union). `source_manager_ids`: comma-separated `source_manager_id`; empty = any our_manager allowed by geography. After changing headers, run `npm run init-sheet` once to add new columns to row 1.

Leave `telegram_bot_token` empty if using `TELEGRAM_DEFAULT_BOT_TOKEN` in env.

## Source managers (`Source_Managers`)

`country_scope`: `*` = all **active** countries from `Countries`; otherwise comma-separated `country_code` values (e.g. `DE,AE`).  
`partner_scope`: `*` = all **active** partners whose `country_code` is in that country set; otherwise comma-separated `partner_id` values (subset allowed).

| source_manager_id | source_manager_name | active_flag | country_scope | partner_scope |
|-------------------|---------------------|-------------|---------------|---------------|
| SM-1 | Alex Internal | true | DE | * |

## Statuses (`Statuses`)

Add a few rows per `category`:

- `transfer_status`: `new`, `sent`, `accepted`
- `partner_status`: `new`, `in_progress`, `won`, `lost`
- `final_outcome`: `open`, `won`, `lost`

Use `status_code` values that match what you type in leads (lowercase recommended).

## Users (`Users`)

Step-by-step (including first admin): **`docs/add-admin.md`** (RU).

1. Create the first **admin** via a **temporary row**:
   - Put placeholder `token_hash`, then run the app locally and use **Users** UI to rotate token **or**
   - Generate hash: `SHA256(plain_token)` and paste hex into `token_hash`, then open `/access/<plain_token>`.

Example row (hash must be real SHA-256 of your chosen token):

| user_id | full_name | role | is_active | token_hash | partner_id | source_manager_id |
|---------|-----------|------|-----------|------------|------------|-------------------|
| U-ADMIN-1 | Admin | admin | true | *sha256 hex* | | |

For **partner** users, set `partner_id` = `P-DEMO-1`.  
For **our_manager**, set `source_manager_id` = `SM-1`.

## Leads

Optional starter row for UI testing; or create via **New lead** in the app.
