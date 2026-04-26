import { parseISO, subDays } from "date-fns";
import { parseSheetBool } from "@/lib/dates";
import {
  DASHBOARD_TABLE_ALL_STATUS_KEYS,
  type DashboardTableStatusKey,
} from "@/lib/dashboard-stats";
import { dashboardTableColumnLabel } from "@/lib/status-labels";
import type { AuditLogRow, LeadRow, StatusRow } from "@/types/models";

export type WeeklyReportWindow = {
  periodEnd: Date;
  periodStart: Date;
};

/** Metrics for a scope: all active (non-archived) leads in that scope. */
export type WeeklyScopeMetrics = {
  activeTotal: number;
  /** Лиды в scope, у которых в окне была смена transfer_status на «передано» (коды как у партнёрского Telegram). */
  transferredUnique: number;
  /** Лиды в scope с хотя бы одной сменой partner_status в Audit за окно. */
  partnerStatusChangedUnique: number;
  /** Активные лиды в scope без ни одной смены partner_status в Audit за окно. */
  partnerStatusUnchanged: number;
  currentByStatus: Record<DashboardTableStatusKey, number>;
};

export type WeeklyPartnerBreakdown = {
  partner_id: string;
  partner_name: string;
  metrics: WeeklyScopeMetrics;
};

export type WeeklyCountryBreakdown = {
  country_code: string;
  country_name: string;
  metrics: WeeklyScopeMetrics;
  partners: WeeklyPartnerBreakdown[];
};

export type WeeklyReportStats = {
  window: WeeklyReportWindow;
  global: WeeklyScopeMetrics;
  countries: WeeklyCountryBreakdown[];
};

const TG_SAFE_MAX = 3900;

function parseAuditTimestamp(raw: string): Date | null {
  try {
    const d = parseISO((raw ?? "").trim());
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function activeNonArchived(leads: LeadRow[]): LeadRow[] {
  return leads.filter((l) => !parseSheetBool(l.is_archived));
}

function countByDashboardKey(
  leads: LeadRow[],
  key: DashboardTableStatusKey,
): number {
  const rows = activeNonArchived(leads);
  if (key === "sent" || key === "accepted") {
    const want = key;
    return rows.filter((l) => (l.transfer_status ?? "").trim() === want).length;
  }
  return rows.filter((l) => (l.partner_status ?? "").trim() === key).length;
}

function buildCurrentByStatus(leads: LeadRow[]): Record<
  DashboardTableStatusKey,
  number
> {
  const o = {} as Record<DashboardTableStatusKey, number>;
  for (const k of DASHBOARD_TABLE_ALL_STATUS_KEYS) {
    o[k] = countByDashboardKey(leads, k);
  }
  return o;
}

function scopeMetricsForLeads(
  scopeLeads: LeadRow[],
  transferredIds: Set<string>,
  partnerStatusTouchedIds: Set<string>,
): WeeklyScopeMetrics {
  const active = activeNonArchived(scopeLeads);
  let transferred = 0;
  let changed = 0;
  let unchanged = 0;
  for (const l of active) {
    const id = (l.lead_id ?? "").trim();
    if (!id) continue;
    if (transferredIds.has(id)) transferred++;
    if (partnerStatusTouchedIds.has(id)) changed++;
    else unchanged++;
  }
  return {
    activeTotal: active.length,
    transferredUnique: transferred,
    partnerStatusChangedUnique: changed,
    partnerStatusUnchanged: unchanged,
    currentByStatus: buildCurrentByStatus(scopeLeads),
  };
}

/**
 * Собирает множества lead_id из Audit за окно (только update):
 * — передано: transfer_status → new_value в transferTriggerCodes;
 * — меняли partner_status: любое изменение поля partner_status.
 */
export function collectAuditLeadSets(
  audit: AuditLogRow[],
  window: WeeklyReportWindow,
  transferTriggerCodes: Set<string>,
): {
  transferredIds: Set<string>;
  partnerStatusTouchedIds: Set<string>;
} {
  const { periodStart, periodEnd } = window;
  const transferredIds = new Set<string>();
  const partnerStatusTouchedIds = new Set<string>();

  for (const row of audit) {
    const t = parseAuditTimestamp(row.timestamp);
    if (!t || t < periodStart || t > periodEnd) continue;
    if (row.action_type !== "update") continue;
    const lid = (row.lead_id ?? "").trim();
    if (!lid) continue;

    if (row.field_name === "transfer_status") {
      const nv = (row.new_value ?? "").trim();
      if (transferTriggerCodes.has(nv)) transferredIds.add(lid);
    }
    if (row.field_name === "partner_status") {
      partnerStatusTouchedIds.add(lid);
    }
  }

  return { transferredIds, partnerStatusTouchedIds };
}

export function buildWeeklyReportWindow(
  periodEnd: Date,
  periodDays: number,
): WeeklyReportWindow {
  return {
    periodEnd,
    periodStart: subDays(periodEnd, periodDays),
  };
}

export function computeWeeklyReportStats(
  leads: LeadRow[],
  audit: AuditLogRow[],
  opts: {
    window: WeeklyReportWindow;
    transferTriggerCodes: Set<string>;
  },
): WeeklyReportStats {
  const { transferredIds, partnerStatusTouchedIds } = collectAuditLeadSets(
    audit,
    opts.window,
    opts.transferTriggerCodes,
  );

  const active = activeNonArchived(leads);
  const global = scopeMetricsForLeads(
    leads,
    transferredIds,
    partnerStatusTouchedIds,
  );

  const countryMap = new Map<string, LeadRow[]>();
  for (const l of active) {
    const cc = (l.country_code ?? "").trim() || "—";
    const g = countryMap.get(cc) ?? [];
    g.push(l);
    countryMap.set(cc, g);
  }

  type CountryMeta = {
    country_code: string;
    country_name: string;
    metrics: WeeklyScopeMetrics;
    partners: WeeklyPartnerBreakdown[];
  };

  const countryList: CountryMeta[] = [];

  for (const [, group] of countryMap) {
    const country_code = (group[0]!.country_code ?? "").trim() || "—";
    const country_name =
      (group[0]!.country_name ?? "").trim() || country_code;

    const partnerMap = new Map<string, LeadRow[]>();
    for (const l of group) {
      const pid = (l.partner_id ?? "").trim() || "—";
      const g = partnerMap.get(pid) ?? [];
      g.push(l);
      partnerMap.set(pid, g);
    }

    const partners: WeeklyPartnerBreakdown[] = [];
    for (const [, pLeads] of partnerMap) {
      const partner_id = (pLeads[0]!.partner_id ?? "").trim() || "—";
      const partner_name =
        (pLeads[0]!.partner_name ?? "").trim() || partner_id;
      partners.push({
        partner_id,
        partner_name,
        metrics: scopeMetricsForLeads(
          pLeads,
          transferredIds,
          partnerStatusTouchedIds,
        ),
      });
    }
    partners.sort((a, b) =>
      a.partner_name.localeCompare(b.partner_name, "en"),
    );

    countryList.push({
      country_code,
      country_name,
      metrics: scopeMetricsForLeads(
        group,
        transferredIds,
        partnerStatusTouchedIds,
      ),
      partners,
    });
  }

  countryList.sort((a, b) =>
    a.country_name.localeCompare(b.country_name, "en"),
  );

  return {
    window: opts.window,
    global,
    countries: countryList,
  };
}

/** MSK wall-clock parts for labels and idempotency (Europe/Moscow, no DST). */
export function formatSlotKeyMsk(d: Date): string {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    f.formatToParts(d).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}`;
}

/** Флаг по ISO 3166-1 alpha-2; иначе нейтральный глобус. */
export function flagEmojiFromCountryCode(countryCode: string): string {
  const cc = (countryCode ?? "").trim().toUpperCase();
  if (cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return "🌍";
  const BASE = 0x1f1e6;
  const chars = [...cc].map((ch) => BASE + (ch.charCodeAt(0) - 65));
  return String.fromCodePoint(...chars);
}

function formatStatusBulletLines(
  m: WeeklyScopeMetrics,
  statuses: StatusRow[],
  bullet: string,
): string[] {
  const lines: string[] = [];
  for (const k of DASHBOARD_TABLE_ALL_STATUS_KEYS) {
    const n = m.currentByStatus[k];
    if (n > 0) {
      const label = dashboardTableColumnLabel(statuses, k);
      lines.push(`${bullet}${label} — ${n}`);
    }
  }
  return lines.length
    ? lines
    : [`${bullet}нет лидов в учётных статусах`];
}

/** Блок метрик за окно + список текущих статусов (без «простынь» в одну строку). */
function formatScopeUxBlock(
  m: WeeklyScopeMetrics,
  statuses: StatusRow[],
  opts: { indent: string; statusBullet: string },
): string[] {
  const { indent, statusBullet } = opts;
  const lines: string[] = [
    `${indent}• Активных лидов: ${m.activeTotal}`,
    `${indent}• Передано партнёру (за окно, по журналу): ${m.transferredUnique}`,
    `${indent}• Меняли стадию у партнёра: ${m.partnerStatusChangedUnique}`,
    `${indent}• Стадия у партнёра без изменений: ${m.partnerStatusUnchanged}`,
    "",
    `${indent}Сейчас в статусах:`,
    ...formatStatusBulletLines(m, statuses, `${indent}${statusBullet} `),
  ];
  return lines;
}

function formatWindowLinesMsk(window: WeeklyReportWindow): {
  startStr: string;
  endStr: string;
} {
  const fmt = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return {
    startStr: fmt.format(window.periodStart),
    endStr: fmt.format(window.periodEnd),
  };
}

/** Первое сообщение: заголовок, окно, только общие цифры. */
function formatWeeklyReportIntroMessage(
  stats: WeeklyReportStats,
  statuses: StatusRow[],
): string {
  const { startStr, endStr } = formatWindowLinesMsk(stats.window);
  const lines: string[] = [
    "📊 Лиды — сводка за 7 дней",
    "",
    `🕐 Окно (МСК): ${startStr} — ${endStr}`,
    "",
    "🌐 Общие цифры",
    "",
    ...formatScopeUxBlock(stats.global, statuses, {
      indent: "",
      statusBullet: "·",
    }),
    "",
    ...(stats.countries.length === 0
      ? ["ℹ️ Нет разбивки по странам (нет активных лидов)."]
      : ["⬇️ Дальше — каждая страна отдельным сообщением."]),
  ];
  return lines.join("\n").trim();
}

/** Одно сообщение Telegram: одна страна и её партнёры. */
function formatWeeklyCountryTelegramMessage(
  c: WeeklyCountryBreakdown,
  statuses: StatusRow[],
  index1Based: number,
  totalCountries: number,
): string {
  const flag = flagEmojiFromCountryCode(c.country_code);
  const cc = (c.country_code ?? "").trim() || "—";
  const lines: string[] = [
    `🗺 Страна ${index1Based}/${totalCountries}`,
    `${flag} ${c.country_name} · ${cc}`,
    "",
    ...formatScopeUxBlock(c.metrics, statuses, {
      indent: "",
      statusBullet: "·",
    }),
    "",
    "👥 Партнёры",
  ];

  for (const p of c.partners) {
    lines.push("");
    lines.push(`▸ ${p.partner_name}`);
    lines.push(`   └ активных: ${p.metrics.activeTotal}`);
    lines.push(`   └ передано за окно: ${p.metrics.transferredUnique}`);
    lines.push(`   └ меняли стадию: ${p.metrics.partnerStatusChangedUnique}`);
    lines.push(`   └ стадия без изменений: ${p.metrics.partnerStatusUnchanged}`);
    lines.push(`   └ сейчас в статусах:`);
    lines.push(
      ...formatStatusBulletLines(p.metrics, statuses, "      · "),
    );
  }

  return lines.join("\n").trim();
}

/**
 * Сообщения для Telegram: [0] — общий блок, [1…] — по одной стране.
 * Если стран нет, только ввод.
 */
export function buildWeeklyReportTelegramParts(
  stats: WeeklyReportStats,
  statuses: StatusRow[],
): string[] {
  const intro = formatWeeklyReportIntroMessage(stats, statuses);
  const n = stats.countries.length;
  if (n === 0) return [intro];
  const countryParts = stats.countries.map((c, i) =>
    formatWeeklyCountryTelegramMessage(c, statuses, i + 1, n),
  );
  return [intro, ...countryParts];
}

/** Полный текст (например для лога): все части подряд. */
export function formatWeeklyReportMessage(
  stats: WeeklyReportStats,
  statuses: StatusRow[],
): string {
  return buildWeeklyReportTelegramParts(stats, statuses).join("\n\n──────────\n\n");
}

/** Разбивает слишком длинную часть отчёта по лимиту Telegram. */
export function expandWeeklyPartsForTelegramLimit(
  parts: string[],
  maxLen = TG_SAFE_MAX,
): string[] {
  const out: string[] = [];
  for (const part of parts) {
    const subs = splitForTelegram(part, maxLen);
    if (subs.length <= 1) {
      if (subs[0]) out.push(subs[0]);
      continue;
    }
    subs.forEach((s, j) => {
      out.push(
        `${s}\n\n— продолжение ${j + 1}/${subs.length} —`,
      );
    });
  }
  return out;
}

/** Разбивает текст на части ≤ maxLen символов (по границам строк). */
export function splitForTelegram(text: string, maxLen = TG_SAFE_MAX): string[] {
  const s = text.trim();
  if (s.length <= maxLen) return s ? [s] : [];

  const parts: string[] = [];
  let rest = s;
  while (rest.length > 0) {
    if (rest.length <= maxLen) {
      parts.push(rest.trim());
      break;
    }
    let cut = rest.lastIndexOf("\n\n", maxLen);
    if (cut < maxLen / 2) cut = rest.lastIndexOf("\n", maxLen);
    if (cut < maxLen / 2) cut = maxLen;
    const chunk = rest.slice(0, cut).trim();
    if (chunk) parts.push(chunk);
    rest = rest.slice(cut).trimStart();
  }
  return parts.filter(Boolean);
}
