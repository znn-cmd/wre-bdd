import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/get-session";
import { canPerform } from "@/server/auth/rbac";
import { CatalogAdmin } from "@/components/catalog/catalog-admin";
import { batchLoadReference } from "@/server/sheets/repository";

export default async function CatalogPage() {
  const user = await getSession();
  if (!user) redirect("/access/invalid");
  if (!canPerform(user, "manage_users")) redirect("/app/dashboard");
  const ref = await batchLoadReference();
  return (
    <CatalogAdmin
      countries={ref.countries}
      partners={ref.partners}
      sourceManagers={ref.sourceManagers}
      statuses={ref.statuses}
    />
  );
}
