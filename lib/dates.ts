import { formatISO } from "date-fns";

export function nowIso(): string {
  return formatISO(new Date());
}

/** Sheets API may return boolean, number, or string for the same logical cell. */
export function parseSheetBool(v: string | boolean | number | null | undefined): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v ?? "").toLowerCase().trim();
  return s === "true" || s === "1" || s === "yes";
}
