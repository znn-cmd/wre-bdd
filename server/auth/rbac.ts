import type { LeadRow } from "@/types/models";
import type { SessionUser } from "@/types/models";
import type { UserRole } from "@/types/roles";
import { normalizeUserRole } from "@/types/roles";
import { parseSheetBool } from "@/lib/dates";
import {
  type SheetReferenceBundle,
  ourManagerLeadAllowedByScope,
} from "./our-manager-scope";

function normCountryCode(code: string): string {
  return (code ?? "").trim().toUpperCase();
}

function leadCountryAllowedBySession(user: SessionUser, leadCountry: string) {
  if (user.allowedCountryCodes.length === 0) return true;
  const lc = normCountryCode(leadCountry);
  return user.allowedCountryCodes.some((c) => normCountryCode(c) === lc);
}

function leadPartnerAllowedBySession(user: SessionUser, partnerId: string) {
  if (user.allowedPartnerIds.length === 0) return true;
  const pid = (partnerId ?? "").trim();
  return user.allowedPartnerIds.some((id) => id.trim() === pid);
}

export function userCanSeeLead(
  user: SessionUser,
  lead: LeadRow,
  ref?: SheetReferenceBundle,
): boolean {
  if (parseSheetBool(lead.is_archived) && !canSeeArchived(user)) {
    return false;
  }
  switch (user.role) {
    case "admin":
    case "rop":
    case "partner_dept_manager":
      return scopeDeptManager(user, lead);
    case "our_manager":
      // Visibility follows catalog geography + Source_Manager scopes
      // (`ourManagerLeadAllowedByScope`), not `lead.source_manager_id`.
      // Otherwise leads created by admin / with empty owner id are invisible.
      if (ref) return ourManagerLeadAllowedByScope(user, lead, ref);
      return scopeOurManagerCountries(user, lead);
    case "partner":
      return lead.partner_id === user.partnerId;
    default:
      return false;
  }
}

function canSeeArchived(user: SessionUser): boolean {
  return (
    user.role === "admin" ||
    user.role === "rop" ||
    user.role === "partner_dept_manager"
  );
}

/** Optional narrowing for dept manager via allowed_* lists (empty = all). */
function scopeDeptManager(user: SessionUser, lead: LeadRow): boolean {
  if (!leadCountryAllowedBySession(user, lead.country_code)) return false;
  if (!leadPartnerAllowedBySession(user, lead.partner_id)) return false;
  return true;
}

function scopeOurManagerCountries(user: SessionUser, lead: LeadRow): boolean {
  if (!leadCountryAllowedBySession(user, lead.country_code)) return false;
  if (!leadPartnerAllowedBySession(user, lead.partner_id)) return false;
  return true;
}

export function filterLeadsForUser<T extends LeadRow>(
  user: SessionUser,
  leads: T[],
  ref?: SheetReferenceBundle,
): T[] {
  return leads.filter((l) => userCanSeeLead(user, l, ref));
}

export type LeadAction =
  | "create"
  | "read"
  | "update"
  | "status"
  | "comment_manager"
  | "comment_partner"
  | "assign_partner_manager"
  | "transfer"
  | "archive"
  | "view_audit"
  | "manage_users"
  | "system_settings_critical";

/** Canonical role from session (handles hidden Unicode / aliases). */
export function resolvedSessionRole(user: SessionUser): UserRole | null {
  return normalizeUserRole(String(user.role ?? ""));
}

/**
 * Users sheet + catalog: same privilege tier as broad lead ops (admin, ROP, dept manager).
 * "admin" alone was too strict when the sheet role or JWT claim differs slightly.
 */
export function canManageDirectory(user: SessionUser): boolean {
  const r = resolvedSessionRole(user);
  return (
    r === "admin" || r === "rop" || r === "partner_dept_manager"
  );
}

/** Settings page (presets). */
export function canUseSettingsPage(user: SessionUser): boolean {
  const r = resolvedSessionRole(user);
  return r === "admin" || r === "rop" || r === "partner_dept_manager";
}

export function canPerform(
  user: SessionUser,
  action: LeadAction,
): boolean {
  switch (action) {
    case "create":
      return (
        user.role === "our_manager" ||
        user.role === "admin" ||
        user.role === "rop" ||
        user.role === "partner_dept_manager"
      );
    case "read":
    case "update":
    case "status":
    case "comment_manager":
    case "transfer":
      return (
        user.role === "our_manager" ||
        user.role === "admin" ||
        user.role === "rop" ||
        user.role === "partner_dept_manager" ||
        user.role === "partner"
      );
    case "comment_partner":
    case "assign_partner_manager":
      return user.role === "partner" || user.role === "partner_dept_manager";
    case "archive":
      return (
        user.role === "admin" ||
        user.role === "rop" ||
        user.role === "partner_dept_manager"
      );
    case "view_audit":
      return true;
    case "manage_users":
      return canManageDirectory(user);
    case "system_settings_critical":
      return resolvedSessionRole(user) === "admin";
    default:
      return false;
  }
}

/** Fields a role may PATCH on a lead (server-enforced). */
export function editableLeadFields(
  user: SessionUser,
): Set<keyof LeadRow> | "all" {
  if (user.role === "admin" || user.role === "rop") return "all";
  if (user.role === "partner_dept_manager") {
    return new Set([
      ...PARTNER_FIELDS,
      ...OUR_MANAGER_FIELDS,
      "partner_id",
      "source_manager_id",
      "country_code",
      "is_archived",
    ] as (keyof LeadRow)[]);
  }
  if (user.role === "our_manager") {
    return new Set(OUR_MANAGER_FIELDS);
  }
  if (user.role === "partner") {
    return new Set(PARTNER_FIELDS);
  }
  return new Set();
}

const PARTNER_FIELDS: (keyof LeadRow)[] = [
  "partner_status",
  "partner_comment",
  "partner_manager_name",
  "last_update_at",
  "hidden_meta_json",
];

const OUR_MANAGER_FIELDS: (keyof LeadRow)[] = [
  "crm_deal_id",
  "country_code",
  "partner_id",
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
  "contract_amount_local",
  "contract_currency",
  "fx_rate_to_usd",
  "contract_amount_usd",
  "commission_percent",
  "commission_amount_local",
  "commission_amount_usd",
  "manager_comment",
  "rejection_reason",
  "loss_reason",
  "tags",
  "hidden_meta_json",
  "last_update_at",
  "sent_to_partner_at",
];

export function canUpdateLeadField(
  user: SessionUser,
  field: keyof LeadRow,
  lead: LeadRow,
  ref?: SheetReferenceBundle,
): boolean {
  if (!userCanSeeLead(user, lead, ref)) return false;
  const set = editableLeadFields(user);
  if (set === "all") return true;
  return set.has(field);
}

export function assertLeadWrite(
  user: SessionUser,
  lead: LeadRow,
  fields: (keyof LeadRow)[],
  ref?: SheetReferenceBundle,
) {
  for (const f of fields) {
    if (!canUpdateLeadField(user, f, lead, ref)) {
      throw new Error(`Forbidden field: ${String(f)}`);
    }
  }
}
