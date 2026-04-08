import {
  maskPhoneLastFourDigits,
  shouldMaskClientPhoneForRole,
} from "@/lib/phone-display";
import { requireLeadsContext } from "@/server/data/load-app";
import { getSession } from "@/server/auth/get-session";
import { redirect } from "next/navigation";
import { loadAuditLogPage } from "@/server/sheets/repository";

function auditChangeDisplay(
  fieldName: string,
  oldVal: string,
  newVal: string,
  maskPhone: boolean,
): { old: string; new: string } {
  const isPhone = (fieldName ?? "").trim() === "client_phone";
  if (!maskPhone || !isPhone) {
    return { old: oldVal, new: newVal };
  }
  return {
    old: maskPhoneLastFourDigits(oldVal),
    new: maskPhoneLastFourDigits(newVal),
  };
}

export default async function AuditPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const { leads } = await requireLeadsContext();
  const maskPhone = shouldMaskClientPhoneForRole(user.role);
  const visibleIds = new Set(leads.map((l) => l.lead_id));
  const logs = await loadAuditLogPage({ maxRows: 1500 });
  const filtered = logs.filter(
    (l) => !l.lead_id || visibleIds.has(l.lead_id),
  );

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-lg font-semibold">Audit log</h1>
      <p className="text-xs text-neutral-500">
        {filtered.length} entries (filtered to leads you can access).
      </p>
      <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-neutral-50 text-[10px] uppercase text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="border-b px-2 py-2">Time</th>
              <th className="border-b px-2 py-2">Lead</th>
              <th className="border-b px-2 py-2">User</th>
              <th className="border-b px-2 py-2">Role</th>
              <th className="border-b px-2 py-2">Action</th>
              <th className="border-b px-2 py-2">Field</th>
              <th className="border-b px-2 py-2">Change</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const { old: oldD, new: newD } = auditChangeDisplay(
                row.field_name,
                row.old_value,
                row.new_value,
                maskPhone,
              );
              return (
              <tr
                key={row.log_id}
                className="border-b border-neutral-100 dark:border-neutral-900"
              >
                <td className="whitespace-nowrap px-2 py-1 text-[11px] text-neutral-500">
                  {row.timestamp.slice(0, 19).replace("T", " ")}
                </td>
                <td className="max-w-[100px] truncate px-2 py-1 font-mono">
                  {row.lead_id}
                </td>
                <td className="max-w-[120px] truncate px-2 py-1">
                  {row.user_name}
                </td>
                <td className="px-2 py-1">{row.user_role}</td>
                <td className="px-2 py-1">{row.action_type}</td>
                <td className="px-2 py-1">{row.field_name}</td>
                <td className="max-w-[280px] truncate px-2 py-1 text-neutral-600 dark:text-neutral-400" title={`${oldD} → ${newD}`}>
                  {oldD.slice(0, 40)}
                  {oldD ? " → " : ""}
                  {newD.slice(0, 40)}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
