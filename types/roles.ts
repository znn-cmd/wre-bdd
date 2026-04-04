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
