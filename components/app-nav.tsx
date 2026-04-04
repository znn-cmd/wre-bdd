import Link from "next/link";
import type { SessionUser } from "@/types/models";
import {
  canManageDirectory,
  canUseSettingsPage,
} from "@/server/auth/rbac";

export function AppNav({ user }: { user: SessionUser }) {
  const showUsers = canManageDirectory(user);
  const showSettings = canUseSettingsPage(user);

  const link =
    "rounded-md px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100";

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto flex h-11 max-w-[1400px] items-center gap-3 px-3">
        <span className="text-sm font-semibold tracking-tight">Lead Hub</span>
        <nav className="flex flex-1 flex-wrap items-center gap-1">
          <Link prefetch={false} className={link} href="/app/dashboard">
            Dashboard
          </Link>
          <Link prefetch={false} className={link} href="/app/leads">
            Leads
          </Link>
          <Link prefetch={false} className={link} href="/app/audit">
            Audit
          </Link>
          {showSettings ? (
            <Link prefetch={false} className={link} href="/app/settings">
              Settings
            </Link>
          ) : null}
          {showUsers ? (
            <Link prefetch={false} className={link} href="/app/users">
              Users
            </Link>
          ) : null}
          {showUsers ? (
            <Link prefetch={false} className={link} href="/app/catalog">
              Catalog
            </Link>
          ) : null}
        </nav>
        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="max-w-[140px] truncate" title={user.fullName}>
            {user.fullName}
          </span>
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
            {user.role.replace(/_/g, " ")}
          </span>
          <Link
            prefetch={false}
            className="text-blue-600 hover:underline dark:text-blue-400"
            href="/app/logout"
          >
            Leave
          </Link>
        </div>
      </div>
    </header>
  );
}
