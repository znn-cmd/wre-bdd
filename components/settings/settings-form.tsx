"use client";

import * as React from "react";
import { toast } from "sonner";
import { saveViewsPresetAction } from "@/server/actions/leads";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const defaultJson = `{
  "leadsTable": {
    "visibleColumns": ["lead_id", "client_name", "partner_name", "partner_status", "updated_at"]
  }
}`;

export function SettingsForm({
  userId,
  role,
}: {
  userId: string;
  role: string;
}) {
  const [json, setJson] = React.useState(defaultJson);

  const save = async () => {
    try {
      JSON.parse(json);
      await saveViewsPresetAction("ui.v1", json);
      toast.success("Saved to Views_Config");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="text-xs text-neutral-500">
        User <span className="font-mono">{userId}</span> · {role}
      </div>
      <div className="grid gap-1">
        <Label>Preset JSON</Label>
        <textarea
          className="min-h-[200px] rounded-md border border-neutral-200 bg-white p-2 font-mono text-xs dark:border-neutral-800 dark:bg-neutral-950"
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
      </div>
      <Button type="button" size="sm" onClick={() => void save()}>
        Save preset
      </Button>
    </div>
  );
}
