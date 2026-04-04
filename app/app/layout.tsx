import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/get-session";
import { AppNav } from "@/components/app-nav";

export const dynamic = "force-dynamic";

export default async function AppSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/access/invalid");
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav user={user} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-3">
        {children}
      </main>
    </div>
  );
}
