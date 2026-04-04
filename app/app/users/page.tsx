import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/get-session";
import { canManageDirectory } from "@/server/auth/rbac";
import { getUsersFresh } from "@/server/sheets/repository";
import { UsersAdmin } from "@/components/users/users-admin";
import { safeStringForRsc } from "@/lib/utils";
import { normalizeUserRole } from "@/types/roles";
import type { UserListRow, UserRow } from "@/types/models";

export const dynamic = "force-dynamic";

function toUserListRow(u: UserRow): UserListRow {
  const role = normalizeUserRole(u.role) ?? "our_manager";
  return {
    user_id: safeStringForRsc(u.user_id, 128),
    full_name: safeStringForRsc(u.full_name, 220),
    role,
    is_active: safeStringForRsc(u.is_active, 32),
    partner_id: safeStringForRsc(u.partner_id, 128),
    source_manager_id: safeStringForRsc(u.source_manager_id, 128),
    allowed_country_codes: safeStringForRsc(u.allowed_country_codes, 520),
    allowed_partner_ids: safeStringForRsc(u.allowed_partner_ids, 520),
    token_last_rotated_at: safeStringForRsc(u.token_last_rotated_at, 64),
    created_at: safeStringForRsc(u.created_at, 64),
    updated_at: safeStringForRsc(u.updated_at, 64),
  };
}

export default async function UsersPage() {
  noStore();
  const user = await getSession();
  if (!user) redirect("/access/invalid");
  if (!canManageDirectory(user)) redirect("/app/dashboard");
  const rows = await getUsersFresh();
  return <UsersAdmin initial={rows.map(toUserListRow)} />;
}
