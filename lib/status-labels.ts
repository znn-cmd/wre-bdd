import type { StatusRow } from "@/types/models";

export type StatusCategory =
  | "transfer_status"
  | "partner_status"
  | "final_outcome";

/** Подпись из листа Statuses; если нет — возвращается код. */
export function statusLabelForCode(
  statuses: StatusRow[],
  category: StatusCategory,
  code: string,
): string {
  const c = (code ?? "").trim();
  if (!c) return "—";
  const row = statuses.find(
    (s) =>
      s.category === category && (s.status_code ?? "").trim() === c,
  );
  const label = (row?.status_label ?? "").trim();
  return label || c;
}

/** Заголовок колонки таблицы дашборда (sent/accepted → transfer, остальное → partner). */
export function dashboardTableColumnLabel(
  statuses: StatusRow[],
  columnKey: string,
): string {
  const k = (columnKey ?? "").trim();
  if (k === "sent" || k === "accepted") {
    return statusLabelForCode(statuses, "transfer_status", k);
  }
  return statusLabelForCode(statuses, "partner_status", k);
}
