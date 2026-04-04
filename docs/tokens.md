# Token access model

## Storage

- The **plain token** is **never** stored in Google Sheets.
- Sheets column `Users.token_hash` stores **SHA-256** (hex) of the UTF-8 token.
- Admins see the **plain token once** after **Create user** or **Rotate link** in `/app/users`.

## Entry URLs

- Primary: `/access/<token>` (Route Handler sets cookie, redirects to `/app/dashboard`). The path segment must be **percent-encoded** if the plain token contains URL-reserved characters (`&`, `#`, `%`, `?`, …); otherwise the browser may truncate the URL (**400**). Tokens from `generateAccessToken` are **base64url** and safe unencoded.
- Alternate: `/app/...?token=<token>` → middleware redirects to `/access/<encodeURIComponent(token)>`. The `token` query value should be encoded (e.g. `encodeURIComponent(plainToken)`).

## Session cookie

- Name: `lh_sess` (`SESSION_COOKIE_NAME`).
- **HttpOnly**, `SameSite=Lax`, `Secure` in production.
- Payload: signed JWT (HS256) with `SESSION_JWT_SECRET`, ~7 days TTL.

## Revocation & expiry

| Mechanism | Behavior |
|-----------|----------|
| **Deactivate user** | Set `Users.is_active` to `false` → token exchange fails |
| **Rotate link** | New random token → new hash; old link stops working |
| **Optional expiry** | Set `Users.token_expires_at` to ISO datetime → exchange fails after that instant |

## Invalid UX

- Failed validation → redirect `/access/invalid`.

## Security notes

- Treat links like **passwords**; use HTTPS only in production.
- Long random tokens: 32 bytes, **base64url** (`generateAccessToken` in `lib/token.ts`).
- All **data filtering** for API-style access still happens **server-side** by role + scope.
