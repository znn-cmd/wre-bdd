/**
 * Creates missing tabs in the master spreadsheet and writes row-1 headers.
 * Loads `.env` then `.env.local` (same as Next.js). Credentials: either
 * GOOGLE_SERVICE_ACCOUNT_JSON (single-line JSON) or GOOGLE_SERVICE_ACCOUNT_JSON_FILE.
 *
 * Usage: npm run init-sheet
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { google } from "googleapis";
import { resolveGoogleServiceAccountJsonString } from "../config/env";
import { HEADERS, SHEET_NAMES } from "../config/spreadsheet";

const dotenvQuiet = { quiet: true as const };
config({ path: resolve(process.cwd(), ".env"), ...dotenvQuiet });
config({ path: resolve(process.cwd(), ".env.local"), override: true, ...dotenvQuiet });

function loadServiceAccountCredentials(): object {
  let raw: string | undefined;
  try {
    raw = resolveGoogleServiceAccountJsonString();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  if (!raw) {
    console.error(
      "Set GOOGLE_SERVICE_ACCOUNT_JSON (single-line) or GOOGLE_SERVICE_ACCOUNT_JSON_FILE (path to the .json key). Multiline JSON in .env files is not supported.",
    );
    process.exit(1);
  }
  try {
    return JSON.parse(raw) as object;
  } catch {
    console.error(
      "Service account JSON is invalid. Save the Google key to a file and set GOOGLE_SERVICE_ACCOUNT_JSON_FILE, or put minified JSON on one line in GOOGLE_SERVICE_ACCOUNT_JSON.",
    );
    process.exit(1);
  }
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) {
    console.error("Set GOOGLE_SHEETS_SPREADSHEET_ID in .env or .env.local");
    process.exit(1);
  }
  const credentials = loadServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Map(
    (meta.data.sheets ?? []).map((s) => [s.properties?.title ?? "", s.properties?.sheetId ?? 0]),
  );

  const addRequests: object[] = [];
  for (const title of Object.values(SHEET_NAMES)) {
    if (!existing.has(title)) {
      addRequests.push({ addSheet: { properties: { title } } });
    }
  }
  if (addRequests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: addRequests },
    });
    console.log("Added sheets:", addRequests.length);
  }

  const meta2 = await sheets.spreadsheets.get({ spreadsheetId });
  const idByTitle = new Map(
    (meta2.data.sheets ?? []).map((s) => [s.properties?.title ?? "", s.properties?.sheetId ?? 0]),
  );

  const data: { range: string; values: string[][] }[] = [];
  const entries: [string, readonly string[]][] = [
    [SHEET_NAMES.Leads, HEADERS.Leads],
    [SHEET_NAMES.Users, HEADERS.Users],
    [SHEET_NAMES.Partners, HEADERS.Partners],
    [SHEET_NAMES.Countries, HEADERS.Countries],
    [SHEET_NAMES.Source_Managers, HEADERS.Source_Managers],
    [SHEET_NAMES.Partner_Managers, HEADERS.Partner_Managers],
    [SHEET_NAMES.Statuses, HEADERS.Statuses],
    [SHEET_NAMES.Audit_Log, HEADERS.Audit_Log],
    [SHEET_NAMES.Telegram_Log, HEADERS.Telegram_Log],
    [SHEET_NAMES.System_Settings, HEADERS.System_Settings],
    [SHEET_NAMES.Views_Config, HEADERS.Views_Config],
    [SHEET_NAMES.Dashboard_Cache, HEADERS.Dashboard_Cache],
  ];
  for (const [title, headers] of entries) {
    data.push({ range: `${title}!A1`, values: [[...headers]] });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });

  console.log("Header rows written for all configured sheets.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
