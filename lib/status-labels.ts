import type { StatusRow } from "@/types/models";

export type StatusCategory =
  | "transfer_status"
  | "partner_status"
  | "final_outcome";

/** Statuses catalog row for a code (any category). */
export function statusRowForCode(
  statuses: StatusRow[],
  category: StatusCategory,
  code: string,
): StatusRow | undefined {
  const c = (code ?? "").trim();
  if (!c) return undefined;
  return statuses.find(
    (s) =>
      s.category === category && (s.status_code ?? "").trim() === c,
  );
}

/**
 * Tailwind classes for status label text when catalog `color` is set.
 * Empty / unknown → undefined (use default styling).
 */
export function statusColorTextClass(color: string): string | undefined {
  const c = (color ?? "").trim().toLowerCase();
  if (!c) return undefined;
  if (c === "yellow") return "font-bold text-yellow-600 dark:text-yellow-400";
  if (c === "green") return "font-bold text-green-600 dark:text-green-400";
  if (c === "red") return "font-bold text-red-600 dark:text-red-400";
  return undefined;
}

/** Label from Statuses sheet; falls back to code if missing. */
export function statusLabelForCode(
  statuses: StatusRow[],
  category: StatusCategory,
  code: string,
): string {
  const c = (code ?? "").trim();
  if (!c) return "—";
  const row = statusRowForCode(statuses, category, c);
  const label = (row?.status_label ?? "").trim();
  return label || c;
}

/** Status category for dashboard table columns. */
export function dashboardTableStatusCategory(
  columnKey: string,
): "transfer_status" | "partner_status" {
  const k = (columnKey ?? "").trim();
  return k === "sent" || k === "accepted" ? "transfer_status" : "partner_status";
}

/** Dashboard table column header (sent/accepted → transfer, else → partner). */
export function dashboardTableColumnLabel(
  statuses: StatusRow[],
  columnKey: string,
): string {
  const k = (columnKey ?? "").trim();
  return statusLabelForCode(statuses, dashboardTableStatusCategory(k), k);
}
