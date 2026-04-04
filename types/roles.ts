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

/** Sheet / JWT may use different casing or stray spaces. */
export function normalizeUserRole(raw: unknown): UserRole | null {
  if (typeof raw !== "string") return null;
  const n = raw.trim().toLowerCase();
  return isUserRole(n) ? n : null;
}
