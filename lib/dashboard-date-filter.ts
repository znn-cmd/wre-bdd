import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  isValid,
  isWithinInterval,
  parse,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
} from "date-fns";
import type { LeadRow } from "@/types/models";

/** Monday-based weeks (EU). */
const WEEK_OPTS = { weekStartsOn: 1 as const };

export type DashboardDatePreset =
  | "all"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export type CreatedAtInterval = { start: Date; end: Date };

export function parseLeadCreatedAt(raw: string): Date | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  try {
    const d = parseISO(s);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

/**
 * `null` = no filter (all leads). Presets always return a range; `custom` with invalid/empty dates returns `null`.
 */
export function resolveCreatedAtInterval(
  preset: DashboardDatePreset,
  customFromYmd: string,
  customToYmd: string,
  now = new Date(),
): CreatedAtInterval | null {
  if (preset === "all") return null;

  switch (preset) {
    case "this_week":
      return {
        start: startOfDay(startOfWeek(now, WEEK_OPTS)),
        end: endOfDay(now),
      };
    case "last_week": {
      const ref = subWeeks(now, 1);
      return {
        start: startOfDay(startOfWeek(ref, WEEK_OPTS)),
        end: endOfDay(endOfWeek(ref, WEEK_OPTS)),
      };
    }
    case "this_month":
      return {
        start: startOfDay(startOfMonth(now)),
        end: endOfDay(now),
      };
    case "last_month": {
      const ref = subMonths(now, 1);
      return {
        start: startOfDay(startOfMonth(ref)),
        end: endOfDay(endOfMonth(ref)),
      };
    }
    case "this_year":
      return {
        start: startOfDay(startOfYear(now)),
        end: endOfDay(now),
      };
    case "custom": {
      const aRaw = (customFromYmd ?? "").trim();
      const bRaw = (customToYmd ?? "").trim();
      if (!aRaw || !bRaw) return null;
      const x = startOfDay(parse(aRaw, "yyyy-MM-dd", now));
      const y = startOfDay(parse(bRaw, "yyyy-MM-dd", now));
      if (!isValid(x) || !isValid(y)) return null;
      const start = x <= y ? x : y;
      const endDay = x <= y ? y : x;
      return { start, end: endOfDay(endDay) };
    }
    default:
      return null;
  }
}

export function filterLeadsByCreatedAtInterval(
  leads: LeadRow[],
  interval: CreatedAtInterval | null,
): LeadRow[] {
  if (!interval) return leads;
  return leads.filter((l) => {
    const d = parseLeadCreatedAt(l.created_at);
    if (!d) return false;
    return isWithinInterval(d, { start: interval.start, end: interval.end });
  });
}
