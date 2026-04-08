import Link from "next/link";
import { redirect } from "next/navigation";
import {
  maskPhoneLastFourDigits,
  shouldMaskClientPhoneForRole,
} from "@/lib/phone-display";
import {
  statusColorTextClass,
  statusLabelForCode,
  statusRowForCode,
} from "@/lib/status-labels";
import { cn } from "@/lib/utils";
import { getSession } from "@/server/auth/get-session";
import { userCanSeeLead } from "@/server/auth/rbac";
import { batchLoadReference, getLeadById } from "@/server/sheets/repository";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const user = await getSession();
  if (!user) redirect("/access/invalid");
  const [lead, ref] = await Promise.all([
    getLeadById(decodeURIComponent(leadId)),
    batchLoadReference(),
  ]);
  if (!lead || !userCanSeeLead(user, lead, ref)) redirect("/app/leads");

  const phoneDisplay = shouldMaskClientPhoneForRole(user.role)
    ? maskPhoneLastFourDigits(lead.client_phone)
    : lead.client_phone;

  const statuses = ref.statuses;

  function statusDd(
    label: string,
    category: "transfer_status" | "partner_status" | "final_outcome",
    code: string,
  ) {
    const text = statusLabelForCode(statuses, category, code);
    const tone = statusColorTextClass(
      statusRowForCode(statuses, category, code)?.color ?? "",
    );
    return (
      <div
        className="grid grid-cols-[120px_1fr] gap-2 border-b border-neutral-100 py-1 dark:border-neutral-900"
      >
        <dt className="text-xs text-neutral-500">{label}</dt>
        <dd className={cn("break-words", tone)}>{text}</dd>
      </div>
    );
  }

  const rows: [string, string][] = [
    ["Lead ID", lead.lead_id],
    ["CRM", lead.crm_deal_id],
    ["Client", lead.client_name],
    ["Phone", phoneDisplay],
    ["Email", lead.client_email],
    ["Partner", lead.partner_name],
    ["Country", `${lead.country_code} ${lead.country_name}`],
    ["Our manager", lead.source_manager_name],
    ["Partner manager", lead.partner_manager_name],
    ["Updated", lead.updated_at],
    ["Manager comment", lead.manager_comment],
    ["Partner comment", lead.partner_comment],
  ];

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <Link
        prefetch={false}
        href="/app/leads"
        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
      >
        ← All leads
      </Link>
      <h1 className="text-lg font-semibold">{lead.client_name}</h1>
      <dl className="grid gap-2 text-sm">
        {rows.slice(0, 7).map(([k, v]) => (
          <div
            key={k}
            className="grid grid-cols-[120px_1fr] gap-2 border-b border-neutral-100 py-1 dark:border-neutral-900"
          >
            <dt className="text-xs text-neutral-500">{k}</dt>
            <dd className="break-words">{v || "—"}</dd>
          </div>
        ))}
        {statusDd("Transfer", "transfer_status", lead.transfer_status)}
        {statusDd("Partner status", "partner_status", lead.partner_status)}
        {statusDd("Final outcome", "final_outcome", lead.final_outcome)}
        {rows.slice(7).map(([k, v]) => (
          <div
            key={k}
            className="grid grid-cols-[120px_1fr] gap-2 border-b border-neutral-100 py-1 dark:border-neutral-900"
          >
            <dt className="text-xs text-neutral-500">{k}</dt>
            <dd className="break-words">{v || "—"}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-neutral-500">
        To edit, use the Leads table and open the row dialog.
      </p>
    </div>
  );
}
