/**
 * HS256 key for session JWT — Edge-safe (middleware) and Node (session-jwt).
 * Must match trimming used in `getEnv()` for `SESSION_JWT_SECRET`.
 */
export function getSessionJwtSecretBytes(): Uint8Array {
  const s = (process.env.SESSION_JWT_SECRET ?? "").trim();
  if (s.length < 32) {
    return new TextEncoder().encode("0".repeat(32));
  }
  return new TextEncoder().encode(s);
}
