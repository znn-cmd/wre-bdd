import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/get-session";
import { canPerform } from "@/server/auth/rbac";
import { getUsersFresh } from "@/server/sheets/repository";
import { UsersAdmin } from "@/components/users/users-admin";
import type { UserListRow, UserRow } from "@/types/models";

export const dynamic = "force-dynamic";

function toUserListRow(u: UserRow): UserListRow {
  return {
    user_id: u.user_id,
    full_name: u.full_name,
    role: u.role,
    is_active: u.is_active,
    partner_id: u.partner_id,
    source_manager_id: u.source_manager_id,
    allowed_country_codes: u.allowed_country_codes,
    allowed_partner_ids: u.allowed_partner_ids,
    token_last_rotated_at: u.token_last_rotated_at,
    created_at: u.created_at,
    updated_at: u.updated_at,
  };
}

export default async function UsersPage() {
  const user = await getSession();
  if (!user) redirect("/access/invalid");
  if (!canPerform(user, "manage_users")) redirect("/app/dashboard");
  const rows = await getUsersFresh();
  return <UsersAdmin initial={rows.map(toUserListRow)} />;
}
