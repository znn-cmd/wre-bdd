import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function hashPasswordForSheet(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Verifies password against the Users sheet value.
 * Supports bcrypt (`$2a$` / `$2b$` / `$2y$`). For legacy rows, allows exact
 * plaintext match (timing-safe); prefer setting passwords via admin UI (bcrypt).
 */
export async function verifyUserPassword(
  stored: string,
  plain: string,
): Promise<boolean> {
  const s = String(stored ?? "").trim();
  if (!s || plain === "") return false;
  if (/^\$2[aby]\$/.test(s)) {
    return bcrypt.compare(plain, s);
  }
  try {
    const a = Buffer.from(s, "utf8");
    const b = Buffer.from(plain, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function normalizeLogin(login: string): string {
  return String(login ?? "").trim().toLowerCase();
}
