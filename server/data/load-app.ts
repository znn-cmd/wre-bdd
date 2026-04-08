import { redirect } from "next/navigation";
import {
  redactLeadPhoneForPartner,
  shouldMaskClientPhoneForRole,
} from "@/lib/phone-display";
import { narrowReferenceForLeadsUi } from "@/server/auth/our-manager-scope";
import { filterLeadsForUser } from "@/server/auth/rbac";
import { getSession } from "@/server/auth/get-session";
import { batchLoadReference, getLeadsFresh } from "@/server/sheets/repository";

export async function requireLeadsContext() {
  const user = await getSession();
  if (!user) redirect("/access/invalid");
  const [leads, ref] = await Promise.all([getLeadsFresh(), batchLoadReference()]);
  const visible = filterLeadsForUser(user, leads, ref);
  const leadsForUi = shouldMaskClientPhoneForRole(user.role)
    ? visible.map(redactLeadPhoneForPartner)
    : visible;
  const refUi = narrowReferenceForLeadsUi(user, ref);
  return { user, leads: leadsForUi, ref: refUi, allLeadsCount: leads.length };
}
