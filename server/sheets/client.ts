import { google } from "googleapis";
import { getEnv } from "@/config/env";

let sheetsInstance: ReturnType<typeof google.sheets> | null = null;

function getSheetsApi() {
  if (sheetsInstance) return sheetsInstance;
  const env = getEnv();
  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as object;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  sheetsInstance = google.sheets({ version: "v4", auth });
  return sheetsInstance;
}

/** API returns booleans/numbers for typed cells; normalize so row parsing stays consistent. */
function normalizeSheetCell(cell: unknown): string {
  if (cell == null || cell === "") return "";
  if (typeof cell === "boolean") return cell ? "true" : "false";
  return String(cell);
}

function normalizeSheetRows(rows: unknown[][] | null | undefined): string[][] {
  return (rows ?? []).map((row) =>
    (row ?? []).map((cell) => normalizeSheetCell(cell)),
  );
}

export async function readSheetRange(a1Range: string): Promise<string[][]> {
  const env = getEnv();
  const sheets = getSheetsApi();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: a1Range,
    /** Computed + displayed values for formula cells — not the `=...` formula string. */
    valueRenderOption: "FORMATTED_VALUE",
  });
  return normalizeSheetRows(res.data.values as unknown[][]);
}

export async function batchReadRanges(
  ranges: string[],
): Promise<{ range: string; values: string[][] }[]> {
  const env = getEnv();
  const sheets = getSheetsApi();
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    ranges,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const valueRanges = res.data.valueRanges ?? [];
  return valueRanges.map((vr) => ({
    range: vr.range ?? "",
    values: normalizeSheetRows(vr.values as unknown[][]),
  }));
}

export async function appendRow(
  sheetName: string,
  row: string[],
): Promise<void> {
  const env = getEnv();
  const sheets = getSheetsApi();
  await sheets.spreadsheets.values.append({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

/** For sheets with many columns (Leads etc.). */
export async function updateWideRow(
  sheetName: string,
  row1Based: number,
  numCols: number,
  row: string[],
): Promise<void> {
  const env = getEnv();
  const sheets = getSheetsApi();
  const end = colIndexToA1(numCols - 1);
  const range = `${sheetName}!A${row1Based}:${end}${row1Based}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

/** Deletes one grid row by sheet title (row 1 = headers; data starts at 2). */
export async function deleteGridRow(
  sheetTitle: string,
  row1Based: number,
): Promise<void> {
  const env = getEnv();
  const sheets = getSheetsApi();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    fields: "sheets.properties",
  });
  const sheet = meta.data.sheets?.find(
    (s) => (s.properties?.title ?? "") === sheetTitle,
  );
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId == null) throw new Error(`Sheet not found: ${sheetTitle}`);
  const start = row1Based - 1;
  if (start < 1) throw new Error("Cannot delete header row");
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: start,
              endIndex: start + 1,
            },
          },
        },
      ],
    },
  });
}

/** Zero-based column index to A1 letters (0 → A, 25 → Z, 26 → AA). */
function colIndexToA1(zeroBased: number): string {
  let c = zeroBased + 1;
  let s = "";
  while (c > 0) {
    const m = (c - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    c = Math.floor((c - 1) / 26);
  }
  return s;
}
