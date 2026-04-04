"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { nowIso, parseSheetBool } from "@/lib/dates";
import { leadCountryMatchesPartner } from "@/lib/partners";
import { createLeadSchema, patchLeadSchema } from "@/lib/schemas/lead";
import { generateAccessToken, hashAccessToken } from "@/lib/token";
import { randomBytes } from "crypto";
import { requireSession } from "@/server/auth/get-session";
import {
  assertLeadWrite,
  canPerform,
  editableLeadFields,
  userCanSeeLead,
} from "@/server/auth/rbac";
import { applyStatusTimestamps, enrichLeadRow } from "@/server/leads/enrich";
import {
  appendAuditRow,
  appendLeadRow,
  appendUserRow,
  batchLoadReference,
  findUserById,
  getLeadById,
  getLeadsFresh,
  getUsersFresh,
  newLogId,
  updateLeadRow,
  updateUserRow,
  upsertViewsConfig,
} from "@/server/sheets/repository";
import type { AuditLogRow, LeadRow, UserRow } from "@/types/models";
import { isUserRole } from "@/types/roles";
import { notifyPartnerNewLead } from "@/server/telegram/notify-new-lead";

function statusHintSets(
  statuses: { category: string; status_code: string }[],
): {
  inProgressCodes: Set<string>;
  wonCodes: Set<string>;
  lostCodes: Set<string>;
} {
  const inProgressCodes = new Set<string>();
  const wonCodes = new Set<string>();
  const lostCodes = new Set<string>();
  for (const s of statuses) {
    const c = (s.status_code || "").toLowerCase();
    if (!c) continue;
    if (s.category === "partner_status") {
      if (c.includes("progress") || c.includes("work")) inProgressCodes.add(c);
      if (c.includes("won") || c.includes("signed") || c.includes("closed_won"))
        wonCodes.add(c);
      if (c.includes("lost") || c.includes("reject") || c.includes("closed_lost"))
        lostCodes.add(c);
    }
  }
  return { inProgressCodes, wonCodes, lostCodes };
}

export async function createLeadAction(raw: unknown) {
  const user = await requireSession();
  if (!canPerform(user, "create")) throw new Error("Forbidden");

  const input = createLeadSchema.parse(raw);
  const ref = await batchLoadReference();
  const partnerRow = ref.partners.find(
    (x) => x.partner_id.trim() === input.partner_id.trim(),
  );
  if (!partnerRow || !parseSheetBool(partnerRow.active_flag)) {
    throw new Error("Unknown or inactive partner");
  }
  if (!leadCountryMatchesPartner(input.country_code, partnerRow)) {
    throw new Error("Selected country is not linked to this partner");
  }
  const leadId = `LD-${Date.now()}-${randomBytes(3).toString("hex")}`;
  const ts = nowIso();

  let sourceManagerId = "";
  if (user.role === "our_manager") sourceManagerId = user.sourceManagerId;

  const row = enrichLeadRow(
    {
      lead_id: leadId,
      crm_deal_id: input.crm_deal_id,
      country_code: input.country_code,
      partner_id: input.partner_id,
      client_name: input.client_name,
      client_phone: input.client_phone,
      client_email: input.client_email,
      client_language: input.client_language,
      service_type: input.service_type,
      source_channel: input.source_channel,
      transfer_status: input.transfer_status || "new",
      partner_status: input.partner_status,
      lead_priority: input.lead_priority,
      contract_amount_local: input.contract_amount_local,
      contract_currency: input.contract_currency,
      fx_rate_to_usd: input.fx_rate_to_usd,
      commission_percent: input.commission_percent,
      manager_comment: input.manager_comment,
      tags: input.tags,
      created_at: ts,
      updated_at: ts,
      created_by_user_id: user.userId,
      updated_by_user_id: user.userId,
      created_by_role: user.role,
      source_manager_id: sourceManagerId,
      is_archived: "false",
      last_update_at: ts,
    },
    ref,
  );

  if (!userCanSeeLead(user, row, ref)) throw new Error("Forbidden scope");

  await appendLeadRow(row);

  const audit: AuditLogRow = {
    log_id: newLogId("AUD"),
    timestamp: ts,
    lead_id: leadId,
    user_id: user.userId,
    user_name: user.fullName,
    user_role: user.role,
    action_type: "create",
    field_name: "*",
    old_value: "",
    new_value: "lead_created",
    comment: "",
    ip_optional: "",
    user_agent_optional: "",
  };
  await appendAuditRow(audit);

  revalidateTag("leads", "default");

  if (
    partnerRow &&
    (user.role === "our_manager" ||
      user.role === "admin" ||
      user.role === "rop" ||
      user.role === "partner_dept_manager")
  ) {
    await notifyPartnerNewLead({ lead: row, partner: partnerRow }).catch(
      () => undefined,
    );
  }

  return { leadId };
}

export async function updateLeadAction(leadId: string, raw: unknown) {
  const user = await requireSession();
  const patch = patchLeadSchema.parse(raw);
  const prev = await getLeadById(leadId);
  if (!prev) throw new Error("Not found");
  const ref = await batchLoadReference();
  if (!userCanSeeLead(user, prev, ref)) throw new Error("Forbidden");

  const allowed = editableLeadFields(user);
  const keysToUpdate: (keyof LeadRow)[] = [];
  for (const k of Object.keys(patch)) {
    const key = k as keyof LeadRow;
    if (allowed !== "all" && !allowed.has(key)) continue;
    keysToUpdate.push(key);
  }
  assertLeadWrite(user, prev, keysToUpdate, ref);

  const next: LeadRow = { ...prev };
  for (const key of keysToUpdate) {
    (next as Record<string, string>)[key] =
      String((patch as Record<string, string>)[key as string] ?? "");
  }

  next.updated_at = nowIso();
  next.updated_by_user_id = user.userId;
  next.last_update_at = next.updated_at;

  const enriched = enrichLeadRow(next, ref);
  const hints = statusHintSets(ref.statuses);
  const withTs = applyStatusTimestamps(prev, enriched, hints);

  if (!userCanSeeLead(user, withTs, ref)) {
    throw new Error("Country or partner is outside your allowed scope");
  }

  const pAfter = ref.partners.find(
    (x) => x.partner_id.trim() === withTs.partner_id.trim(),
  );
  if (pAfter && !leadCountryMatchesPartner(withTs.country_code, pAfter)) {
    throw new Error("Country does not match the selected partner");
  }

  await updateLeadRow(leadId, withTs);

  for (const [field, newVal] of Object.entries(patch)) {
    const key = field as keyof LeadRow;
    if (!keysToUpdate.includes(key)) continue;
    const oldVal = (prev as Record<string, string>)[field] ?? "";
    if (oldVal === newVal) continue;
    await appendAuditRow({
      log_id: newLogId("AUD"),
      timestamp: nowIso(),
      lead_id: leadId,
      user_id: user.userId,
      user_name: user.fullName,
      user_role: user.role,
      action_type: "update",
      field_name: field,
      old_value: oldVal.slice(0, 5000),
      new_value: String(newVal ?? "").slice(0, 5000),
      comment: "",
      ip_optional: "",
      user_agent_optional: "",
    });
  }

  revalidateTag("leads", "default");
  return { ok: true as const };
}

export async function listLeadsForSession() {
  const user = await requireSession();
  const [leads, ref] = await Promise.all([getLeadsFresh(), batchLoadReference()]);
  return leads.filter((l) => userCanSeeLead(user, l, ref));
}

const userUpsertSchema = z.object({
  full_name: z.string().min(1).max(200),
  role: z.string(),
  is_active: z.enum(["true", "false"]),
  partner_id: z.string().max(64).optional().default(""),
  source_manager_id: z.string().max(64).optional().default(""),
  allowed_country_codes: z.string().max(500).optional().default(""),
  allowed_partner_ids: z.string().max(500).optional().default(""),
});

export async function adminCreateUserAction(raw: unknown) {
  const user = await requireSession();
  if (!canPerform(user, "manage_users")) throw new Error("Forbidden");
  const input = userUpsertSchema.parse(raw);
  if (!isUserRole(input.role)) throw new Error("Invalid role");
  const plain = generateAccessToken(32);
  const ts = nowIso();
  const id = `U-${Date.now()}-${randomBytes(2).toString("hex")}`;
  const row: UserRow = {
    user_id: id,
    full_name: input.full_name,
    role: input.role,
    is_active: input.is_active,
    token_hash: hashAccessToken(plain),
    token_last_rotated_at: ts,
    token_expires_at: "",
    partner_id: input.partner_id,
    source_manager_id: input.source_manager_id,
    allowed_country_codes: input.allowed_country_codes,
    allowed_partner_ids: input.allowed_partner_ids,
    telegram_chat_id_optional: "",
    dashboard_preset_json: "{}",
    created_at: ts,
    updated_at: ts,
  };
  await appendUserRow(row);
  revalidateTag("users", "default");
  try {
    revalidatePath("/app/users", "page");
  } catch {
    /* Vercel: tag invalidation is enough if path revalidation store is missing */
  }
  return { userId: id, accessToken: plain };
}

export async function adminUpdateUserAction(userId: string, raw: unknown) {
  const user = await requireSession();
  if (!canPerform(user, "manage_users")) throw new Error("Forbidden");
  const input = userUpsertSchema.parse(raw);
  if (!isUserRole(input.role)) throw new Error("Invalid role");
  const existing = await findUserById(userId);
  if (!existing) throw new Error("Not found");
  const ts = nowIso();
  const row: UserRow = {
    ...existing,
    full_name: input.full_name,
    role: input.role,
    is_active: input.is_active,
    partner_id: input.partner_id,
    source_manager_id: input.source_manager_id,
    allowed_country_codes: input.allowed_country_codes,
    allowed_partner_ids: input.allowed_partner_ids,
    updated_at: ts,
  };
  await updateUserRow(userId, row);
  revalidateTag("users", "default");
  try {
    revalidatePath("/app/users", "page");
  } catch {
    /* see adminCreateUserAction */
  }
  return { ok: true as const };
}

export async function adminRotateUserTokenAction(userId: string) {
  const user = await requireSession();
  if (!canPerform(user, "manage_users")) throw new Error("Forbidden");
  const existing = await findUserById(userId);
  if (!existing) throw new Error("Not found");
  const plain = generateAccessToken(32);
  const ts = nowIso();
  const row: UserRow = {
    ...existing,
    token_hash: hashAccessToken(plain),
    token_last_rotated_at: ts,
    updated_at: ts,
  };
  await updateUserRow(userId, row);
  revalidateTag("users", "default");
  try {
    revalidatePath("/app/users", "page");
  } catch {
    /* see adminCreateUserAction */
  }
  return { accessToken: plain };
}

export async function listUsersAction() {
  const user = await requireSession();
  if (!canPerform(user, "manage_users")) throw new Error("Forbidden");
  return getUsersFresh();
}

export async function saveViewsPresetAction(configKey: string, configJson: string) {
  const user = await requireSession();
  await upsertViewsConfig(user.userId, user.role, configKey, configJson);
  return { ok: true as const };
}
