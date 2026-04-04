export const USER_ROLES = [
  "partner",
  "our_manager",
  "partner_dept_manager",
  "admin",
  "rop",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(v: string): v is UserRole {
  return (USER_ROLES as readonly string[]).includes(v);
}

const ROLE_ALIASES: Record<string, UserRole> = {
  administrator: "admin",
};

/** Sheet / JWT may use different casing, spaces, zero-width chars, or aliases. */
export function normalizeUserRole(raw: unknown): UserRole | null {
  if (typeof raw !== "string") return null;
  let n = raw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim().toLowerCase();
  if (!n) return null;
  n = ROLE_ALIASES[n] ?? n;
  return isUserRole(n) ? n : null;
}
