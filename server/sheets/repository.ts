import { unstable_cache } from "next/cache";
import {
  HEADERS,
  SHEET_NAMES,
  objectToRow,
  rowToObject,
} from "@/config/spreadsheet";
import type {
  AuditLogRow,
  CountryRow,
  LeadRow,
  PartnerManagerRow,
  PartnerRow,
  SourceManagerRow,
  StatusRow,
  SystemSettingRow,
  TelegramLogRow,
  UserRow,
  ViewsConfigRow,
} from "@/types/models";
import {
  appendRow,
  batchReadRanges,
  deleteGridRow,
  readSheetRange,
  updateWideRow,
} from "./client";
import { randomBytes } from "crypto";
import { nowIso, parseSheetBool } from "@/lib/dates";
import { columnEndLetterFromCount } from "@/lib/sheet-range";

const LEADS_HEADERS = HEADERS.Leads;
const USERS_HEADERS = HEADERS.Users;

const colEnd = columnEndLetterFromCount;

async function loadLeadsRaw(): Promise<LeadRow[]> {
  const rows = await readSheetRange(
    `${SHEET_NAMES.Leads}!A2:${colEnd(LEADS_HEADERS.length)}`,
  );
  return rows
    .filter((r) => (r[0] ?? "").trim() !== "")
    .map((r) => rowToObject<LeadRow>(LEADS_HEADERS, padRow(r, LEADS_HEADERS.length)));
}

function padRow(row: string[], len: number): string[] {
  const out = [...row];
  while (out.length < len) out.push("");
  return out.slice(0, len);
}

export const getCachedLeads = unstable_cache(
  async () => loadLeadsRaw(),
  ["leads-all"],
  { revalidate: 15, tags: ["leads"] },
);

export async function getLeadsFresh(): Promise<LeadRow[]> {
  return loadLeadsRaw();
}

export async function findLeadRowNumber(leadId: string): Promise<number | null> {
  const rows = await readSheetRange(
    `${SHEET_NAMES.Leads}!A2:A100000`,
  );
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i]?.[0] ?? "").trim() === leadId) return i + 2;
  }
  return null;
}

export async function getLeadById(leadId: string): Promise<LeadRow | null> {
  const leads = await getLeadsFresh();
  return leads.find((l) => l.lead_id === leadId) ?? null;
}

export async function appendLeadRow(row: LeadRow): Promise<void> {
  await appendRow(
    SHEET_NAMES.Leads,
    objectToRow(LEADS_HEADERS, row as unknown as Record<string, string>),
  );
}

export async function updateLeadRow(leadId: string, row: LeadRow): Promise<void> {
  const n = await findLeadRowNumber(leadId);
  if (!n) throw new Error("Lead not found");
  await updateWideRow(
    SHEET_NAMES.Leads,
    n,
    LEADS_HEADERS.length,
    objectToRow(LEADS_HEADERS, row as unknown as Record<string, string>),
  );
}

async function loadUsersRaw(): Promise<UserRow[]> {
  const rows = await readSheetRange(
    `${SHEET_NAMES.Users}!A2:${colEnd(USERS_HEADERS.length)}`,
  );
  return rows
    .filter((r) => (r[0] ?? "").trim() !== "")
    .map((r) => rowToObject<UserRow>(USERS_HEADERS, padRow(r, USERS_HEADERS.length)));
}

export async function getUsersFresh(): Promise<UserRow[]> {
  return loadUsersRaw();
}

export async function findUserByTokenHash(
  tokenHash: string,
): Promise<UserRow | null> {
  const want = tokenHash.trim().toLowerCase();
  const users = await loadUsersRaw();
  return (
    users.find(
      (u) =>
        (u.token_hash ?? "").trim().toLowerCase() === want &&
        parseSheetBool(u.is_active),
    ) ?? null
  );
}

export async function findUserById(userId: string): Promise<UserRow | null> {
  const users = await loadUsersRaw();
  return users.find((u) => u.user_id === userId) ?? null;
}

export async function appendUserRow(row: UserRow): Promise<void> {
  await appendRow(
    SHEET_NAMES.Users,
    objectToRow(USERS_HEADERS, row as unknown as Record<string, string>),
  );
}

export async function updateUserRow(userId: string, row: UserRow): Promise<void> {
  const rows = await readSheetRange(`${SHEET_NAMES.Users}!A2:A50000`);
  let n: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i]?.[0] ?? "").trim() === userId) {
      n = i + 2;
      break;
    }
  }
  if (!n) throw new Error("User not found");
  await updateWideRow(
    SHEET_NAMES.Users,
    n,
    USERS_HEADERS.length,
    objectToRow(USERS_HEADERS, row as unknown as Record<string, string>),
  );
}

export const getCachedPartners = unstable_cache(
  async () => {
    const rows = await readSheetRange(
      `${SHEET_NAMES.Partners}!A2:${colEnd(HEADERS.Partners.length)}`,
    );
    return rows
      .filter((r) => (r[0] ?? "").trim() !== "")
      .map((r) =>
        rowToObject<PartnerRow>(
          HEADERS.Partners,
          padRow(r, HEADERS.Partners.length),
        ),
      );
  },
  ["partners"],
  { revalidate: 120, tags: ["partners"] },
);

export const getCachedCountries = unstable_cache(
  async () => {
    const rows = await readSheetRange(
      `${SHEET_NAMES.Countries}!A2:${colEnd(HEADERS.Countries.length)}`,
    );
    return rows
      .filter((r) => (r[0] ?? "").trim() !== "")
      .map((r) =>
        rowToObject<CountryRow>(
          HEADERS.Countries,
          padRow(r, HEADERS.Countries.length),
        ),
      );
  },
  ["countries"],
  { revalidate: 120, tags: ["countries"] },
);

export const getCachedSourceManagers = unstable_cache(
  async () => {
    const rows = await readSheetRange(
      `${SHEET_NAMES.Source_Managers}!A2:${colEnd(HEADERS.Source_Managers.length)}`,
    );
    return rows
      .filter((r) => (r[0] ?? "").trim() !== "")
      .map((r) =>
        rowToObject<SourceManagerRow>(
          HEADERS.Source_Managers,
          padRow(r, HEADERS.Source_Managers.length),
        ),
      );
  },
  ["source-managers"],
  { revalidate: 120, tags: ["source_managers"] },
);

export const getCachedPartnerManagers = unstable_cache(
  async () => {
    const rows = await readSheetRange(
      `${SHEET_NAMES.Partner_Managers}!A2:${colEnd(HEADERS.Partner_Managers.length)}`,
    );
    return rows
      .filter((r) => (r[0] ?? "").trim() !== "")
      .map((r) =>
        rowToObject<PartnerManagerRow>(
          HEADERS.Partner_Managers,
          padRow(r, HEADERS.Partner_Managers.length),
        ),
      );
  },
  ["partner-managers"],
  { revalidate: 120, tags: ["partner_managers"] },
);

export const getCachedStatuses = unstable_cache(
  async () => {
    const rows = await readSheetRange(
      `${SHEET_NAMES.Statuses}!A2:${colEnd(HEADERS.Statuses.length)}`,
    );
    return rows
      .filter((r) => (r[1] ?? "").trim() !== "")
      .map((r) =>
        rowToObject<StatusRow>(
          HEADERS.Statuses,
          padRow(r, HEADERS.Statuses.length),
        ),
      );
  },
  ["statuses"],
  { revalidate: 300, tags: ["statuses"] },
);

export async function appendAuditRow(row: AuditLogRow): Promise<void> {
  await appendRow(
    SHEET_NAMES.Audit_Log,
    objectToRow(HEADERS.Audit_Log, row as unknown as Record<string, string>),
  );
}

export async function appendTelegramLogRow(row: TelegramLogRow): Promise<void> {
  await appendRow(
    SHEET_NAMES.Telegram_Log,
    objectToRow(HEADERS.Telegram_Log, row as unknown as Record<string, string>),
  );
}

export async function loadAuditLogPage(opts: {
  maxRows?: number;
}): Promise<AuditLogRow[]> {
  const max = opts.maxRows ?? 2000;
  const rows = await readSheetRange(
    `${SHEET_NAMES.Audit_Log}!A2:${colEnd(HEADERS.Audit_Log.length)}`,
  );
  const out: AuditLogRow[] = [];
  for (let i = rows.length - 1; i >= 0 && out.length < max; i--) {
    const r = rows[i];
    if (!(r?.[0] ?? "").trim()) continue;
    out.push(
      rowToObject<AuditLogRow>(
        HEADERS.Audit_Log,
        padRow(r, HEADERS.Audit_Log.length),
      ),
    );
  }
  return out;
}

export async function getSystemSettings(): Promise<SystemSettingRow[]> {
  const rows = await readSheetRange(
    `${SHEET_NAMES.System_Settings}!A2:C500`,
  );
  return rows
    .filter((r) => (r[0] ?? "").trim() !== "")
    .map((r) =>
      rowToObject<SystemSettingRow>(
        HEADERS.System_Settings,
        padRow(r, HEADERS.System_Settings.length),
      ),
    );
}

export async function getViewsConfigForUser(
  userId: string,
): Promise<ViewsConfigRow[]> {
  const rows = await readSheetRange(
    `${SHEET_NAMES.Views_Config}!A2:${colEnd(HEADERS.Views_Config.length)}`,
  );
  return rows
    .filter((r) => (r[1] ?? "").trim() === userId)
    .map((r) =>
      rowToObject<ViewsConfigRow>(
        HEADERS.Views_Config,
        padRow(r, HEADERS.Views_Config.length),
      ),
    );
}

export async function upsertViewsConfig(
  userId: string,
  role: string,
  configKey: string,
  configJson: string,
): Promise<void> {
  const headers = HEADERS.Views_Config;
  const rows = await readSheetRange(
    `${SHEET_NAMES.Views_Config}!A2:${colEnd(headers.length)}`,
  );
  let rowNum: number | null = null;
  let existingId = "";
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i];
    if (!line || !(line[0] ?? "").trim()) continue;
    const obj = rowToObject<ViewsConfigRow>(
      headers,
      padRow(line, headers.length),
    );
    if (obj.user_id === userId && obj.config_key === configKey) {
      rowNum = i + 2;
      existingId = obj.config_id;
      break;
    }
  }
  const row: ViewsConfigRow = {
    config_id: existingId || `VC-${randomBytes(4).toString("hex")}`,
    user_id: userId,
    role,
    config_key: configKey,
    config_json: configJson,
    updated_at: nowIso(),
  };
  if (rowNum) {
    await updateWideRow(
      SHEET_NAMES.Views_Config,
      rowNum,
      headers.length,
      objectToRow(headers, row as unknown as Record<string, string>),
    );
  } else {
    await appendRow(
      SHEET_NAMES.Views_Config,
      objectToRow(headers, row as unknown as Record<string, string>),
    );
  }
}

/** Batch read reference data in one round-trip. */
export async function batchLoadReference() {
  const ranges = [
    `${SHEET_NAMES.Partners}!A2:${colEnd(HEADERS.Partners.length)}`,
    `${SHEET_NAMES.Countries}!A2:${colEnd(HEADERS.Countries.length)}`,
    `${SHEET_NAMES.Source_Managers}!A2:${colEnd(HEADERS.Source_Managers.length)}`,
    `${SHEET_NAMES.Statuses}!A2:${colEnd(HEADERS.Statuses.length)}`,
  ];
  const batch = await batchReadRanges(ranges);
  const partners = (batch[0]?.values ?? [])
    .filter((r) => (r[0] ?? "").trim() !== "")
    .map((r) =>
      rowToObject<PartnerRow>(
        HEADERS.Partners,
        padRow(r, HEADERS.Partners.length),
      ),
    );
  const countries = (batch[1]?.values ?? [])
    .filter((r) => (r[0] ?? "").trim() !== "")
    .map((r) =>
      rowToObject<CountryRow>(
        HEADERS.Countries,
        padRow(r, HEADERS.Countries.length),
      ),
    );
  const sourceManagers = (batch[2]?.values ?? [])
    .filter((r) => (r[0] ?? "").trim() !== "")
    .map((r) =>
      rowToObject<SourceManagerRow>(
        HEADERS.Source_Managers,
        padRow(r, HEADERS.Source_Managers.length),
      ),
    );
  const statuses = (batch[3]?.values ?? [])
    .filter((r) => (r[1] ?? "").trim() !== "")
    .map((r) =>
      rowToObject<StatusRow>(
        HEADERS.Statuses,
        padRow(r, HEADERS.Statuses.length),
      ),
    );
  return { partners, countries, sourceManagers, statuses };
}

const COUNTRIES_HEADERS = HEADERS.Countries;
const PARTNERS_HEADERS = HEADERS.Partners;

export async function findCountryRowNumber(
  countryCode: string,
): Promise<number | null> {
  const rows = await readSheetRange(`${SHEET_NAMES.Countries}!A2:A50000`);
  const want = countryCode.trim().toUpperCase();
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i]?.[0] ?? "").trim().toUpperCase() === want) return i + 2;
  }
  return null;
}

export async function appendCountryRow(row: CountryRow): Promise<void> {
  await appendRow(
    SHEET_NAMES.Countries,
    objectToRow(COUNTRIES_HEADERS, row as unknown as Record<string, string>),
  );
}

export async function updateCountryRow(
  countryCode: string,
  row: CountryRow,
): Promise<void> {
  const n = await findCountryRowNumber(countryCode);
  if (!n) throw new Error("Country not found");
  await updateWideRow(
    SHEET_NAMES.Countries,
    n,
    COUNTRIES_HEADERS.length,
    objectToRow(COUNTRIES_HEADERS, row as unknown as Record<string, string>),
  );
}

export async function findPartnerRowNumber(
  partnerId: string,
): Promise<number | null> {
  const rows = await readSheetRange(`${SHEET_NAMES.Partners}!A2:A50000`);
  const want = partnerId.trim();
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i]?.[0] ?? "").trim() === want) return i + 2;
  }
  return null;
}

export async function appendPartnerRow(row: PartnerRow): Promise<void> {
  await appendRow(
    SHEET_NAMES.Partners,
    objectToRow(PARTNERS_HEADERS, row as unknown as Record<string, string>),
  );
}

export async function updatePartnerRow(
  partnerId: string,
  row: PartnerRow,
): Promise<void> {
  const n = await findPartnerRowNumber(partnerId);
  if (!n) throw new Error("Partner not found");
  await updateWideRow(
    SHEET_NAMES.Partners,
    n,
    PARTNERS_HEADERS.length,
    objectToRow(PARTNERS_HEADERS, row as unknown as Record<string, string>),
  );
}

export function newLogId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(3).toString("hex")}`;
}

const STATUSES_HEADERS = HEADERS.Statuses;

export async function findStatusRowNumber(
  category: string,
  statusCode: string,
): Promise<number | null> {
  const rows = await readSheetRange(`${SHEET_NAMES.Statuses}!A2:B20000`);
  const cat = category.trim();
  const code = statusCode.trim();
  for (let i = 0; i < rows.length; i++) {
    if (
      (rows[i]?.[0] ?? "").trim() === cat &&
      (rows[i]?.[1] ?? "").trim() === code
    ) {
      return i + 2;
    }
  }
  return null;
}

export async function appendStatusRow(row: StatusRow): Promise<void> {
  await appendRow(
    SHEET_NAMES.Statuses,
    objectToRow(STATUSES_HEADERS, row as unknown as Record<string, string>),
  );
}

export async function updateStatusRowAt(
  row1Based: number,
  row: StatusRow,
): Promise<void> {
  await updateWideRow(
    SHEET_NAMES.Statuses,
    row1Based,
    STATUSES_HEADERS.length,
    objectToRow(STATUSES_HEADERS, row as unknown as Record<string, string>),
  );
}

export async function deleteStatusRowByKeys(
  category: string,
  statusCode: string,
): Promise<void> {
  const n = await findStatusRowNumber(category, statusCode);
  if (!n) throw new Error("Status not found");
  await deleteGridRow(SHEET_NAMES.Statuses, n);
}
