"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  endOfDay,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";
import { useRouter } from "next/navigation";
import { parseSheetBool } from "@/lib/dates";
import { shouldMaskClientPhoneForRole } from "@/lib/phone-display";
import {
  statusColorTextClass,
  statusRowForCode,
  type StatusCategory,
} from "@/lib/status-labels";
import { cn } from "@/lib/utils";
import type { LeadRow, SessionUser, StatusRow } from "@/types/models";
import { useLeadsUi } from "@/lib/stores/leads-ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  createLeadAction,
  updateLeadAction,
} from "@/server/actions/leads";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Radix Select requires a non-empty string `value` for the empty option. */
const STATUS_SELECT_EMPTY = "__status_empty__";

type RefPack = {
  partners: {
    partner_id: string;
    partner_name: string;
    country_code: string;
    operating_country_codes: string[];
  }[];
  countries: { country_code: string; country_name: string }[];
  statuses: StatusRow[];
};

function statusesForSelect(
  statuses: StatusRow[],
  category: string,
): { status_code: string; status_label: string }[] {
  return statuses
    .filter((s) => {
      if (s.category !== category) return false;
      const af = (s.active_flag ?? "").trim();
      return af === "" || parseSheetBool(s.active_flag);
    })
    .sort((a, b) => {
      const ao = Number(a.sort_order) || 0;
      const bo = Number(b.sort_order) || 0;
      if (ao !== bo) return ao - bo;
      return (a.status_label || a.status_code).localeCompare(
        b.status_label || b.status_code,
      );
    })
    .map((s) => ({
      status_code: s.status_code,
      status_label: s.status_label || s.status_code,
    }));
}

/** Resolve display label for a stored status_code (any row in catalog, including inactive). */
function statusLabelForCode(
  statuses: StatusRow[],
  category: string,
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

function statusOptionTextClass(
  statuses: StatusRow[],
  category: StatusCategory,
  code: string,
): string {
  const c = (code ?? "").trim();
  if (!c) {
    return "font-normal text-neutral-800 dark:text-neutral-200";
  }
  return (
    statusColorTextClass(
      statusRowForCode(statuses, category, c)?.color ?? "",
    ) ?? "font-normal text-neutral-800 dark:text-neutral-200"
  );
}

/** Mirrors `editableLeadFields` in server/auth/rbac for table inline edits. */
function canEditTransferStatusCell(user: SessionUser): boolean {
  return (
    user.role === "admin" ||
    user.role === "rop" ||
    user.role === "our_manager" ||
    user.role === "partner_dept_manager"
  );
}

function canEditPartnerStatusCell(user: SessionUser): boolean {
  return (
    user.role === "admin" ||
    user.role === "rop" ||
    user.role === "our_manager" ||
    user.role === "partner_dept_manager" ||
    user.role === "partner"
  );
}

function LeadTableStatusCell({
  lead,
  field,
  category,
  reference,
  canEdit,
  onSaved,
}: {
  lead: LeadRow;
  field: "transfer_status" | "partner_status";
  category: "transfer_status" | "partner_status";
  reference: RefPack;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const value = lead[field] ?? "";
  const options = statusesForSelect(reference.statuses, category);
  const label = statusLabelForCode(reference.statuses, category, value);
  const catalogTone = statusColorTextClass(
    statusRowForCode(reference.statuses, category, value)?.color ?? "",
  );

  if (!canEdit) {
    if (catalogTone) {
      return (
        <span
          className={cn(
            "max-w-[160px] cursor-default truncate text-[11px]",
            catalogTone,
          )}
          title={label}
        >
          {label}
        </span>
      );
    }
    return (
      <Badge
        variant={statusBadgeVariant(label === "—" ? "" : label)}
        className="max-w-[160px] cursor-default truncate font-normal"
      >
        {label}
      </Badge>
    );
  }

  return (
    <InlineStatusSelect
      leadId={lead.lead_id}
      field={field}
      category={category}
      value={value}
      options={options}
      allStatuses={reference.statuses}
      onSaved={onSaved}
    />
  );
}

function InlineStatusSelect({
  leadId,
  field,
  category,
  value,
  options,
  allStatuses,
  onSaved,
}: {
  leadId: string;
  field: "transfer_status" | "partner_status";
  category: "transfer_status" | "partner_status";
  value: string;
  options: { status_code: string; status_label: string }[];
  allStatuses: StatusRow[];
  onSaved: () => void;
}) {
  const [local, setLocal] = React.useState(value);
  const [pending, setPending] = React.useState(false);
  React.useEffect(() => {
    setLocal(value);
  }, [value, leadId]);

  const missing =
    local.trim() !== "" &&
    !options.some((o) => o.status_code === local);

  const selectValue =
    local.trim() === "" ? STATUS_SELECT_EMPTY : local;

  const triggerTone =
    statusColorTextClass(
      statusRowForCode(allStatuses, category, local)?.color ?? "",
    ) ?? "font-normal text-neutral-800 dark:text-neutral-200";

  const change = async (next: string) => {
    const real = next === STATUS_SELECT_EMPTY ? "" : next;
    if (real === local) return;
    const prev = local;
    setLocal(real);
    setPending(true);
    try {
      await updateLeadAction(leadId, { [field]: real });
      onSaved();
    } catch (e) {
      setLocal(prev);
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="max-w-[180px]"
      title={statusLabelForCode(allStatuses, category, local)}
    >
      <Select
        value={selectValue}
        onValueChange={(v) => void change(v)}
        disabled={pending}
      >
        <SelectTrigger
          className={cn(
            "h-7 max-w-[180px] text-[11px]",
            pending && "opacity-50",
            triggerTone,
          )}
          aria-label={
            field === "transfer_status"
              ? "Transfer status"
              : "Partner status"
          }
        >
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value={STATUS_SELECT_EMPTY}
            className={cn(
              "text-[11px]",
              statusOptionTextClass(allStatuses, category, ""),
            )}
          >
            —
          </SelectItem>
          {missing ? (
            <SelectItem
              value={local}
              className={cn(
                "text-[11px]",
                statusOptionTextClass(allStatuses, category, local),
              )}
            >
              {statusLabelForCode(allStatuses, category, local)} (inactive)
            </SelectItem>
          ) : null}
          {options.map((o) => (
            <SelectItem
              key={o.status_code}
              value={o.status_code}
              className={cn(
                "text-[11px]",
                statusOptionTextClass(
                  allStatuses,
                  category,
                  o.status_code,
                ),
              )}
            >
              {o.status_label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function statusBadgeVariant(
  s: string,
): "default" | "success" | "warn" | "danger" | "muted" {
  const x = s.toLowerCase();
  if (x.includes("won") || x.includes("signed")) return "success";
  if (x.includes("lost") || x.includes("reject")) return "danger";
  if (x.includes("progress") || x.includes("work")) return "warn";
  if (!s) return "muted";
  return "default";
}

/** Комментарий в таблице: 1–2 строки, полный текст в title. */
function CompactCommentCell({
  text,
  compact,
}: {
  text: string;
  compact: boolean;
}) {
  const t = (text ?? "").trim();
  if (!t) {
    return <span className="text-neutral-400">—</span>;
  }
  return (
    <span
      className={`block max-w-[220px] cursor-default text-[11px] leading-snug text-neutral-800 dark:text-neutral-200 ${
        compact ? "line-clamp-1" : "line-clamp-2"
      }`}
      title={t}
    >
      {t}
    </span>
  );
}

export function LeadsWorkspace({
  user,
  leads,
  reference,
  canCreate,
}: {
  user: SessionUser;
  leads: LeadRow[];
  reference: RefPack;
  canCreate: boolean;
}) {
  const router = useRouter();
  const ui = useLeadsUi();
  const canCreateLead =
    canCreate &&
    (user.role !== "our_manager" ||
      (reference.countries.length > 0 && reference.partners.length > 0));
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = ui.search.trim().toLowerCase();
    return leads.filter((l) => {
      if (ui.country && l.country_code !== ui.country) return false;
      if (ui.partner && l.partner_id !== ui.partner) return false;
      if (ui.transferStatus && l.transfer_status !== ui.transferStatus)
        return false;
      if (ui.partnerStatus && l.partner_status !== ui.partnerStatus)
        return false;
      if (ui.dateFrom) {
        const d = safeIso(l.created_at);
        if (d && isBefore(d, startOfDay(parseISO(ui.dateFrom)))) return false;
      }
      if (ui.dateTo) {
        const d = safeIso(l.created_at);
        if (d && isAfter(d, endOfDay(parseISO(ui.dateTo)))) return false;
      }
      if (!q) return true;
      const phoneHay = shouldMaskClientPhoneForRole(user.role)
        ? (() => {
            const d = String(l.client_phone ?? "").replace(/\D/g, "");
            return d.length >= 4 ? d.slice(-4) : d;
          })()
        : l.client_phone;
      const hay = [
        l.lead_id,
        l.client_name,
        phoneHay,
        l.partner_name,
        l.crm_deal_id,
        l.source_manager_name,
        l.manager_comment,
        l.partner_comment,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leads, ui, user.role]);

  const onLeadSaved = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const isPartnerUser = user.role === "partner";

  const columns = React.useMemo<ColumnDef<LeadRow>[]>(() => {
    const sharedAfterName: ColumnDef<LeadRow>[] = [
      {
        accessorKey: "transfer_status",
        header: "Transfer",
        cell: (c) => (
          <LeadTableStatusCell
            lead={c.row.original}
            field="transfer_status"
            category="transfer_status"
            reference={reference}
            canEdit={canEditTransferStatusCell(user)}
            onSaved={onLeadSaved}
          />
        ),
      },
      {
        accessorKey: "partner_status",
        header: "Partner st.",
        cell: (c) => (
          <LeadTableStatusCell
            lead={c.row.original}
            field="partner_status"
            category="partner_status"
            reference={reference}
            canEdit={canEditPartnerStatusCell(user)}
            onSaved={onLeadSaved}
          />
        ),
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: (c) => (
          <span className="whitespace-nowrap text-[11px] text-neutral-500">
            {fmtShort(String(c.getValue() ?? ""))}
          </span>
        ),
      },
    ];

    const partnerExtra: ColumnDef<LeadRow>[] = [
      {
        accessorKey: "client_phone",
        header: "Phone",
        cell: (c) => {
          /* `requireLeadsContext` masks phone for partner / our_manager. */
          const display = String(c.row.original.client_phone ?? "");
          return (
            <span
              className="max-w-[120px] truncate font-mono text-[11px]"
              title={display || undefined}
            >
              {display || "—"}
            </span>
          );
        },
      },
      {
        id: "manager_comment",
        header: "Mgr comment",
        accessorFn: (r) => r.manager_comment,
        cell: (c) => (
          <CompactCommentCell
            text={c.row.original.manager_comment}
            compact={ui.compact}
          />
        ),
      },
      {
        id: "partner_comment",
        header: "Partner comment",
        accessorFn: (r) => r.partner_comment,
        cell: (c) => (
          <CompactCommentCell
            text={c.row.original.partner_comment}
            compact={ui.compact}
          />
        ),
      },
    ];

    const base: ColumnDef<LeadRow>[] = [
      {
        accessorKey: "lead_id",
        header: "ID",
        cell: (c) => (
          <button
            type="button"
            className="max-w-[100px] truncate text-left font-mono text-[11px] text-blue-600 hover:underline dark:text-blue-400"
            onClick={() => setOpenId(c.row.original.lead_id)}
          >
            {c.getValue() as string}
          </button>
        ),
      },
      {
        accessorKey: "client_name",
        header: "Client",
        cell: (c) => (
          <span className="max-w-[140px] truncate font-medium">
            {String(c.getValue() ?? "")}
          </span>
        ),
      },
    ];

    if (isPartnerUser) {
      return [...base, ...partnerExtra, ...sharedAfterName];
    }

    return [
      ...base,
      {
        accessorKey: "partner_name",
        header: "Partner",
        cell: (c) => (
          <span className="max-w-[120px] truncate text-xs">
            {String(c.getValue() ?? "")}
          </span>
        ),
      },
      {
        accessorKey: "country_code",
        header: "CC",
        size: 48,
      },
      ...sharedAfterName,
    ];
  }, [user, reference, onLeadSaved, ui.compact, isPartnerUser]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const active = openId ? leads.find((l) => l.lead_id === openId) : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="sticky top-11 z-30 flex flex-wrap items-end gap-2 border-b border-neutral-100 bg-white/95 pb-2 pt-1 dark:border-neutral-900 dark:bg-neutral-950/95">
        <div className="flex min-w-[160px] flex-1 flex-col gap-1">
          <Label>Search</Label>
          <Input
            placeholder="Name, phone, CRM…"
            value={ui.search}
            onChange={(e) => ui.setSearch(e.target.value)}
          />
        </div>
        {user.role !== "partner" ? (
          <>
            <FilterSelect
              label="Country"
              value={ui.country}
              onChange={ui.setCountry}
              options={[
                { v: "", l: "All" },
                ...reference.countries.map((c) => ({
                  v: c.country_code,
                  l: `${c.country_code} — ${c.country_name}`,
                })),
              ]}
            />
            <FilterSelect
              label="Partner"
              value={ui.partner}
              onChange={ui.setPartner}
              options={[
                { v: "", l: "All" },
                ...reference.partners.map((p) => ({
                  v: p.partner_id,
                  l: p.partner_name,
                })),
              ]}
            />
          </>
        ) : null}
        <FilterSelect
          label="Transfer"
          value={ui.transferStatus}
          onChange={ui.setTransferStatus}
          options={uniqOptions(
            ["", ...leads.map((l) => l.transfer_status)].filter(Boolean),
          )}
        />
        <FilterSelect
          label="Partner status"
          value={ui.partnerStatus}
          onChange={ui.setPartnerStatus}
          options={uniqOptions(
            ["", ...leads.map((l) => l.partner_status)].filter(Boolean),
          )}
        />
        <div className="flex flex-col gap-1">
          <Label>From</Label>
          <Input
            type="date"
            value={ui.dateFrom}
            onChange={(e) => ui.setDateFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>To</Label>
          <Input
            type="date"
            value={ui.dateTo}
            onChange={(e) => ui.setDateTo(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 pb-1">
          <label className="flex cursor-pointer items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={ui.compact}
              onChange={(e) => ui.setCompact(e.target.checked)}
            />
            Compact
          </label>
          <Button type="button" variant="secondary" size="sm" onClick={ui.reset}>
            Reset
          </Button>
          {canCreateLead ? (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              New lead
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className={
          ui.compact ? "text-[12px] [&_td]:py-1 [&_th]:py-1" : "text-sm [&_td]:py-2"
        }
      >
        <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
          <table
            className={`w-full border-collapse text-left ${user.role === "partner" ? "min-w-[960px]" : "min-w-[720px]"}`}
          >
            <thead className="sticky top-0 z-10 bg-neutral-50 text-[11px] uppercase text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="cursor-pointer border-b border-neutral-200 px-2 font-medium dark:border-neutral-800"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        h.column.columnDef.header,
                        h.getContext(),
                      )}
                      {{
                        asc: " ↑",
                        desc: " ↓",
                      }[h.column.getIsSorted() as string] ?? null}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-3 py-8 text-center text-sm text-neutral-500"
                  >
                    No leads match filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-neutral-100 hover:bg-neutral-50/80 dark:border-neutral-900 dark:hover:bg-neutral-900/40"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-2 align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          Showing {filtered.length} of {leads.length} visible to you
        </p>
      </div>

      <LeadEditDialog
        lead={active}
        open={!!active}
        onOpenChange={(o) => !o && setOpenId(null)}
        reference={reference}
        user={user}
        onSaved={() => router.refresh()}
      />

      <CreateLeadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        reference={reference}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="flex min-w-[120px] flex-col gap-1">
      <Label>{label}</Label>
      <select
        className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs dark:border-neutral-800 dark:bg-neutral-950"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.v || "__all"} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );
}

function uniqOptions(vals: string[]) {
  const u = [...new Set(vals)];
  return [{ v: "", l: "All" }, ...u.map((v) => ({ v, l: v || "—" }))];
}

function fmtShort(iso: string) {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

function safeIso(s: string) {
  try {
    return parseISO(s);
  } catch {
    return null;
  }
}

function LeadEditDialog({
  lead,
  open,
  onOpenChange,
  reference,
  user,
  onSaved,
}: {
  lead: LeadRow | null | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reference: RefPack;
  user: SessionUser;
  onSaved: () => void;
}) {
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (!lead) return;
    setDraft({
      partner_status: lead.partner_status,
      transfer_status: lead.transfer_status,
      manager_comment: lead.manager_comment,
      partner_comment: lead.partner_comment,
      partner_manager_name: lead.partner_manager_name,
      client_name: lead.client_name,
      client_phone: lead.client_phone,
      client_email: lead.client_email,
      crm_deal_id: lead.crm_deal_id,
      service_type: lead.service_type,
      final_outcome: lead.final_outcome,
      contract_amount_local: lead.contract_amount_local,
      commission_percent: lead.commission_percent,
    });
  }, [lead]);

  if (!lead) return null;

  const save = async () => {
    try {
      await updateLeadAction(lead.lead_id, draft);
      toast.success("Saved");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const isPartner = user.role === "partner";
  const hideFullPhone = shouldMaskClientPhoneForRole(user.role);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{lead.client_name}</DialogTitle>
          <p className="text-xs text-neutral-500">{lead.lead_id}</p>
        </DialogHeader>
        <div className="grid gap-3">
          {!isPartner ? (
            <>
              <Field
                label="Client"
                value={draft.client_name ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, client_name: v }))}
              />
              {hideFullPhone ? (
                <ReadOnlyField
                  label="Phone"
                  value={draft.client_phone ?? ""}
                  hint="Только просмотр"
                />
              ) : (
                <Field
                  label="Phone"
                  value={draft.client_phone ?? ""}
                  onChange={(v) => setDraft((d) => ({ ...d, client_phone: v }))}
                />
              )}
              <Field
                label="Email"
                value={draft.client_email ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, client_email: v }))}
              />
              <Field
                label="CRM deal"
                value={draft.crm_deal_id ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, crm_deal_id: v }))}
              />
              <Field
                label="Service"
                value={draft.service_type ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, service_type: v }))}
              />
            </>
          ) : (
            <ReadOnlyField
              label="Phone"
              value={draft.client_phone ?? ""}
              hint="Только просмотр"
            />
          )}
          <SelectField
            label="Transfer status"
            value={draft.transfer_status ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, transfer_status: v }))}
            options={statusesForSelect(reference.statuses, "transfer_status")}
            disabled={isPartner}
            allStatuses={reference.statuses}
            category="transfer_status"
          />
          <SelectField
            label="Partner status"
            value={draft.partner_status ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, partner_status: v }))}
            options={statusesForSelect(reference.statuses, "partner_status")}
            allStatuses={reference.statuses}
            category="partner_status"
          />
          <SelectField
            label="Final outcome"
            value={draft.final_outcome ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, final_outcome: v }))}
            options={statusesForSelect(reference.statuses, "final_outcome")}
            disabled={isPartner}
            allStatuses={reference.statuses}
            category="final_outcome"
          />
          {isPartner ? (
            <Field
              label="Partner manager"
              value={draft.partner_manager_name ?? ""}
              onChange={(v) =>
                setDraft((d) => ({ ...d, partner_manager_name: v }))
              }
            />
          ) : null}
          {!isPartner ? (
            <Area
              label="Manager comment"
              value={draft.manager_comment ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, manager_comment: v }))}
            />
          ) : (
            <ReadOnlyArea
              label="Manager comment"
              value={draft.manager_comment ?? ""}
              hint="Комментарий менеджера (только просмотр)"
            />
          )}
          <Area
            label="Partner comment"
            value={draft.partner_comment ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, partner_comment: v }))}
          />
          {!isPartner ? (
            <>
              <Field
                label="Amount (local)"
                value={draft.contract_amount_local ?? ""}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, contract_amount_local: v }))
                }
              />
              <Field
                label="Commission %"
                value={draft.commission_percent ?? ""}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, commission_percent: v }))
                }
              />
            </>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => void save()}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <textarea
        className="min-h-[72px] rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm dark:border-neutral-800 dark:bg-neutral-950"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="grid gap-1">
      <Label className="flex items-baseline gap-2">
        {label}
        {hint ? (
          <span className="text-[10px] font-normal text-neutral-400">{hint}</span>
        ) : null}
      </Label>
      <Input
        readOnly
        tabIndex={-1}
        value={value}
        className="cursor-default bg-neutral-50 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
      />
    </div>
  );
}

function ReadOnlyArea({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="grid gap-1">
      <Label className="flex flex-wrap items-baseline gap-2">
        {label}
        {hint ? (
          <span className="text-[10px] font-normal text-neutral-400">{hint}</span>
        ) : null}
      </Label>
      <textarea
        readOnly
        tabIndex={-1}
        className="min-h-[72px] cursor-default resize-none rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
        value={value}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
  allStatuses,
  category,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { status_code: string; status_label: string }[];
  disabled?: boolean;
  allStatuses: StatusRow[];
  category: StatusCategory;
}) {
  const missing =
    value.trim() !== "" &&
    !options.some((o) => o.status_code === value);
  const selectValue =
    value.trim() === "" ? STATUS_SELECT_EMPTY : value;

  const triggerTone =
    statusColorTextClass(
      statusRowForCode(allStatuses, category, value)?.color ?? "",
    ) ?? "font-normal text-neutral-800 dark:text-neutral-200";

  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Select
        value={selectValue}
        onValueChange={(v) =>
          onChange(v === STATUS_SELECT_EMPTY ? "" : v)
        }
        disabled={disabled}
      >
        <SelectTrigger
          className={cn("h-8 w-full", disabled && "opacity-50", triggerTone)}
          aria-label={label}
        >
          <SelectValue placeholder="—" className="min-w-0 truncate" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value={STATUS_SELECT_EMPTY}
            className={statusOptionTextClass(allStatuses, category, "")}
          >
            —
          </SelectItem>
          {missing ? (
            <SelectItem
              value={value}
              className={statusOptionTextClass(
                allStatuses,
                category,
                value,
              )}
            >
              {value} (not in catalog)
            </SelectItem>
          ) : null}
          {options.map((o) => (
            <SelectItem
              key={o.status_code}
              value={o.status_code}
              className={statusOptionTextClass(
                allStatuses,
                category,
                o.status_code,
              )}
            >
              {o.status_label || o.status_code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CreateLeadDialog({
  open,
  onOpenChange,
  reference,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reference: RefPack;
  onCreated: () => void;
}) {
  const [f, setF] = React.useState({
    country_code: reference.countries[0]?.country_code ?? "",
    partner_id: reference.partners[0]?.partner_id ?? "",
    client_name: "",
    client_phone: "",
    client_email: "",
    service_type: "",
    crm_deal_id: "",
  });

  const partnersForCountry = React.useMemo(() => {
    const fc = f.country_code.trim().toUpperCase();
    if (!fc) return reference.partners;
    return reference.partners.filter((p) =>
      p.operating_country_codes.some((c) => c.toUpperCase() === fc),
    );
  }, [reference.partners, f.country_code]);

  React.useEffect(() => {
    if (!open) return;
    if (
      partnersForCountry.length > 0 &&
      !partnersForCountry.some((p) => p.partner_id === f.partner_id)
    ) {
      setF((x) => ({
        ...x,
        partner_id: partnersForCountry[0]?.partner_id ?? "",
      }));
    }
  }, [open, f.country_code, f.partner_id, partnersForCountry]);

  const scopeEmpty =
    reference.countries.length === 0 || reference.partners.length === 0;

  const submit = async () => {
    try {
      const res = await createLeadAction(f);
      toast.success(`Created ${res.leadId}`);
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {scopeEmpty ? (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              No countries or partners are available for your account. Ask an
              admin to set <strong>Source_Managers</strong> (country / partner
              scope) and link your user to the correct{" "}
              <strong>source_manager_id</strong>.
            </p>
          ) : null}
          <div className="grid gap-1">
            <Label>Country</Label>
            <select
              className="h-8 rounded-md border px-2 text-sm"
              value={f.country_code}
              onChange={(e) => setF((x) => ({ ...x, country_code: e.target.value }))}
              disabled={scopeEmpty}
            >
              {reference.countries.map((c) => (
                <option key={c.country_code} value={c.country_code}>
                  {c.country_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Label>Partner</Label>
            <select
              className="h-8 rounded-md border px-2 text-sm"
              value={f.partner_id}
              onChange={(e) => setF((x) => ({ ...x, partner_id: e.target.value }))}
              disabled={scopeEmpty || partnersForCountry.length === 0}
            >
              {partnersForCountry.map((p) => (
                <option key={p.partner_id} value={p.partner_id}>
                  {p.partner_name}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Client name *"
            value={f.client_name}
            onChange={(v) => setF((x) => ({ ...x, client_name: v }))}
          />
          <Field
            label="Phone"
            value={f.client_phone}
            onChange={(v) => setF((x) => ({ ...x, client_phone: v }))}
          />
          <Field
            label="Email"
            value={f.client_email}
            onChange={(v) => setF((x) => ({ ...x, client_email: v }))}
          />
          <Field
            label="Service"
            value={f.service_type}
            onChange={(v) => setF((x) => ({ ...x, service_type: v }))}
          />
          <Field
            label="CRM deal"
            value={f.crm_deal_id}
            onChange={(v) => setF((x) => ({ ...x, crm_deal_id: v }))}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              scopeEmpty ||
              !f.client_name.trim() ||
              !f.country_code ||
              !f.partner_id
            }
            onClick={() => void submit()}
          >
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
