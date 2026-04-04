import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/config/constants";
import { verifySessionToken } from "./session-jwt";
import type { SessionUser } from "@/types/models";
import { normalizeUserRole } from "@/types/roles";

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  const v = await verifySessionToken(raw);
  if (!v) return null;
  const role = normalizeUserRole(v.role);
  if (!role) return null;
  return {
    userId: v.userId,
    fullName: v.fullName,
    role,
    partnerId: v.partnerId,
    sourceManagerId: v.sourceManagerId,
    allowedCountryCodes: v.allowedCountryCodes,
    allowedPartnerIds: v.allowedPartnerIds,
  };
});

export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new Error("Unauthorized");
  return s;
}
