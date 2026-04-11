import type { LeadRow } from "@/types/models";

/**
 * Google Sheets / Excel-style error strings returned as cell *display* values
 * when a formula fails. The Sheets API often surfaces these as plain strings.
 */
const SHEETS_ERROR_DISPLAY = new Set(
  [
    "#N/A",
    "#REF!",
    "#VALUE!",
    "#DIV/0!",
    "#NUM!",
    "#NAME?",
    "#NULL!",
    "#ERROR!",
    "#CIRCLE!",
    "#CALC!",
    "#FIELD!",
    "#SPILL!",
  ].map((s) => s.toUpperCase()),
);

function normCell(s: string): string {
  return (s ?? "").trim();
}

/** True if the entire cell value is a known spreadsheet error display. */
export function isSpreadsheetErrorDisplay(value: string): boolean {
  const t = normCell(value).toUpperCase();
  if (!t.startsWith("#")) return false;
  return SHEETS_ERROR_DISPLAY.has(t);
}

/** Replace error-only cells with empty string so downstream UI / Telegram do not show #ERROR!. */
export function sanitizeSpreadsheetCell(value: string): string {
  if (isSpreadsheetErrorDisplay(value)) return "";
  return (value ?? "").trim();
}

/** Apply {@link sanitizeSpreadsheetCell} to every string field on a lead row after reading from Sheets. */
export function sanitizeLeadRowFromSheet(row: LeadRow): LeadRow {
  const out = { ...row } as Record<keyof LeadRow, string>;
  for (const k of Object.keys(out) as (keyof LeadRow)[]) {
    out[k] = sanitizeSpreadsheetCell(out[k] ?? "");
  }
  return out as LeadRow;
}
