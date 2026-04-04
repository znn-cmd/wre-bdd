# Roles and permissions

Roles are stored in the `Users.role` column (string). Supported values:

| Role | Code | Lead scope | Typical capabilities |
|------|------|------------|----------------------|
| Partner | `partner` | `partner_id` must match user’s `partner_id` | View/edit own leads: partner status, partner comment, partner manager name |
| Our manager | `our_manager` | Lead `country_code` / `partner_id` must fall in the resolved scope from `Source_Managers` + catalog (see below); **not** filtered by `lead.source_manager_id` | Create leads (only allowed countries/partners), edit allowed fields; UI dropdowns are pre-filtered |
| Partner dept manager | `partner_dept_manager` | All leads, narrowed by optional `allowed_country_codes` / `allowed_partner_ids` if set | Broad lead edit + **Users / Catalog** (directory); critical settings remain **admin-only** |
| Admin | `admin` | All | Full data + **user management** + critical settings (sheet-backed) |
| ROP / Head of sales | `rop` | All | Same as admin on leads/dashboards + **Users / Catalog**; only **`admin`** has `system_settings_critical` |

## Server enforcement

- **Never** trust the UI alone. All mutations go through Server Actions in `server/actions/leads.ts`, which call `assertLeadWrite` / `editableLeadFields` in `server/auth/rbac.ts`.
- List endpoints and pages use `filterLeadsForUser` so archived rows are hidden from non-elevated roles where applicable.

## Our manager: `Source_Managers` scope

For `our_manager`, the app loads the row in **`Source_Managers`** where `source_manager_id` equals the user’s `Users.source_manager_id` (and `active_flag` is true).

- **`country_scope`**: `*` or empty → all **active** rows from `Countries`. Otherwise comma/semicolon/pipe‑separated `country_code` values (must exist and be active in `Countries`).
- **`partner_scope`**: `*` or empty → every **active** `Partners` row whose `country_code` is in that country set. Otherwise only listed `partner_id` values (still must be active and in the country set).

On **`Users`** (optional extra narrowing, same as before):

- `allowed_country_codes` — when non-empty, intersects with the manager’s resolved countries.
- `allowed_partner_ids` — when non-empty, intersects with the resolved partners.

If the source-manager row is missing, inactive, or yields **no** countries/partners, the manager cannot see or create leads until the sheet is fixed.

Implementation: `server/auth/our-manager-scope.ts`, used by `userCanSeeLead(..., ref)` and `narrowReferenceForLeadsUi` for the Leads UI.

## Optional scoping columns (other roles)

On `Users` for **dept manager** / legacy paths:

- `allowed_country_codes` / `allowed_partner_ids` — see table above; for `our_manager` they **narrow** the `Source_Managers` scope when set.

## User administration

`admin`, `rop`, and `partner_dept_manager` can:

- Create/update users (`/app/users`)
- Rotate access tokens (invalidates old link immediately because only the hash is stored)

Only `admin` has `system_settings_critical` (if used by future actions).
