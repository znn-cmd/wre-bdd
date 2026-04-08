import type { UserRow } from "@/types/models";
import { normalizeUserRole } from "@/types/roles";
import { signSession } from "@/server/auth/session-jwt";

const WEEK_SEC = 60 * 60 * 24 * 7;

export async function signSessionJwtForUserRow(
  user: UserRow,
  maxAgeSec: number = WEEK_SEC,
): Promise<string> {
  const role = normalizeUserRole(user.role ?? "");
  if (!role) throw new Error("Invalid role");
  return signSession(
    {
      sub: user.user_id,
      name: user.full_name,
      role,
      partnerId: user.partner_id ?? "",
      sourceManagerId: user.source_manager_id ?? "",
      countries: user.allowed_country_codes ?? "",
      partners: user.allowed_partner_ids ?? "",
    },
    maxAgeSec,
  );
}
