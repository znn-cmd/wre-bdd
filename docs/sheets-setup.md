# Google Sheets structure

One **master spreadsheet**; each logical table is a **tab** (sheet) with a header row.

Tab names and column order are defined in `config/spreadsheet.ts` and written by `npm run init-sheet`.

## Tabs

1. **Leads** — main operational table (see `HEADERS.Leads`).
2. **Users** — identities, `token_hash`, role, scopes, optional `token_expires_at`.
3. **Partners** — `telegram_chat_id`, optional `telegram_bot_token`, currency defaults.
4. **Countries** — `local_currency`, `fx_rate_to_usd`.
5. **Source_Managers** — our sales managers.
6. **Partner_Managers** — optional directory for partner-side owners.
7. **Statuses** — reference for `transfer_status`, `partner_status`, `final_outcome`.
8. **Audit_Log** — append-only change log.
9. **Telegram_Log** — notification attempts.
10. **System_Settings** — key/value configuration (admin-maintained).
11. **Views_Config** — per-user UI JSON presets.
12. **Dashboard_Cache** — reserved for future aggregate caching.

## Automation vs stored fields

The app **denormalizes** on write where helpful:

- `country_name`, `partner_name`, `source_manager_name` from IDs
- `contract_amount_usd`, commission amounts from amount × FX × % when not explicitly set
- Status-driven timestamps (first time entering heuristic “in progress / won / lost” codes) via `applyStatusTimestamps`

Heavy analytics at scale should move to **Dashboard_Cache** or an external warehouse; the repository layer is the seam for that change.
