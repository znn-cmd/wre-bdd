import { redirect } from "next/navigation";
import { narrowReferenceForLeadsUi } from "@/server/auth/our-manager-scope";
import { filterLeadsForUser } from "@/server/auth/rbac";
import { getSession } from "@/server/auth/get-session";
import { batchLoadReference, getLeadsFresh } from "@/server/sheets/repository";

export async function requireLeadsContext() {
  const user = await getSession();
  if (!user) redirect("/access/invalid");
  const [leads, ref] = await Promise.all([getLeadsFresh(), batchLoadReference()]);
  const visible = filterLeadsForUser(user, leads, ref);
  const refUi = narrowReferenceForLeadsUi(user, ref);
  return { user, leads: visible, ref: refUi, allLeadsCount: leads.length };
}
