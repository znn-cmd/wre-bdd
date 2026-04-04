import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/get-session";
import { canPerform } from "@/server/auth/rbac";
import { getUsersFresh } from "@/server/sheets/repository";
import { UsersAdmin } from "@/components/users/users-admin";

export default async function UsersPage() {
  const user = await getSession();
  if (!user) redirect("/access/invalid");
  if (!canPerform(user, "manage_users")) redirect("/app/dashboard");
  const rows = await getUsersFresh();
  return <UsersAdmin initial={rows} />;
}
