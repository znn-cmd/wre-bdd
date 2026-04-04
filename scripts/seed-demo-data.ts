/**
 * Appends demo partners (4–5 per country) and leads (10–15 per partner) to the spreadsheet.
 * Countries must already exist on the Countries sheet (codes as in your catalog).
 * Transfer / partner status codes must match the Statuses sheet (e.g. sent, accepted, p_work…).
 *
 * Requires: GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_FILE
 * (same as `npm run init-sheet`).
 *
 * Usage: npm run seed-demo
 */
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { config } from "dotenv";
import { formatISO } from "date-fns";
import { google } from "googleapis";
import { resolveGoogleServiceAccountJsonString } from "../config/env";
import { HEADERS, SHEET_NAMES, objectToRow, rowToObject } from "../config/spreadsheet";
import { enrichLeadRow } from "../server/leads/enrich";
import { columnEndLetterFromCount } from "../lib/sheet-range";
import type { CountryRow, LeadRow, PartnerRow, SourceManagerRow, UserRow } from "../types/models";

const dotenvQuiet = { quiet: true as const };
config({ path: resolve(process.cwd(), ".env"), ...dotenvQuiet });
config({ path: resolve(process.cwd(), ".env.local"), override: true, ...dotenvQuiet });

/** Must match your Countries sheet CODE column (see catalog screenshot). */
const DEMO_COUNTRY_CODES = ["Thailand", "UAE", "DUBAI", "TR", "BALI"] as const;

const TRANSFER_CODES = ["sent", "accepted"] as const;
const PARTNER_STATUS_CODES = [
  "p_accepted",
  "p_contacted",
  "p_work",
  "p_wait",
  "p_decision",
  "p_done",
  "p_invoice",
  "p_noanswer",
  "p_refuse",
  "p_disappeared",
] as const;

const FIRST_NAMES = [
  "Алексей",
  "Мария",
  "Дмитрий",
  "Елена",
  "Иван",
  "Ольга",
  "Сергей",
  "Анна",
  "Павел",
  "Наталья",
  "Виктор",
  "Татьяна",
  "Demo",
  "John",
  "Sarah",
];
const LAST_NAMES = [
  "Иванов",
  "Петрова",
  "Сидоров",
  "Козлова",
  "Smith",
  "Brown",
  "Lee",
  "Kim",
  "Tan",
  "Kaya",
];

function loadCredentials(): object {
  const raw = resolveGoogleServiceAccountJsonString();
  if (!raw) {
    console.error(
      "Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_FILE (see init-sheet).",
    );
    process.exit(1);
  }
  return JSON.parse(raw) as object;
}

function padRow(row: string[], len: number): string[] {
  const out = [...row];
  while (out.length < len) out.push("");
  return out.slice(0, len);
}

function normCell(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) {
    console.error("Set GOOGLE_SHEETS_SPREADSHEET_ID");
    process.exit(1);
  }

  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const col = columnEndLetterFromCount;

  async function readTab(
    name: string,
    headersLen: number,
  ): Promise<string[][]> {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${name}!A2:${col(headersLen)}50000`,
    });
    const rows = (res.data.values ?? []) as unknown[][];
    return rows.map((r) => (r ?? []).map(normCell));
  }

  const [countryRows, partnerRows, smRows, userRows] = await Promise.all([
    readTab(SHEET_NAMES.Countries, HEADERS.Countries.length),
    readTab(SHEET_NAMES.Partners, HEADERS.Partners.length),
    readTab(SHEET_NAMES.Source_Managers, HEADERS.Source_Managers.length),
    readTab(SHEET_NAMES.Users, HEADERS.Users.length),
  ]);

  const countries: CountryRow[] = countryRows
    .filter((r) => (r[0] ?? "").trim())
    .map((r) =>
      rowToObject<CountryRow>(HEADERS.Countries, padRow(r, HEADERS.Countries.length)),
    );

  const existingPartners: PartnerRow[] = partnerRows
    .filter((r) => (r[0] ?? "").trim())
    .map((r) =>
      rowToObject<PartnerRow>(HEADERS.Partners, padRow(r, HEADERS.Partners.length)),
    );

  const sourceManagers: SourceManagerRow[] = smRows
    .filter((r) => (r[0] ?? "").trim())
    .map((r) =>
      rowToObject<SourceManagerRow>(
        HEADERS.Source_Managers,
        padRow(r, HEADERS.Source_Managers.length),
      ),
    );

  const users: UserRow[] = userRows
    .filter((r) => (r[0] ?? "").trim())
    .map((r) =>
      rowToObject<UserRow>(HEADERS.Users, padRow(r, HEADERS.Users.length)),
    );

  const countrySet = new Set(countries.map((c) => c.country_code.trim()));
  for (const cc of DEMO_COUNTRY_CODES) {
    if (!countrySet.has(cc)) {
      console.error(
        `Country code "${cc}" not found on Countries sheet. Add it in Catalog first.`,
      );
      process.exit(1);
    }
  }

  const seedUserId = (users[0]?.user_id ?? "").trim() || "U-DEMO-SEED";
  const smActive = sourceManagers.find(
    (s) => (s.active_flag ?? "").toLowerCase() === "true",
  );
  const defaultSmId = (smActive?.source_manager_id ?? "").trim();

  const runTag = `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
  const ts = formatISO(new Date());

  const newPartners: PartnerRow[] = [];
  for (let ci = 0; ci < DEMO_COUNTRY_CODES.length; ci++) {
    const countryCode = DEMO_COUNTRY_CODES[ci]!;
    const nPartners = 4 + (ci % 2);
    const country = countries.find((c) => c.country_code === countryCode);
    const defaultCurrency = (country?.local_currency ?? "").trim();

    for (let pi = 0; pi < nPartners; pi++) {
      const partner_id = `P-DEMO-${runTag}-${countryCode}-${pi + 1}`;
      const partner_name = `Demo ${countryCode} Partner ${pi + 1}`;
      newPartners.push({
        partner_id,
        partner_name,
        country_code: countryCode,
        country_codes: "",
        source_manager_ids: "",
        active_flag: "true",
        owner_name: "",
        telegram_bot_token: "",
        telegram_chat_id: "",
        notification_enabled: "false",
        default_currency: defaultCurrency,
        notes: `demo seed ${ts}`,
      });
    }
  }

  const ctx = {
    countries,
    partners: [...existingPartners, ...newPartners],
    sourceManagers,
  };

  const newLeads: LeadRow[] = [];
  let leadSeq = 0;
  for (const partner of newPartners) {
    const nLeads = randomInt(10, 15);
    for (let li = 0; li < nLeads; li++) {
      leadSeq += 1;
      const lead_id = `LD-DEMO-${runTag}-${leadSeq}`;
      const fn = pick(FIRST_NAMES);
      const ln = pick(LAST_NAMES);
      const transfer_status = pick(TRANSFER_CODES);
      const partner_status =
        PARTNER_STATUS_CODES[li % PARTNER_STATUS_CODES.length]!;

      const partial: Partial<LeadRow> & Pick<LeadRow, "lead_id"> = {
        lead_id,
        crm_deal_id: `CRM-DEMO-${leadSeq}`,
        country_code: partner.country_code,
        partner_id: partner.partner_id,
        client_name: `${fn} ${ln} (${countryCodeShort(partner.country_code)}-${leadSeq})`,
        client_phone: `+${randomInt(1000000000, 9999999999)}`,
        client_email: `demo.lead.${leadSeq}@example.invalid`,
        client_language: pick(["ru", "en", ""]),
        service_type: pick(["Purchase", "Investment", "Rent", "Consultation"]),
        source_channel: pick(["web", "referral", "ads", "partner"]),
        transfer_status,
        partner_status,
        final_outcome: "",
        lead_priority: pick(["", "high", "normal"]),
        contract_amount_local: String(randomInt(50, 500) * 1000),
        commission_percent: String(pick([3, 5, 7, 10])),
        manager_comment: "",
        partner_comment: "",
        tags: "demo",
        created_at: ts,
        updated_at: ts,
        created_by_user_id: seedUserId,
        updated_by_user_id: seedUserId,
        created_by_role: "admin",
        source_manager_id: defaultSmId,
        is_archived: "false",
        last_update_at: ts,
      };

      newLeads.push(enrichLeadRow(partial, ctx));
    }
  }

  const partnerValues = newPartners.map((p) =>
    objectToRow(HEADERS.Partners, p as unknown as Record<string, string>),
  );
  const leadValues = newLeads.map((row) =>
    objectToRow(HEADERS.Leads, row as unknown as Record<string, string>),
  );

  if (partnerValues.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAMES.Partners}!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: partnerValues },
    });
  }

  if (leadValues.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAMES.Leads}!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: leadValues },
    });
  }

  console.log(
    `Done. Run id: ${runTag}\nPartners added: ${newPartners.length}\nLeads added: ${newLeads.length}`,
  );
}

function countryCodeShort(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "XX";
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
