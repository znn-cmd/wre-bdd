"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { parseSheetBool } from "@/lib/dates";
import { partnerOperatingCountryCodes } from "@/lib/partners";
import {
  adminDeleteStatusAction,
  adminSaveCountryAction,
  adminSavePartnerAction,
  adminSaveStatusAction,
} from "@/server/actions/catalog";
import type {
  CountryRow,
  PartnerRow,
  SourceManagerRow,
  StatusRow,
} from "@/types/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function sortStatusRows(rows: StatusRow[]): StatusRow[] {
  return [...rows].sort((a, b) => {
    const ao = Number(a.sort_order) || 0;
    const bo = Number(b.sort_order) || 0;
    if (ao !== bo) return ao - bo;
    return (a.status_label || a.status_code).localeCompare(
      b.status_label || b.status_code,
    );
  });
}

export function CatalogAdmin({
  countries,
  partners,
  sourceManagers,
  statuses,
}: {
  countries: CountryRow[];
  partners: PartnerRow[];
  sourceManagers: SourceManagerRow[];
  statuses: StatusRow[];
}) {
  const router = useRouter();
  const smHint = sourceManagers
    .filter((s) => parseSheetBool(s.active_flag))
    .map((s) => `${s.source_manager_id} (${s.source_manager_name})`)
    .join(", ");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Catalog</h1>
        <p className="mt-1 max-w-2xl text-xs text-neutral-500 dark:text-neutral-400">
          Manage countries, partners, and lead status lists (transfer / partner).
          Partners can operate in multiple countries (comma-separated codes). Use{" "}
          <strong>Our manager IDs</strong> to restrict a partner to specific source
          managers; leave empty so any manager with matching geography in{" "}
          <strong>Source_Managers</strong> can work with them.
        </p>
        {smHint ? (
          <p className="mt-2 text-[11px] text-neutral-500">
            Active source managers: {smHint}
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Countries</h2>
        <CreateCountryForm onDone={() => router.refresh()} />
        <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead className="bg-neutral-50 text-[10px] uppercase dark:bg-neutral-900">
              <tr>
                <th className="border-b px-2 py-2">Code</th>
                <th className="border-b px-2 py-2">Name</th>
                <th className="border-b px-2 py-2">Currency</th>
                <th className="border-b px-2 py-2">FX→USD</th>
                <th className="border-b px-2 py-2">Active</th>
                <th className="border-b px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {countries.map((c) => (
                <CountryRowEditor key={c.country_code} c={c} onSaved={() => router.refresh()} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Partners</h2>
        <CreatePartnerForm onDone={() => router.refresh()} />
        <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead className="bg-neutral-50 text-[10px] uppercase dark:bg-neutral-900">
              <tr>
                <th className="border-b px-2 py-2">ID</th>
                <th className="border-b px-2 py-2">Name</th>
                <th className="border-b px-2 py-2">Countries</th>
                <th className="border-b px-2 py-2">Manager IDs</th>
                <th className="border-b px-2 py-2">Active</th>
                <th className="border-b px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <PartnerRowEditor key={p.partner_id} p={p} onSaved={() => router.refresh()} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <StatusCatalogSection
        title="Transfer status"
        category="transfer_status"
        rows={sortStatusRows(
          statuses.filter((s) => s.category === "transfer_status"),
        )}
        onSaved={() => router.refresh()}
      />
      <StatusCatalogSection
        title="Partner status"
        category="partner_status"
        rows={sortStatusRows(
          statuses.filter((s) => s.category === "partner_status"),
        )}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function StatusCatalogSection({
  title,
  category,
  rows,
  onSaved,
}: {
  title: string;
  category: "transfer_status" | "partner_status";
  rows: StatusRow[];
  onSaved: () => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="max-w-2xl text-[11px] text-neutral-500 dark:text-neutral-400">
        <strong>Code</strong> is stored in leads (stable id). <strong>Label</strong>{" "}
        is shown in dropdowns. Inactive rows are hidden from pickers but existing lead
        values stay as-is.
      </p>
      <CreateStatusForm category={category} onDone={onSaved} />
      <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[880px] border-collapse text-left text-xs">
          <thead className="bg-neutral-50 text-[10px] uppercase dark:bg-neutral-900">
            <tr>
              <th className="border-b px-2 py-2">Code</th>
              <th className="border-b px-2 py-2">Label</th>
              <th className="border-b px-2 py-2">Description</th>
              <th className="border-b px-2 py-2 w-16">Sort</th>
              <th className="border-b px-2 py-2">Final</th>
              <th className="border-b px-2 py-2">Active</th>
              <th className="border-b px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <StatusRowEditor key={`${s.category}:${s.status_code}`} s={s} onSaved={onSaved} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CreateStatusForm({
  category,
  onDone,
}: {
  category: "transfer_status" | "partner_status";
  onDone: () => void;
}) {
  const [status_code, setCode] = React.useState("");
  const [status_label, setLabel] = React.useState("");
  const [status_description, setDesc] = React.useState("");
  const [sort_order, setSort] = React.useState("0");
  const submit = async () => {
    try {
      await adminSaveStatusAction({
        category,
        status_code,
        status_label,
        status_description,
        sort_order,
        is_final: "false",
        active_flag: "true",
      });
      toast.success("Status added");
      setCode("");
      setLabel("");
      setDesc("");
      setSort("0");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-neutral-200 p-3 dark:border-neutral-800">
      <div className="grid gap-1">
        <Label className="text-[10px]">Code *</Label>
        <Input
          className="h-8 w-36 font-mono text-xs"
          placeholder="e.g. new"
          value={status_code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <div className="grid min-w-[160px] flex-1 gap-1">
        <Label className="text-[10px]">Label *</Label>
        <Input
          className="h-8 text-xs"
          placeholder="Shown in UI"
          value={status_label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <div className="grid min-w-[200px] flex-1 gap-1">
        <Label className="text-[10px]">Description</Label>
        <Input className="h-8 text-xs" value={status_description} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label className="text-[10px]">Sort</Label>
        <Input className="h-8 w-16 text-xs" value={sort_order} onChange={(e) => setSort(e.target.value)} />
      </div>
      <Button type="button" size="sm" className="h-8" onClick={() => void submit()}>
        Add status
      </Button>
    </div>
  );
}

function StatusRowEditor({
  s,
  onSaved,
}: {
  s: StatusRow;
  onSaved: () => void;
}) {
  const originalCode = s.status_code;
  const [status_code, setCode] = React.useState(s.status_code);
  const [status_label, setLabel] = React.useState(s.status_label);
  const [status_description, setDesc] = React.useState(s.status_description);
  const [sort_order, setSort] = React.useState(s.sort_order || "0");
  const [is_final, setFinal] = React.useState(
    s.is_final === "true" || s.is_final === "TRUE" ? "true" : "false",
  );
  const [active_flag, setAct] = React.useState(
    s.active_flag === "true" || s.active_flag === "TRUE" ? "true" : "false",
  );

  React.useEffect(() => {
    setCode(s.status_code);
    setLabel(s.status_label);
    setDesc(s.status_description);
    setSort(s.sort_order || "0");
    setFinal(s.is_final === "true" || s.is_final === "TRUE" ? "true" : "false");
    setAct(s.active_flag === "true" || s.active_flag === "TRUE" ? "true" : "false");
  }, [s]);

  const save = async () => {
    try {
      await adminSaveStatusAction({
        category: s.category as "transfer_status" | "partner_status",
        status_code,
        status_label,
        status_description,
        sort_order,
        is_final: is_final as "true" | "false",
        active_flag: active_flag as "true" | "false",
        previous_status_code: originalCode,
      });
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const remove = async () => {
    if (
      !window.confirm(
        `Delete status “${status_label || status_code}” (${status_code})? Leads that still use this code will keep the raw value.`,
      )
    ) {
      return;
    }
    try {
      await adminDeleteStatusAction({
        category: s.category as "transfer_status" | "partner_status",
        status_code: originalCode,
      });
      toast.success("Deleted");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <tr className="align-top">
      <td className="border-b px-2 py-1">
        <Input className="h-7 w-32 font-mono text-[11px]" value={status_code} onChange={(e) => setCode(e.target.value)} />
      </td>
      <td className="border-b px-2 py-1">
        <Input className="h-7 min-w-[120px] text-xs" value={status_label} onChange={(e) => setLabel(e.target.value)} />
      </td>
      <td className="border-b px-2 py-1">
        <Input className="h-7 min-w-[160px] text-xs" value={status_description} onChange={(e) => setDesc(e.target.value)} />
      </td>
      <td className="border-b px-2 py-1">
        <Input className="h-7 w-14 text-xs" value={sort_order} onChange={(e) => setSort(e.target.value)} />
      </td>
      <td className="border-b px-2 py-1">
        <select
          className="h-7 rounded border bg-white px-1 text-xs dark:bg-neutral-950"
          value={is_final}
          onChange={(e) => setFinal(e.target.value)}
        >
          <option value="false">false</option>
          <option value="true">true</option>
        </select>
      </td>
      <td className="border-b px-2 py-1">
        <select
          className="h-7 rounded border bg-white px-1 text-xs dark:bg-neutral-950"
          value={active_flag}
          onChange={(e) => setAct(e.target.value)}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </td>
      <td className="border-b px-2 py-1">
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="sm" className="h-7 text-[10px]" onClick={() => void save()}>
            Save
          </Button>
          <Button type="button" size="sm" variant="secondary" className="h-7 text-[10px]" onClick={() => void remove()}>
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}

function CreateCountryForm({ onDone }: { onDone: () => void }) {
  const [country_code, setCode] = React.useState("");
  const [country_name, setName] = React.useState("");
  const [local_currency, setCur] = React.useState("");
  const [fx_rate_to_usd, setFx] = React.useState("");
  const submit = async () => {
    try {
      await adminSaveCountryAction({
        country_code,
        country_name,
        local_currency,
        fx_rate_to_usd,
        active_flag: "true",
      });
      toast.success("Country saved");
      setCode("");
      setName("");
      setCur("");
      setFx("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-neutral-200 p-3 dark:border-neutral-800">
      <div className="grid gap-1">
        <Label className="text-[10px]">Code</Label>
        <Input className="h-8 w-20 text-xs" value={country_code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <div className="grid min-w-[140px] flex-1 gap-1">
        <Label className="text-[10px]">Name</Label>
        <Input className="h-8 text-xs" value={country_name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label className="text-[10px]">Currency</Label>
        <Input className="h-8 w-20 text-xs" value={local_currency} onChange={(e) => setCur(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label className="text-[10px]">FX→USD</Label>
        <Input className="h-8 w-24 text-xs" value={fx_rate_to_usd} onChange={(e) => setFx(e.target.value)} />
      </div>
      <Button type="button" size="sm" className="h-8" onClick={() => void submit()}>
        Add country
      </Button>
    </div>
  );
}

function CountryRowEditor({
  c,
  onSaved,
}: {
  c: CountryRow;
  onSaved: () => void;
}) {
  const [country_name, setName] = React.useState(c.country_name);
  const [local_currency, setCur] = React.useState(c.local_currency);
  const [fx_rate_to_usd, setFx] = React.useState(c.fx_rate_to_usd);
  const [active_flag, setAct] = React.useState(c.active_flag === "true" || c.active_flag === "TRUE" ? "true" : "false");

  const save = async () => {
    try {
      await adminSaveCountryAction({
        country_code: c.country_code,
        country_name,
        local_currency,
        fx_rate_to_usd,
        active_flag: active_flag as "true" | "false",
      });
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <tr>
      <td className="border-b px-2 py-1 font-mono">{c.country_code}</td>
      <td className="border-b px-2 py-1">
        <Input className="h-7 text-xs" value={country_name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td className="border-b px-2 py-1">
        <Input className="h-7 w-20 text-xs" value={local_currency} onChange={(e) => setCur(e.target.value)} />
      </td>
      <td className="border-b px-2 py-1">
        <Input className="h-7 w-24 text-xs" value={fx_rate_to_usd} onChange={(e) => setFx(e.target.value)} />
      </td>
      <td className="border-b px-2 py-1">
        <select
          className="h-7 rounded border bg-white px-1 text-xs dark:bg-neutral-950"
          value={active_flag}
          onChange={(e) => setAct(e.target.value)}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </td>
      <td className="border-b px-2 py-1">
        <Button type="button" size="sm" className="h-7 text-[10px]" onClick={() => void save()}>
          Save
        </Button>
      </td>
    </tr>
  );
}

function CreatePartnerForm({ onDone }: { onDone: () => void }) {
  const [partner_name, setName] = React.useState("");
  const [countries_csv, setCc] = React.useState("");
  const [source_manager_ids, setSm] = React.useState("");
  const submit = async () => {
    try {
      await adminSavePartnerAction({
        partner_name,
        countries_csv,
        source_manager_ids,
        active_flag: "true",
        notification_enabled: "true",
      });
      toast.success("Partner created");
      setName("");
      setCc("");
      setSm("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  return (
    <div className="grid gap-2 rounded-md border border-dashed border-neutral-200 p-3 dark:border-neutral-800">
      <div className="grid gap-1 md:grid-cols-2">
        <div className="grid gap-1">
          <Label className="text-[10px]">Partner name *</Label>
          <Input className="h-8 text-xs" value={partner_name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label className="text-[10px]">Countries * (comma-separated, e.g. DE, AE)</Label>
          <Input className="h-8 text-xs" value={countries_csv} onChange={(e) => setCc(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-1">
        <Label className="text-[10px]">Our manager IDs (optional, comma-separated)</Label>
        <Input
          className="h-8 text-xs"
          placeholder="SM-1, SM-2"
          value={source_manager_ids}
          onChange={(e) => setSm(e.target.value)}
        />
      </div>
      <Button type="button" size="sm" className="h-8 w-fit" onClick={() => void submit()}>
        Add partner
      </Button>
    </div>
  );
}

function PartnerRowEditor({
  p,
  onSaved,
}: {
  p: PartnerRow;
  onSaved: () => void;
}) {
  const [partner_name, setName] = React.useState(p.partner_name);
  const [countries_csv, setCc] = React.useState(
    partnerOperatingCountryCodes(p).join(", "),
  );
  const [source_manager_ids, setSm] = React.useState(
    p.source_manager_ids?.replace(/,/g, ", ") ?? "",
  );
  const [active_flag, setAct] = React.useState(
    p.active_flag === "true" || p.active_flag === "TRUE" ? "true" : "false",
  );
  const [owner_name, setOwner] = React.useState(p.owner_name);
  const [telegram_chat_id, setTg] = React.useState(p.telegram_chat_id);
  const [default_currency, setDef] = React.useState(p.default_currency);
  const [notes, setNotes] = React.useState(p.notes);

  const save = async () => {
    try {
      await adminSavePartnerAction({
        partner_id: p.partner_id,
        partner_name,
        countries_csv,
        source_manager_ids: source_manager_ids.replace(/\s*,\s*/g, ","),
        active_flag: active_flag as "true" | "false",
        owner_name,
        telegram_bot_token: p.telegram_bot_token,
        telegram_chat_id,
        notification_enabled:
          p.notification_enabled === "false" ? "false" : "true",
        default_currency,
        notes,
      });
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <tr className="align-top">
      <td className="border-b px-2 py-1 font-mono text-[10px]">{p.partner_id}</td>
      <td className="border-b px-2 py-1">
        <Input className="h-7 text-xs" value={partner_name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td className="border-b px-2 py-1">
        <Input className="h-7 min-w-[120px] text-xs" value={countries_csv} onChange={(e) => setCc(e.target.value)} />
      </td>
      <td className="border-b px-2 py-1">
        <Input className="h-7 text-xs" value={source_manager_ids} onChange={(e) => setSm(e.target.value)} />
      </td>
      <td className="border-b px-2 py-1">
        <select
          className="h-7 rounded border bg-white px-1 text-xs dark:bg-neutral-950"
          value={active_flag}
          onChange={(e) => setAct(e.target.value)}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </td>
      <td className="border-b px-2 py-1">
        <Button type="button" size="sm" className="h-7 text-[10px]" onClick={() => void save()}>
          Save
        </Button>
      </td>
    </tr>
  );
}
