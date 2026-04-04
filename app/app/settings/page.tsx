import { connection } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/get-session";
import { canUseSettingsPage } from "@/server/auth/rbac";
import { SettingsForm } from "@/components/settings/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  noStore();
  await connection();
  const user = await getSession();
  if (!user) redirect("/access/invalid");
  if (!canUseSettingsPage(user)) redirect("/app/dashboard");
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <h1 className="text-lg font-semibold">Settings</h1>
      <p className="text-xs text-neutral-500">
        Save UI presets (column visibility, filters) as JSON. Admin-only
        critical system keys stay in the Google Sheet{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
          System_Settings
        </code>
        .
      </p>
      <SettingsForm userId={user.userId} role={user.role} />
    </div>
  );
}
