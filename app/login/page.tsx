import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/get-session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect("/app/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12 dark:bg-neutral-950">
      <LoginForm />
    </div>
  );
}
