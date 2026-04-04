import Link from "next/link";
import { redirect } from "next/navigation";
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

  const rows: [string, string][] = [
    ["Lead ID", lead.lead_id],
    ["CRM", lead.crm_deal_id],
    ["Client", lead.client_name],
    ["Phone", lead.client_phone],
    ["Email", lead.client_email],
    ["Partner", lead.partner_name],
    ["Country", `${lead.country_code} ${lead.country_name}`],
    ["Transfer", lead.transfer_status],
    ["Partner status", lead.partner_status],
    ["Final outcome", lead.final_outcome],
    ["Our manager", lead.source_manager_name],
    ["Partner manager", lead.partner_manager_name],
    ["Updated", lead.updated_at],
    ["Manager comment", lead.manager_comment],
    ["Partner comment", lead.partner_comment],
  ];

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <Link
        href="/app/leads"
        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
      >
        ← All leads
      </Link>
      <h1 className="text-lg font-semibold">{lead.client_name}</h1>
      <dl className="grid gap-2 text-sm">
        {rows.map(([k, v]) => (
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
