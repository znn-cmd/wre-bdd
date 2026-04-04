import { requireLeadsContext } from "@/server/data/load-app";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default async function DashboardPage() {
  const { user, leads, ref } = await requireLeadsContext();
  return (
    <DashboardView user={user} leads={leads} statuses={ref.statuses} />
  );
}
