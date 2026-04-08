"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginWithPasswordAction } from "@/server/actions/auth-login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginWithPasswordAction,
    null,
  );

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Use the login and password from your administrator. Access via link
          still works:{" "}
          <code className="rounded bg-neutral-100 px-1 text-[10px] dark:bg-neutral-900">
            /access/&lt;token&gt;
          </code>
        </p>
      </div>
      <form action={formAction} className="grid gap-3">
        {state?.error ? (
          <p
            className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}
        <div className="grid gap-1">
          <Label htmlFor="login">Login</Label>
          <Input
            id="login"
            name="login"
            type="text"
            autoComplete="username"
            required
            disabled={pending}
            className="h-9"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className="h-9"
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="text-center text-xs text-neutral-500">
        <Link
          href="/"
          className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        >
          Home
        </Link>
        {" · "}
        <Link
          href="/access/invalid"
          className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        >
          Link help
        </Link>
      </p>
    </div>
  );
}
