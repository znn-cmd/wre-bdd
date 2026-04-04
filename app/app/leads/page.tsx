import { requireLeadsContext } from "@/server/data/load-app";
import { LeadsWorkspace } from "@/components/leads/leads-workspace";
import { canPerform } from "@/server/auth/rbac";

export default async function LeadsPage() {
  const { user, leads, ref } = await requireLeadsContext();
  const canCreate = canPerform(user, "create");
  const refPack = {
    partners: ref.partners,
    countries: ref.countries.map((c) => ({
      country_code: c.country_code,
      country_name: c.country_name,
    })),
    statuses: ref.statuses,
  };
  return (
    <LeadsWorkspace
      user={user}
      leads={leads}
      reference={refPack}
      canCreate={canCreate}
    />
  );
}
