import { partnerPrimaryCountryCode } from "@/lib/partners";
import type { CountryRow, LeadRow, PartnerRow, SourceManagerRow } from "@/types/models";

export function enrichLeadRow(
  partial: Partial<LeadRow> & Pick<LeadRow, "lead_id">,
  ctx: {
    countries: CountryRow[];
    partners: PartnerRow[];
    sourceManagers: SourceManagerRow[];
  },
): LeadRow {
  const base = emptyLead();
  const merged = { ...base, ...partial };
  const country = ctx.countries.find(
    (c) => c.country_code === merged.country_code,
  );
  if (country) {
    merged.country_name = country.country_name;
    if (!merged.contract_currency) merged.contract_currency = country.local_currency;
    if (!merged.fx_rate_to_usd && country.fx_rate_to_usd)
      merged.fx_rate_to_usd = country.fx_rate_to_usd;
  }
  const partner = ctx.partners.find((p) => p.partner_id === merged.partner_id);
  if (partner) {
    merged.partner_name = partner.partner_name;
    if (!merged.country_code) {
      const pc = partnerPrimaryCountryCode(partner);
      if (pc) merged.country_code = pc;
    }
  }
  const sm = ctx.sourceManagers.find(
    (s) => s.source_manager_id === merged.source_manager_id,
  );
  if (sm) merged.source_manager_name = sm.source_manager_name;

  merged.contract_amount_usd = computeUsdAmount(
    merged.contract_amount_local,
    merged.fx_rate_to_usd,
    merged.contract_amount_usd,
  );
  merged.commission_amount_local = computeCommissionLocal(
    merged.contract_amount_local,
    merged.commission_percent,
    merged.commission_amount_local,
  );
  merged.commission_amount_usd = computeUsdAmount(
    merged.commission_amount_local,
    merged.fx_rate_to_usd,
    merged.commission_amount_usd,
  );

  return merged;
}

function emptyLead(): LeadRow {
  const o = {} as Record<string, string>;
  for (const k of [
    "lead_id",
    "crm_deal_id",
    "created_at",
    "updated_at",
    "created_by_user_id",
    "updated_by_user_id",
    "created_by_role",
    "country_code",
    "country_name",
    "partner_id",
    "partner_name",
    "partner_manager_name",
    "source_manager_id",
    "source_manager_name",
    "client_name",
    "client_phone",
    "client_email",
    "client_language",
    "service_type",
    "source_channel",
    "transfer_status",
    "partner_status",
    "final_outcome",
    "lead_priority",
    "sent_to_partner_at",
    "partner_accepted_at",
    "partner_rejected_at",
    "first_contact_at",
    "in_progress_at",
    "proposal_sent_at",
    "contract_signed_at",
    "closed_lost_at",
    "last_update_at",
    "contract_amount_local",
    "contract_currency",
    "fx_rate_to_usd",
    "contract_amount_usd",
    "commission_percent",
    "commission_amount_local",
    "commission_amount_usd",
    "manager_comment",
    "partner_comment",
    "rejection_reason",
    "loss_reason",
    "is_archived",
    "tags",
    "hidden_meta_json",
  ] as const) {
    o[k] = "";
  }
  return o as unknown as LeadRow;
}

function num(v: string): number {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function computeUsdAmount(
  localAmt: string,
  fx: string,
  existingUsd: string,
): string {
  if (existingUsd && num(existingUsd) > 0) return String(num(existingUsd));
  const l = num(localAmt);
  const f = num(fx);
  if (l <= 0 || f <= 0) return "";
  return (l * f).toFixed(2);
}

function computeCommissionLocal(
  contractLocal: string,
  pct: string,
  existing: string,
): string {
  if (existing && num(existing) > 0) return String(num(existing));
  const c = num(contractLocal);
  const p = num(pct);
  if (c <= 0 || p <= 0) return "";
  return ((c * p) / 100).toFixed(2);
}

/** Apply automatic timestamps when status codes transition (first time only). */
export function applyStatusTimestamps(
  prev: LeadRow,
  next: LeadRow,
  statusHints: { inProgressCodes: Set<string>; wonCodes: Set<string>; lostCodes: Set<string> },
): LeadRow {
  const out = { ...next };
  const ps = (out.partner_status || "").toLowerCase();
  const prevPs = (prev.partner_status || "").toLowerCase();

  if (ps && ps !== prevPs) {
    if (!out.last_update_at) out.last_update_at = new Date().toISOString();
    if (statusHints.inProgressCodes.has(ps) && !out.in_progress_at)
      out.in_progress_at = new Date().toISOString();
    if (statusHints.wonCodes.has(ps) && !out.contract_signed_at)
      out.contract_signed_at = new Date().toISOString();
    if (statusHints.lostCodes.has(ps) && !out.closed_lost_at)
      out.closed_lost_at = new Date().toISOString();
  }
  return out;
}
