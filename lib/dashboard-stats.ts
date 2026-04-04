import {
  differenceInCalendarDays,
  differenceInHours,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import type { CreatedAtInterval } from "@/lib/dashboard-date-filter";
import { statusLabelForCode } from "@/lib/status-labels";
import type { LeadRow, StatusRow } from "@/types/models";
import { parseSheetBool } from "@/lib/dates";

export type LeadBucket = {
  total: number;
  open: number;
  stale24: number;
  stale72: number;
  byPartnerStatus: Record<string, number>;
  contractUsd: number;
  commissionUsd: number;
  byPartnerManager: Record<string, number>;
};

export function computeLeadBuckets(leads: LeadRow[]): LeadBucket {
  const out: LeadBucket = {
    total: 0,
    open: 0,
    stale24: 0,
    stale72: 0,
    byPartnerStatus: {},
    contractUsd: 0,
    commissionUsd: 0,
    byPartnerManager: {},
  };
  const now = new Date();
  for (const l of leads) {
    if (parseSheetBool(l.is_archived)) continue;
    out.total++;
    const ps = l.partner_status || "unknown";
    out.byPartnerStatus[ps] = (out.byPartnerStatus[ps] ?? 0) + 1;
    const fo = (l.final_outcome || "").toLowerCase();
    const isClosed =
      fo.includes("won") ||
      fo.includes("lost") ||
      (l.closed_lost_at ?? "").length > 3 ||
      (l.contract_signed_at ?? "").length > 3;
    if (!isClosed) out.open++;
    const lu = safeParse(l.last_update_at || l.updated_at);
    if (lu) {
      const h = differenceInHours(now, lu);
      if (h >= 24 && !isClosed) out.stale24++;
      if (h >= 72 && !isClosed) out.stale72++;
    }
    out.contractUsd += parseFloat(l.contract_amount_usd || "0") || 0;
    out.commissionUsd += parseFloat(l.commission_amount_usd || "0") || 0;
    const pm = l.partner_manager_name || "—";
    out.byPartnerManager[pm] = (out.byPartnerManager[pm] ?? 0) + 1;
  }
  return out;
}

function safeParse(s: string): Date | null {
  try {
    return parseISO(s);
  } catch {
    return null;
  }
}

function activeLeads(leads: LeadRow[]): LeadRow[] {
  return leads.filter((l) => !parseSheetBool(l.is_archived));
}

function countPartnerStatus(leads: LeadRow[], code: string): number {
  const want = code.trim();
  return leads.filter((l) => (l.partner_status ?? "").trim() === want).length;
}

function countTransferStatus(leads: LeadRow[], code: string): number {
  const want = code.trim();
  return leads.filter((l) => (l.transfer_status ?? "").trim() === want).length;
}

const STAGE_CODES = ["p_accepted", "p_work", "p_decision", "p_done"] as const;

/** Bar chart: partner_status counts; `name` — подпись из справочника, `code` — для подсказок. */
export function stageFunnelBars(
  leads: LeadRow[],
  statuses: StatusRow[],
): { name: string; code: string; v: number }[] {
  const rows = activeLeads(leads);
  const set = new Set<string>(STAGE_CODES);
  let other = 0;
  for (const l of rows) {
    const ps = (l.partner_status ?? "").trim();
    if (!set.has(ps)) other++;
  }
  return [
    ...STAGE_CODES.map((code) => ({
      code,
      name: statusLabelForCode(statuses, "partner_status", code),
      v: countPartnerStatus(rows, code),
    })),
    { code: "_other", name: "Прочие", v: other },
  ];
}

export function volumeTotals(leads: LeadRow[]): {
  contractUsd: number;
  commissionUsd: number;
} {
  let contractUsd = 0;
  let commissionUsd = 0;
  for (const l of leads) {
    if (parseSheetBool(l.is_archived)) continue;
    contractUsd += parseFloat(l.contract_amount_usd || "0") || 0;
    commissionUsd += parseFloat(l.commission_amount_usd || "0") || 0;
  }
  return { contractUsd, commissionUsd };
}

/**
 * Ряд «создано лидов» по выбранному периоду: все точки на оси времени внутри интервала,
 * пустые интервалы — с нулём (линия не «скачет» из-за двух точек).
 * Шаг: день (≤31 дн), неделя ISO (до ~200 дн), месяц.
 */
export function buildCreationTrendSeries(
  leads: LeadRow[],
  interval: CreatedAtInterval | null,
): { period: string; count: number }[] {
  const WEEK = { weekStartsOn: 1 as const };

  const parsedDates = leads
    .map((l) => safeParse(l.created_at))
    .filter((d): d is Date => d != null && !Number.isNaN(d.getTime()));

  let rangeStart: Date;
  let rangeEnd: Date;

  if (interval) {
    rangeStart = interval.start;
    rangeEnd = interval.end;
  } else if (parsedDates.length === 0) {
    return [];
  } else {
    const t = parsedDates.map((d) => d.getTime());
    rangeStart = new Date(Math.min(...t));
    rangeEnd = new Date(Math.max(...t));
  }

  const spanDays =
    differenceInCalendarDays(endOfDay(rangeEnd), startOfDay(rangeStart)) + 1;
  const mode: "day" | "week" | "month" =
    spanDays <= 31 ? "day" : spanDays <= 200 ? "week" : "month";

  const countBetween = (a: Date, b: Date) =>
    parsedDates.filter((d) => d >= a && d <= b).length;

  if (mode === "day") {
    const days = eachDayOfInterval({
      start: startOfDay(rangeStart),
      end: startOfDay(rangeEnd),
    });
    return days.map((day) => {
      const s = startOfDay(day);
      const e = endOfDay(day);
      return {
        period: format(day, "d MMM", { locale: ru }),
        count: countBetween(s, e),
      };
    });
  }

  if (mode === "week") {
    const start = startOfWeek(rangeStart, WEEK);
    const end = endOfWeek(rangeEnd, WEEK);
    const weeks = eachWeekOfInterval({ start, end }, WEEK);
    return weeks.map((w) => {
      const s = startOfWeek(w, WEEK);
      const e = endOfWeek(w, WEEK);
      return {
        period: `${getISOWeekYear(s)}-W${String(getISOWeek(s)).padStart(2, "0")}`,
        count: countBetween(s, e),
      };
    });
  }

  const months = eachMonthOfInterval({
    start: startOfMonth(rangeStart),
    end: startOfMonth(rangeEnd),
  });
  return months.map((m) => {
    const s = startOfMonth(m);
    const e = endOfMonth(m);
    return {
      period: format(m, "LLLL yyyy", { locale: ru }),
      count: countBetween(s, e),
    };
  });
}

export type LeadsByCountry = {
  country_code: string;
  country_name: string;
  leads: LeadRow[];
};

export function groupLeadsByCountry(leads: LeadRow[]): LeadsByCountry[] {
  const map = new Map<string, LeadRow[]>();
  for (const l of leads) {
    const cc = (l.country_code ?? "").trim() || "—";
    const g = map.get(cc) ?? [];
    g.push(l);
    map.set(cc, g);
  }
  const out: LeadsByCountry[] = [];
  for (const [country_code, group] of map) {
    const country_name =
      group.find((x) => (x.country_name ?? "").trim())?.country_name?.trim() ||
      country_code;
    out.push({ country_code, country_name, leads: group });
  }
  out.sort((a, b) => a.country_name.localeCompare(b.country_name));
  return out;
}

/** Management dashboard: totals and exact partner_status stage counts (non-archived only). */
export type AdminStageStats = {
  total: number;
  p_accepted: number;
  p_work: number;
  p_decision: number;
  p_done: number;
};

export function computeAdminStageStats(leads: LeadRow[]): AdminStageStats {
  const rows = activeLeads(leads);
  return {
    total: rows.length,
    p_accepted: countPartnerStatus(rows, "p_accepted"),
    p_work: countPartnerStatus(rows, "p_work"),
    p_decision: countPartnerStatus(rows, "p_decision"),
    p_done: countPartnerStatus(rows, "p_done"),
  };
}

export type AdminStageByCountry = {
  country_code: string;
  country_name: string;
  stats: AdminStageStats;
};

export function computeAdminStageByCountry(leads: LeadRow[]): AdminStageByCountry[] {
  const rows = activeLeads(leads);
  const byCc = new Map<string, LeadRow[]>();
  for (const l of rows) {
    const cc = (l.country_code ?? "").trim() || "—";
    const g = byCc.get(cc) ?? [];
    g.push(l);
    byCc.set(cc, g);
  }
  const out: AdminStageByCountry[] = [];
  for (const [country_code, group] of byCc) {
    const country_name =
      group.find((x) => (x.country_name ?? "").trim())?.country_name?.trim() ||
      country_code;
    out.push({
      country_code,
      country_name,
      stats: computeAdminStageStats(group),
    });
  }
  out.sort((a, b) => a.country_name.localeCompare(b.country_name));
  return out;
}

/** Колонки таблицы дашборда: transfer_status, затем partner_status. */
export const DASHBOARD_TABLE_TRANSFER_STATUSES = ["sent", "accepted"] as const;
export const DASHBOARD_TABLE_PARTNER_STATUSES = [
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

export type DashboardTableStatusKey =
  | (typeof DASHBOARD_TABLE_TRANSFER_STATUSES)[number]
  | (typeof DASHBOARD_TABLE_PARTNER_STATUSES)[number];

export const DASHBOARD_TABLE_ALL_STATUS_KEYS: readonly DashboardTableStatusKey[] =
  [...DASHBOARD_TABLE_TRANSFER_STATUSES, ...DASHBOARD_TABLE_PARTNER_STATUSES];

export type PartnerCountryTableRow = {
  partner_id: string;
  partner_name: string;
  counts: Record<DashboardTableStatusKey, number>;
  totalLeads: number;
  /** (p_done + p_invoice) / totalLeads × 100 */
  conversionPct: number | null;
  contractUsd: number;
  commissionUsd: number;
};

export type PartnerCountryTableGroup = {
  country_code: string;
  country_name: string;
  partners: PartnerCountryTableRow[];
};

function emptyStatusCounts(): Record<DashboardTableStatusKey, number> {
  const o = {} as Record<DashboardTableStatusKey, number>;
  for (const k of DASHBOARD_TABLE_ALL_STATUS_KEYS) o[k] = 0;
  return o;
}

function aggregatePartnerCountryRows(leads: LeadRow[]): PartnerCountryTableRow {
  const first = leads[0]!;
  const partner_id = (first.partner_id ?? "").trim() || "—";
  const partner_name = (first.partner_name ?? "").trim() || partner_id;
  const counts = emptyStatusCounts();
  for (const k of DASHBOARD_TABLE_TRANSFER_STATUSES) {
    counts[k] = countTransferStatus(leads, k);
  }
  for (const k of DASHBOARD_TABLE_PARTNER_STATUSES) {
    counts[k] = countPartnerStatus(leads, k);
  }
  const vt = volumeTotals(leads);
  const totalLeads = leads.length;
  const success = counts.p_done + counts.p_invoice;
  const conversionPct =
    totalLeads > 0 ? Math.round((1000 * success) / totalLeads) / 10 : null;
  return {
    partner_id,
    partner_name,
    counts,
    totalLeads,
    conversionPct,
    contractUsd: vt.contractUsd,
    commissionUsd: vt.commissionUsd,
  };
}

/**
 * Таблица «страна → партнёр» с разбивкой по статусам (неархивные лиды, обычно уже отфильтрованные по дате создания).
 */
export function computePartnerCountryStatusTable(
  leads: LeadRow[],
): PartnerCountryTableGroup[] {
  const rows = activeLeads(leads);
  const map = new Map<string, LeadRow[]>();
  for (const l of rows) {
    const cc = (l.country_code ?? "").trim() || "—";
    const pid = (l.partner_id ?? "").trim() || "—";
    const k = `${cc}\t${pid}`;
    const g = map.get(k) ?? [];
    g.push(l);
    map.set(k, g);
  }

  type RowMeta = {
    country_code: string;
    country_name: string;
    row: PartnerCountryTableRow;
  };
  const flat: RowMeta[] = [];
  for (const group of map.values()) {
    const country_code = (group[0]!.country_code ?? "").trim() || "—";
    const country_name =
      (group[0]!.country_name ?? "").trim() || country_code;
    flat.push({
      country_code,
      country_name,
      row: aggregatePartnerCountryRows(group),
    });
  }

  flat.sort((a, b) => {
    const c = a.country_name.localeCompare(b.country_name, "ru");
    if (c !== 0) return c;
    return a.row.partner_name.localeCompare(b.row.partner_name, "ru");
  });

  const groups: PartnerCountryTableGroup[] = [];
  let cur: PartnerCountryTableGroup | null = null;
  for (const item of flat) {
    if (!cur || cur.country_code !== item.country_code) {
      cur = {
        country_code: item.country_code,
        country_name: item.country_name,
        partners: [],
      };
      groups.push(cur);
    }
    cur.partners.push(item.row);
  }
  return groups;
}
