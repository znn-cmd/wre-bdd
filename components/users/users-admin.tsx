"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { UserListRow } from "@/types/models";
import {
  adminCreateUserAction,
  adminRotateUserTokenAction,
  adminUpdateUserAction,
} from "@/server/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROLES = [
  "partner",
  "our_manager",
  "partner_dept_manager",
  "admin",
  "rop",
] as const;

function pickUiRole(r: string): string {
  return ROLES.includes(r as (typeof ROLES)[number]) ? r : "our_manager";
}

export function UsersAdmin({ initial }: { initial: UserListRow[] }) {
  const router = useRouter();
  const [tokenModal, setTokenModal] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    React.startTransition(() => {
      router.refresh();
    });
  }, [router]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Users</h1>
      <CreateUser
        onDone={(t) => {
          setTokenModal(t);
          refresh();
        }}
      />
      <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[800px] border-collapse text-left text-xs">
          <thead className="bg-neutral-50 text-[10px] uppercase dark:bg-neutral-900">
            <tr>
              <th className="border-b px-2 py-2">Name</th>
              <th className="border-b px-2 py-2">Login</th>
              <th className="border-b px-2 py-2">Role</th>
              <th className="border-b px-2 py-2">Active</th>
              <th className="border-b px-2 py-2">Partner</th>
              <th className="border-b px-2 py-2">Manager id</th>
              <th className="border-b px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initial.map((u) => (
              <UserRowEditor
                key={u.user_id}
                u={u}
                onSaved={refresh}
                onToken={(t) => setTokenModal(t)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {tokenModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-lg rounded-lg border bg-white p-4 shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="text-sm font-semibold">New access token</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Copy now. It is not stored in plain text.
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-neutral-100 p-2 text-[11px] dark:bg-neutral-900">
              {tokenModal}
            </pre>
            <Button
              className="mt-2"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(tokenModal);
                toast.success("Copied");
              }}
            >
              Copy
            </Button>
            <Button
              className="mt-2 ml-2"
              variant="secondary"
              size="sm"
              onClick={() => setTokenModal(null)}
            >
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CreateUser({
  onDone,
}: {
  onDone: (token: string) => void;
}) {
  const [full_name, setName] = React.useState("");
  const [login, setLogin] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<string>("our_manager");
  const [partner_id, setPid] = React.useState("");
  const [source_manager_id, setSm] = React.useState("");

  const submit = async () => {
    try {
      const res = await adminCreateUserAction({
        full_name,
        login,
        password,
        role,
        is_active: "true",
        partner_id,
        source_manager_id,
        allowed_country_codes: "",
        allowed_partner_ids: "",
      });
      toast.success("User created");
      onDone(res.accessToken);
      setName("");
      setLogin("");
      setPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <h2 className="text-sm font-medium">Create user</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label>Full name</Label>
          <Input value={full_name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label>Login (optional)</Label>
          <Input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="off"
            placeholder="e.g. ivan — for password sign-in"
          />
        </div>
        <div className="grid gap-1">
          <Label>Password (optional)</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Stored hashed; required if login set"
          />
        </div>
        <div className="grid gap-1">
          <Label>Role</Label>
          <select
            className="h-8 rounded-md border px-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label>Partner id (partner role)</Label>
          <Input value={partner_id} onChange={(e) => setPid(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label>Source manager id</Label>
          <Input value={source_manager_id} onChange={(e) => setSm(e.target.value)} />
        </div>
      </div>
      <Button className="mt-2" size="sm" type="button" onClick={() => void submit()}>
        Create
      </Button>
    </div>
  );
}

function UserRowEditor({
  u,
  onSaved,
  onToken,
}: {
  u: UserListRow;
  onSaved: () => void;
  onToken: (t: string) => void;
}) {
  const [full_name, setName] = React.useState(u.full_name);
  const [login, setLogin] = React.useState(u.login ?? "");
  const [password_new, setPasswordNew] = React.useState("");
  const [role, setRole] = React.useState(() => pickUiRole(String(u.role)));
  const [is_active, setActive] = React.useState(
    u.is_active === "true" || u.is_active === "1" || u.is_active === "TRUE"
      ? "true"
      : "false",
  );
  const [partner_id, setPid] = React.useState(u.partner_id);
  const [source_manager_id, setSm] = React.useState(u.source_manager_id);

  React.useEffect(() => {
    setName(u.full_name);
    setLogin(u.login ?? "");
    setPasswordNew("");
    setRole(pickUiRole(String(u.role)));
    setActive(
      u.is_active === "true" || u.is_active === "1" || u.is_active === "TRUE"
        ? "true"
        : "false",
    );
    setPid(u.partner_id);
    setSm(u.source_manager_id);
  }, [
    u.user_id,
    u.updated_at,
    u.full_name,
    u.login,
    u.role,
    u.is_active,
    u.partner_id,
    u.source_manager_id,
  ]);

  const save = async () => {
    try {
      await adminUpdateUserAction(u.user_id, {
        full_name,
        login,
        password_new,
        role,
        is_active: is_active === "true" || is_active === "1" ? "true" : "false",
        partner_id,
        source_manager_id,
        allowed_country_codes: u.allowed_country_codes,
        allowed_partner_ids: u.allowed_partner_ids,
      });
      toast.success("Updated");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const rotate = async () => {
    try {
      const res = await adminRotateUserTokenAction(u.user_id);
      onToken(res.accessToken);
      // Defer refresh so the RSC round-trip does not race the Sheet write / revalidation.
      setTimeout(() => onSaved(), 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-900">
      <td className="px-2 py-1">
        <Input
          className="h-7 text-xs"
          value={full_name}
          onChange={(e) => setName(e.target.value)}
        />
      </td>
      <td className="px-2 py-1">
        <div className="grid gap-1">
          <Input
            className="h-7 text-xs"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="login"
            autoComplete="off"
          />
          <Input
            className="h-7 text-xs"
            type="password"
            value={password_new}
            onChange={(e) => setPasswordNew(e.target.value)}
            placeholder="New password (optional)"
            autoComplete="new-password"
          />
        </div>
      </td>
      <td className="px-2 py-1">
        <select
          className="h-7 w-full rounded border px-1 text-xs"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1">
        <select
          className="h-7 rounded border px-1 text-xs"
          value={is_active === "true" || is_active === "1" ? "true" : "false"}
          onChange={(e) => setActive(e.target.value)}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </td>
      <td className="px-2 py-1">
        <Input
          className="h-7 text-xs"
          value={partner_id}
          onChange={(e) => setPid(e.target.value)}
        />
      </td>
      <td className="px-2 py-1">
        <Input
          className="h-7 text-xs"
          value={source_manager_id}
          onChange={(e) => setSm(e.target.value)}
        />
      </td>
      <td className="space-x-1 px-2 py-1">
        <Button size="sm" variant="secondary" type="button" onClick={() => void save()}>
          Save
        </Button>
        <Button size="sm" type="button" onClick={() => void rotate()}>
          Rotate link
        </Button>
      </td>
    </tr>
  );
}
