# Acceptance checklist

Use this to validate a deployment.

## Access

- [ ] Invalid token shows `/access/invalid`.
- [ ] Valid token sets session and opens `/app/dashboard`.
- [ ] Expired `token_expires_at` blocks access.
- [ ] Inactive user cannot exchange token.
- [ ] `/app?token=` redirects through `/access/`.

## RBAC

- [ ] Partner sees only own `partner_id` leads.
- [ ] Our manager sees only own `source_manager_id` leads (plus allow-lists if set).
- [ ] Dept manager / admin / ROP see broader scope as documented.
- [ ] ROP can open `/app/users` and manage directory (same as catalog).
- [ ] Admin can CRUD users and rotate tokens.

## Leads

- [ ] Create lead writes `Leads` + `Audit_Log` (`action_type=create`).
- [ ] Update logs per changed field in `Audit_Log`.
- [ ] Partner cannot mutate disallowed fields (server rejects).
- [ ] Deep link `/app/leads/{lead_id}` works when lead is in scope.

## Telegram

- [ ] New lead triggers notification when token + chat_id configured.
- [ ] `Telegram_Log` records `sent` or `failed` / `skipped` with reason.

## Dashboard

- [ ] Metrics match filtered lead set for the current role.
- [ ] Charts render without client errors.

## Ops

- [ ] `npm run build` passes with real env (or `SKIP_ENV_VALIDATION=1` for CI only).
- [ ] `npm run init-sheet` creates all tabs and headers.
