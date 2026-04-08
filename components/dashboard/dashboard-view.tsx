"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, startOfMonth } from "date-fns";
import { enUS } from "date-fns/locale";
import type { LeadRow, SessionUser, StatusRow } from "@/types/models";
import type { PartnerCountryTableRow } from "@/lib/dashboard-stats";
import {
  dashboardTableColumnLabel,
  dashboardTableStatusCategory,
  statusColorTextClass,
  statusLabelForCode,
  statusRowForCode,
} from "@/lib/status-labels";
import { cn } from "@/lib/utils";
import {
  type DashboardDatePreset,
  filterLeadsByCreatedAtInterval,
  resolveCreatedAtInterval,
} from "@/lib/dashboard-date-filter";
import {
  buildCreationTrendSeries,
  computeAdminStageByCountry,
  computeAdminStageStats,
  computeLeadBuckets,
  computePartnerCountryStatusTable,
  DASHBOARD_TABLE_ALL_STATUS_KEYS,
  groupLeadsByCountry,
  stageFunnelBars,
  volumeTotals,
} from "@/lib/dashboard-stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function useManagementDashboard(role: SessionUser["role"]): boolean {
  return (
    role === "admin" ||
    role === "rop" ||
    role === "partner_dept_manager"
  );
}

const PRESET_OPTIONS: { id: DashboardDatePreset; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "this_week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_year", label: "This year" },
  { id: "custom", label: "Custom range" },
];

function formatIntervalHint(
  preset: DashboardDatePreset,
  interval: ReturnType<typeof resolveCreatedAtInterval>,
): string {
  if (preset === "all" || !interval) {
    if (preset === "custom") return "Enter start and end dates";
    return "All leads by created date";
  }
  const opt = { locale: enUS };
  return `${format(interval.start, "d MMM yyyy", opt)} — ${format(interval.end, "d MMM yyyy", opt)}`;
}

export function DashboardView({
  user,
  leads,
  statuses,
}: {
  user: SessionUser;
  leads: LeadRow[];
  statuses: StatusRow[];
}) {
  const managementUi = useManagementDashboard(user.role);
  const [datePreset, setDatePreset] =
    React.useState<DashboardDatePreset>("this_month");
  const [customFrom, setCustomFrom] = React.useState(() =>
    format(startOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [customTo, setCustomTo] = React.useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );

  const setPreset = (id: DashboardDatePreset) => {
    setDatePreset(id);
    if (id === "custom") {
      const now = new Date();
      setCustomFrom(format(startOfMonth(now), "yyyy-MM-dd"));
      setCustomTo(format(now, "yyyy-MM-dd"));
    }
  };

  const createdInterval = React.useMemo(
    () => resolveCreatedAtInterval(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const filteredLeads = React.useMemo(() => {
    if (datePreset === "custom" && createdInterval === null) {
      return [] as LeadRow[];
    }
    return filterLeadsByCreatedAtInterval(leads, createdInterval);
  }, [leads, datePreset, createdInterval]);

  const bucket = React.useMemo(
    () => computeLeadBuckets(filteredLeads),
    [filteredLeads],
  );
  const stageStats = React.useMemo(
    () => computeAdminStageStats(filteredLeads),
    [filteredLeads],
  );
  const stageByCountry = React.useMemo(
    () => computeAdminStageByCountry(filteredLeads),
    [filteredLeads],
  );
  const funnelBars = React.useMemo(
    () => stageFunnelBars(filteredLeads, statuses),
    [filteredLeads, statuses],
  );

  const conversionFormulaText = React.useMemo(() => {
    const d = statusLabelForCode(statuses, "partner_status", "p_done");
    const inv = statusLabelForCode(statuses, "partner_status", "p_invoice");
    return `(${d} + ${inv}) / total leads in row`;
  }, [statuses]);

  const conversionThTitle = React.useMemo(
    () =>
      `${conversionFormulaText}. Computed from data codes: p_done + p_invoice.`,
    [conversionFormulaText],
  );
  const volume = React.useMemo(
    () => volumeTotals(filteredLeads),
    [filteredLeads],
  );
  const trendSeries = React.useMemo(
    () => buildCreationTrendSeries(filteredLeads, createdInterval),
    [filteredLeads, createdInterval],
  );
  const leadsByCountryCharts = React.useMemo(
    () => groupLeadsByCountry(filteredLeads),
    [filteredLeads],
  );
  const partnerCountryTable = React.useMemo(
    () => computePartnerCountryStatusTable(filteredLeads),
    [filteredLeads],
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="text-xs text-neutral-500">
          Scoped to your role{user.role === "partner" ? " and partner" : ""}.
        </p>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-medium">
            Lead created date filter
          </CardTitle>
          <p className="text-[11px] text-neutral-500">
            {formatIntervalHint(datePreset, createdInterval)}
            {datePreset === "all" ? (
              <span className="text-neutral-400"> · {leads.length} leads</span>
            ) : createdInterval !== null ? (
              <span className="text-neutral-400">
                {" "}
                · showing {filteredLeads.length} of {leads.length}
              </span>
            ) : (
              <span className="text-neutral-400">
                {" "}
                · 0 of {leads.length} (set a date range)
              </span>
            )}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pb-4">
          <div className="flex flex-wrap gap-1.5">
            {PRESET_OPTIONS.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={datePreset === p.id ? "default" : "secondary"}
                className="h-8 text-xs"
                onClick={() => setPreset(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          {datePreset === "custom" ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label className="text-[10px] text-neutral-500">From</Label>
                <Input
                  type="date"
                  className="h-8 w-[150px] text-xs"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] text-neutral-500">To</Label>
                <Input
                  type="date"
                  className="h-8 w-[150px] text-xs"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {managementUi ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <StatCard title="Total leads" value={String(stageStats.total)} />
            <StatCard
              title={statusLabelForCode(statuses, "partner_status", "p_accepted")}
              codeHint="p_accepted"
              value={String(stageStats.p_accepted)}
            />
            <StatCard
              title={statusLabelForCode(statuses, "partner_status", "p_work")}
              codeHint="p_work"
              value={String(stageStats.p_work)}
            />
            <StatCard
              title={statusLabelForCode(statuses, "partner_status", "p_decision")}
              codeHint="p_decision"
              value={String(stageStats.p_decision)}
            />
            <StatCard
              title={statusLabelForCode(statuses, "partner_status", "p_done")}
              codeHint="p_done"
              value={String(stageStats.p_done)}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              By country
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {stageByCountry.map((c) => (
                <Card key={c.country_code} className="shadow-none">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-semibold leading-tight">
                      {c.country_name}
                    </CardTitle>
                    <p className="text-[10px] text-neutral-500">{c.country_code}</p>
                  </CardHeader>
                  <CardContent className="overflow-x-auto pb-3 pt-0">
                    <div className="grid min-w-[260px] grid-cols-5 gap-1.5">
                      <StatMini label="Total" value={String(c.stats.total)} />
                      <StatMini
                        label={statusLabelForCode(statuses, "partner_status", "p_accepted")}
                        code="p_accepted"
                        value={String(c.stats.p_accepted)}
                      />
                      <StatMini
                        label={statusLabelForCode(statuses, "partner_status", "p_work")}
                        code="p_work"
                        value={String(c.stats.p_work)}
                      />
                      <StatMini
                        label={statusLabelForCode(statuses, "partner_status", "p_decision")}
                        code="p_decision"
                        value={String(c.stats.p_decision)}
                      />
                      <StatMini
                        label={statusLabelForCode(statuses, "partner_status", "p_done")}
                        code="p_done"
                        value={String(c.stats.p_done)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total leads" value={String(bucket.total)} />
          <StatCard title="Open" value={String(bucket.open)} />
          <StatCard title="Stale 24h+" value={String(bucket.stale24)} />
          <StatCard title="Stale 72h+" value={String(bucket.stale72)} />
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stages (partner_status)</CardTitle>
            <p className="text-[11px] font-normal text-neutral-500">
              Labels from the status catalog; hover the chart or tooltip to see the code.
            </p>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelBars} margin={{ bottom: 8, left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 8 }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={64}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                <Tooltip content={<FunnelBarTooltip />} />
                <Bar dataKey="v" fill="#171717" radius={[4, 4, 0, 0]} className="dark:fill-neutral-200" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volumes (USD)</CardTitle>
            <p className="text-[11px] font-normal text-neutral-500">
              Sum of lead fields for the selected period (non-archived).
            </p>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Row k="Contract USD" v={formatUsd(volume.contractUsd)} />
            <Row k="Commission USD" v={formatUsd(volume.commissionUsd)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads created over time</CardTitle>
          <p className="text-[11px] font-normal text-neutral-500">
            The time axis spans the full filter range; step is day / ISO week / month
            depending on range length.
          </p>
        </CardHeader>
        <CardContent className="h-64">
          {trendSeries.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              No leads with a created date in the selected period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendSeries} margin={{ left: 0, right: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#2563eb"
                  dot={trendSeries.length <= 16}
                  strokeWidth={2}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {leadsByCountryCharts.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            By country — same charts
          </h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {leadsByCountryCharts.map((c) => (
              <CountryChartsBlock
                key={c.country_code}
                countryName={c.country_name}
                countryCode={c.country_code}
                leads={c.leads}
                statuses={statuses}
                createdInterval={createdInterval}
              />
            ))}
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Country → partner: statuses and volumes</CardTitle>
          <p className="text-[11px] font-normal text-neutral-500">
            Non-archived leads in the selected period. Counts by{" "}
            <code className="rounded bg-neutral-100 px-0.5 dark:bg-neutral-800">transfer_status</code>{" "}
            and{" "}
            <code className="rounded bg-neutral-100 px-0.5 dark:bg-neutral-800">partner_status</code>{" "}
            (columns use catalog labels). Conversion:{" "}
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              {conversionFormulaText}
            </span>
            . Within each country, the{" "}
            <span className="text-emerald-700 dark:text-emerald-400">best</span> and{" "}
            <span className="text-red-700 dark:text-red-400">worst</span> partner values for Σ,
            conversion, and USD are highlighted.
          </p>
        </CardHeader>
        <CardContent className="px-2 pb-4 sm:px-4">
          {partnerCountryTable.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              No non-archived leads in the selected period.
            </p>
          ) : (
            <div className="max-h-[min(70vh,720px)] overflow-auto rounded-md border border-neutral-200 dark:border-neutral-800">
              <table className="w-full min-w-[1040px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
                    <th
                      scope="col"
                      className="sticky top-0 z-20 whitespace-nowrap bg-neutral-100 px-2 py-2 font-medium dark:bg-neutral-900"
                    >
                      Country
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 whitespace-nowrap bg-neutral-100 px-2 py-2 font-medium dark:bg-neutral-900"
                    >
                      Partner
                    </th>
                    {DASHBOARD_TABLE_ALL_STATUS_KEYS.map((key) => {
                      const label = dashboardTableColumnLabel(statuses, key);
                      const cat = dashboardTableStatusCategory(key);
                      const headerTone = statusColorTextClass(
                        statusRowForCode(statuses, cat, key)?.color ?? "",
                      );
                      return (
                        <th
                          key={key}
                          scope="col"
                          title={
                            key === "sent" || key === "accepted"
                              ? `transfer_status · code: ${key}`
                              : `partner_status · code: ${key}`
                          }
                          className={cn(
                            "sticky top-0 z-20 max-w-[88px] bg-neutral-100 px-1 py-2 text-center text-[9px] leading-tight dark:bg-neutral-900",
                            headerTone
                              ? headerTone
                              : "font-medium text-neutral-700 dark:text-neutral-300",
                          )}
                        >
                          <span className="line-clamp-3">{label}</span>
                        </th>
                      );
                    })}
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-neutral-100 px-1 py-2 text-center font-medium dark:bg-neutral-900"
                      title="Total leads in row"
                    >
                      Σ
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-neutral-100 px-1 py-2 text-center font-medium dark:bg-neutral-900"
                      title={conversionThTitle}
                    >
                      Conv. %
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-neutral-100 px-2 py-2 text-right font-medium dark:bg-neutral-900"
                    >
                      Contract USD
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-neutral-100 px-2 py-2 text-right font-medium dark:bg-neutral-900"
                    >
                      Commission USD
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {partnerCountryTable.map((g) => (
                    <React.Fragment key={g.country_code}>
                      {g.partners.map((p, idx) => (
                        <tr
                          key={`${g.country_code}-${p.partner_id}`}
                          className="border-b border-neutral-100 odd:bg-white even:bg-neutral-50/80 dark:border-neutral-800 dark:odd:bg-neutral-950 dark:even:bg-neutral-900/40"
                        >
                          {idx === 0 ? (
                            <td
                              rowSpan={g.partners.length}
                              className="align-top border-r border-neutral-200 bg-neutral-100/90 px-2 py-2 font-medium text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-100"
                            >
                              <div>{g.country_name}</div>
                              <div className="text-[9px] font-normal text-neutral-500">
                                {g.country_code}
                              </div>
                            </td>
                          ) : null}
                          <td
                            className="max-w-[160px] px-2 py-1.5 font-medium text-neutral-800 dark:text-neutral-200"
                            title={`${p.partner_name} (${p.partner_id})`}
                          >
                            <div className="truncate">{p.partner_name}</div>
                            <div className="truncate font-mono text-[9px] font-normal text-neutral-500">
                              {p.partner_id}
                            </div>
                          </td>
                          {DASHBOARD_TABLE_ALL_STATUS_KEYS.map((key) => {
                            const v = p.counts[key];
                            return (
                              <td
                                key={key}
                                className={`px-0.5 py-1.5 text-center tabular-nums ${
                                  v === 0
                                    ? "text-neutral-300 dark:text-neutral-600"
                                    : "text-neutral-900 dark:text-neutral-100"
                                }`}
                              >
                                {v}
                              </td>
                            );
                          })}
                          <td
                            className={`px-1 py-1.5 text-center tabular-nums font-semibold ${metricCellClass(
                              partnerMetricRankInCountry(g.partners, p, "totalLeads"),
                            )}`}
                          >
                            {p.totalLeads}
                          </td>
                          <td
                            className={`px-1 py-1.5 text-center tabular-nums font-medium ${metricCellClass(
                              partnerMetricRankInCountry(g.partners, p, "conversionPct"),
                            )}`}
                          >
                            {formatPct(p.conversionPct)}
                          </td>
                          <td
                            className={`px-2 py-1.5 text-right tabular-nums ${metricCellClass(
                              partnerMetricRankInCountry(g.partners, p, "contractUsd"),
                            )}`}
                          >
                            {formatUsd(p.contractUsd)}
                          </td>
                          <td
                            className={`px-2 py-1.5 text-right tabular-nums ${metricCellClass(
                              partnerMetricRankInCountry(g.partners, p, "commissionUsd"),
                            )}`}
                          >
                            {formatUsd(p.commissionUsd)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type PartnerMetricKey =
  | "totalLeads"
  | "conversionPct"
  | "contractUsd"
  | "commissionUsd";

function metricValue(
  row: PartnerCountryTableRow,
  metric: PartnerMetricKey,
): number | null {
  switch (metric) {
    case "totalLeads":
      return row.totalLeads;
    case "conversionPct":
      return row.conversionPct;
    case "contractUsd":
      return row.contractUsd;
    case "commissionUsd":
      return row.commissionUsd;
    default:
      return null;
  }
}

/** Compare partners within one country only; higher is better for all four metrics. */
function partnerMetricRankInCountry(
  partners: PartnerCountryTableRow[],
  row: PartnerCountryTableRow,
  metric: PartnerMetricKey,
): "best" | "worst" | null {
  if (partners.length < 2) return null;
  const vals = partners
    .map((x) => metricValue(x, metric))
    .filter((v): v is number => v !== null && !Number.isNaN(v));
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return null;
  const v = metricValue(row, metric);
  if (v === null || Number.isNaN(v)) return null;
  if (v === max) return "best";
  if (v === min) return "worst";
  return null;
}

function metricCellClass(rank: "best" | "worst" | null): string {
  if (rank === "best") {
    return "bg-emerald-200/90 text-emerald-950 dark:bg-emerald-950/55 dark:text-emerald-50";
  }
  if (rank === "worst") {
    return "bg-red-200/90 text-red-950 dark:bg-red-950/55 dark:text-red-50";
  }
  return "text-neutral-800 dark:text-neutral-200";
}

function formatPct(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(1)}%`;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function FunnelBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    value?: number;
    payload?: { name: string; code: string; v: number };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs shadow-md dark:border-neutral-700 dark:bg-neutral-950">
      <div className="max-w-[220px] font-medium leading-snug">{row.name}</div>
      {row.code && row.code !== "_other" ? (
        <div className="text-[10px] text-neutral-500">Code: {row.code}</div>
      ) : null}
      <div className="mt-0.5 tabular-nums font-semibold">{payload[0]?.value ?? row.v}</div>
    </div>
  );
}

function CountryChartsBlock({
  countryName,
  countryCode,
  leads,
  statuses,
  createdInterval,
}: {
  countryName: string;
  countryCode: string;
  leads: LeadRow[];
  statuses: StatusRow[];
  createdInterval: ReturnType<typeof resolveCreatedAtInterval>;
}) {
  const funnelBars = React.useMemo(
    () => stageFunnelBars(leads, statuses),
    [leads, statuses],
  );
  const vol = React.useMemo(() => volumeTotals(leads), [leads]);
  const trend = React.useMemo(
    () => buildCreationTrendSeries(leads, createdInterval),
    [leads, createdInterval],
  );

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold">{countryName}</CardTitle>
        <p className="text-[10px] text-neutral-500">{countryCode}</p>
      </CardHeader>
      <CardContent className="grid gap-3 pb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] font-medium text-neutral-500">Stages</p>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelBars} margin={{ bottom: 20, left: 0, right: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 7 }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={36}
                  />
                  <YAxis allowDecimals={false} width={28} tick={{ fontSize: 9 }} />
                  <Tooltip content={<FunnelBarTooltip />} />
                  <Bar dataKey="v" fill="#404040" radius={[3, 3, 0, 0]} className="dark:fill-neutral-400" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-md border border-neutral-100 px-3 py-2 text-xs dark:border-neutral-800">
            <Row k="Contract USD" v={formatUsd(vol.contractUsd)} />
            <Row k="Commission USD" v={formatUsd(vol.commissionUsd)} />
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium text-neutral-500">Created over time</p>
          <div className="h-36 w-full">
            {trend.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-neutral-500">No data points</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: 0, right: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                  <XAxis dataKey="period" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} width={28} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#2563eb"
                    strokeWidth={1.5}
                    dot={trend.length <= 12}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  codeHint,
}: {
  title: string;
  value: string;
  subtitle?: string;
  /** Shown in the native tooltip when hovering the card */
  codeHint?: string;
}) {
  return (
    <Card title={codeHint ? `Code: ${codeHint}` : undefined}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-neutral-500">
          {title}
        </CardTitle>
        {subtitle ? (
          <p className="text-[10px] leading-snug text-neutral-400">{subtitle}</p>
        ) : null}
      </CardHeader>
      <CardContent className="text-2xl font-semibold tabular-nums">
        {value}
      </CardContent>
    </Card>
  );
}

function StatMini({
  label,
  value,
  code,
}: {
  label: string;
  value: string;
  code?: string;
}) {
  return (
    <div
      className="min-w-0 rounded-md border border-neutral-100 bg-neutral-50/80 px-1 py-1.5 dark:border-neutral-800 dark:bg-neutral-900/50"
      title={code ? `${label} · ${code}` : label}
    >
      <div className="break-words text-[8px] font-medium leading-snug text-neutral-500">
        {label}
      </div>
      <div className="text-[15px] font-semibold tabular-nums leading-tight">
        {value}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-neutral-100 py-1 text-xs last:border-0 dark:border-neutral-900">
      <span className="text-neutral-500">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}

