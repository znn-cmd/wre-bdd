import { connection } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/get-session";
import { canManageDirectory } from "@/server/auth/rbac";
import { CatalogAdmin } from "@/components/catalog/catalog-admin";
import { batchLoadReference } from "@/server/sheets/repository";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  noStore();
  await connection();
  const user = await getSession();
  if (!user) redirect("/access/invalid");
  if (!canManageDirectory(user)) redirect("/app/dashboard");
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
