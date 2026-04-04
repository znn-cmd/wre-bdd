"use server";

import { randomBytes } from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { parsePartnerList, partnerOperatingCountryCodes } from "@/lib/partners";
import { requireSession } from "@/server/auth/get-session";
import { canPerform } from "@/server/auth/rbac";
import {
  appendCountryRow,
  appendPartnerRow,
  appendStatusRow,
  deleteStatusRowByKeys,
  findCountryRowNumber,
  findPartnerRowNumber,
  findStatusRowNumber,
  updateCountryRow,
  updatePartnerRow,
  updateStatusRowAt,
} from "@/server/sheets/repository";
import type { CountryRow, PartnerRow, StatusRow } from "@/types/models";

async function requireCatalogAdmin() {
  const user = await requireSession();
  if (!canPerform(user, "manage_users")) throw new Error("Forbidden");
  return user;
}

function normalizePartnerForSheet(p: PartnerRow): PartnerRow {
  const codes = partnerOperatingCountryCodes(p);
  return {
    ...p,
    country_code: codes[0] ?? "",
    country_codes: codes.slice(1).join(","),
  };
}

const countrySchema = z.object({
  country_code: z.string().min(2).max(8),
  country_name: z.string().min(1).max(120),
  local_currency: z.string().max(16).optional().default(""),
  fx_rate_to_usd: z.string().max(40).optional().default(""),
  active_flag: z.enum(["true", "false"]),
});

export async function adminSaveCountryAction(raw: unknown) {
  await requireCatalogAdmin();
  const input = countrySchema.parse(raw);
  const row: CountryRow = {
    country_code: input.country_code.trim().toUpperCase(),
    country_name: input.country_name.trim(),
    local_currency: input.local_currency,
    fx_rate_to_usd: input.fx_rate_to_usd,
    active_flag: input.active_flag,
  };
  const existing = await findCountryRowNumber(row.country_code);
  if (existing) await updateCountryRow(row.country_code, row);
  else await appendCountryRow(row);
  revalidateTag("countries", "default");
  revalidatePath("/app/catalog");
  revalidatePath("/app/leads");
  return { ok: true as const };
}

const partnerSchema = z.object({
  partner_id: z.string().max(64).optional().default(""),
  partner_name: z.string().min(1).max(200),
  countries_csv: z.string().min(2).max(500),
  source_manager_ids: z.string().max(500).optional().default(""),
  active_flag: z.enum(["true", "false"]),
  owner_name: z.string().max(200).optional().default(""),
  telegram_bot_token: z.string().max(2000).optional().default(""),
  telegram_chat_id: z.string().max(120).optional().default(""),
  notification_enabled: z.enum(["true", "false"]).optional().default("true"),
  default_currency: z.string().max(16).optional().default(""),
  notes: z.string().max(5000).optional().default(""),
});

export async function adminSavePartnerAction(raw: unknown) {
  await requireCatalogAdmin();
  const input = partnerSchema.parse(raw);
  const codes = [
    ...new Set(
      parsePartnerList(input.countries_csv)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  if (codes.length === 0) throw new Error("At least one country code is required");

  let partner_id = input.partner_id.trim();
  const isNew = !partner_id;
  if (isNew) partner_id = `P-${Date.now()}-${randomBytes(2).toString("hex")}`;

  const draft: PartnerRow = {
    partner_id,
    partner_name: input.partner_name.trim(),
    country_code: codes[0] ?? "",
    country_codes: codes.slice(1).join(","),
    source_manager_ids: parsePartnerList(input.source_manager_ids).join(","),
    active_flag: input.active_flag,
    owner_name: input.owner_name,
    telegram_bot_token: input.telegram_bot_token,
    telegram_chat_id: input.telegram_chat_id,
    notification_enabled: input.notification_enabled ?? "true",
    default_currency: input.default_currency,
    notes: input.notes,
  };

  const row = normalizePartnerForSheet(draft);
  if (isNew) await appendPartnerRow(row);
  else await updatePartnerRow(partner_id, row);

  revalidateTag("partners", "default");
  revalidatePath("/app/catalog");
  revalidatePath("/app/leads");
  return { ok: true as const, partner_id };
}

const leadStatusCategorySchema = z.enum(["transfer_status", "partner_status"]);

const statusMutateSchema = z.object({
  category: leadStatusCategorySchema,
  status_code: z.string().min(1).max(80),
  status_label: z.string().min(1).max(200),
  status_description: z.string().max(500).optional().default(""),
  sort_order: z.string().max(20).optional().default("0"),
  is_final: z.enum(["true", "false"]).optional().default("false"),
  active_flag: z.enum(["true", "false"]).optional().default("true"),
  /** Set when updating an existing row (previous `status_code` before any rename). */
  previous_status_code: z.string().max(80).optional().default(""),
});

export async function adminSaveStatusAction(raw: unknown) {
  await requireCatalogAdmin();
  const input = statusMutateSchema.parse(raw);
  const row: StatusRow = {
    category: input.category,
    status_code: input.status_code.trim(),
    status_label: input.status_label.trim(),
    status_description: input.status_description.trim(),
    sort_order: input.sort_order.trim() || "0",
    is_final: input.is_final,
    active_flag: input.active_flag,
  };
  const prev = input.previous_status_code.trim();
  if (!prev) {
    const dup = await findStatusRowNumber(row.category, row.status_code);
    if (dup) throw new Error("This status code already exists in this category");
    await appendStatusRow(row);
  } else {
    const n = await findStatusRowNumber(input.category, prev);
    if (!n) throw new Error("Status not found");
    if (prev !== row.status_code) {
      const clash = await findStatusRowNumber(row.category, row.status_code);
      if (clash != null && clash !== n) {
        throw new Error("This status code already exists in this category");
      }
    }
    await updateStatusRowAt(n, row);
  }
  revalidateTag("statuses", "default");
  revalidatePath("/app/catalog");
  revalidatePath("/app/leads");
  return { ok: true as const };
}

const statusDeleteSchema = z.object({
  category: leadStatusCategorySchema,
  status_code: z.string().min(1).max(80),
});

export async function adminDeleteStatusAction(raw: unknown) {
  await requireCatalogAdmin();
  const input = statusDeleteSchema.parse(raw);
  await deleteStatusRowByKeys(input.category, input.status_code.trim());
  revalidateTag("statuses", "default");
  revalidatePath("/app/catalog");
  revalidatePath("/app/leads");
  return { ok: true as const };
}
