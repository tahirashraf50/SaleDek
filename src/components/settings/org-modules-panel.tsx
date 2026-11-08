"use client";

import { useRef, useState, useTransition } from "react";
import { Blocks } from "lucide-react";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { upsertOrganizationModule } from "@/server/actions/settings";
import { MODULE_DEFS, type ModuleKey } from "@/lib/module-defs";
import { cn } from "@/lib/utils";

export type OrgModuleRow = {
  key: ModuleKey;
  enabled: boolean;
  departmentId: string | null;
};

type Props = {
  modules: OrgModuleRow[];
  departments: { id: string; name: string; active: boolean }[];
};

export function OrgModulesPanel({ modules, departments }: Props) {
  const [pending, start] = useTransition();
  const saving = useRef(false);

  // Snapshot once — avoid syncing from server props (that caused refresh loops)
  const [local, setLocal] = useState(() => {
    const init: Record<
      string,
      { enabled: boolean; departmentId: string }
    > = {};
    for (const def of MODULE_DEFS) {
      const row = modules.find((m) => m.key === def.key);
      init[def.key] = {
        enabled: row?.enabled ?? false,
        departmentId: row?.departmentId ?? "",
      };
    }
    return init;
  });

  function persist(
    key: ModuleKey,
    enabled: boolean,
    departmentId: string
  ) {
    if (saving.current) return;
    saving.current = true;
    start(async () => {
      try {
        await upsertOrganizationModule({
          key,
          enabled,
          departmentId: departmentId || null,
        });
        toast.success(
          `${MODULE_DEFS.find((d) => d.key === key)?.label} updated`
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
      } finally {
        saving.current = false;
      }
    });
  }

  function toggleEnabled(key: ModuleKey) {
    const cur = local[key];
    if (!cur) return;
    const enabled = !cur.enabled;
    setLocal((prev) => ({ ...prev, [key]: { ...cur, enabled } }));
    persist(key, enabled, cur.departmentId);
  }

  function changeDepartment(key: ModuleKey, departmentId: string) {
    const cur = local[key];
    if (!cur || cur.departmentId === departmentId) return;
    setLocal((prev) => ({ ...prev, [key]: { ...cur, departmentId } }));
    persist(key, cur.enabled, departmentId);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-br from-violet-50/80 to-transparent px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
          <Blocks className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Modules</h2>
          <p className="text-[11px] text-slate-500">
            Enable a module and assign which department can access it
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {MODULE_DEFS.map((def) => {
          const cur = local[def.key] || { enabled: false, departmentId: "" };
          const options = departments.filter(
            (d) => d.active || d.id === cur.departmentId
          );

          return (
            <div
              key={def.key}
              className="flex flex-wrap items-center gap-3 px-5 py-3.5"
            >
              <div className="min-w-[160px] flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {def.label}
                </p>
                <p className="text-[11px] text-slate-500">{def.description}</p>
                {cur.enabled && !cur.departmentId ? (
                  <p className="mt-1 text-[10px] font-medium text-amber-700">
                    Enabled — assign a department (admins can still open it)
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                disabled={pending}
                onClick={() => toggleEnabled(def.key)}
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition",
                  cur.enabled ? "bg-[#ac16e0]" : "bg-slate-200"
                )}
                aria-label={`Toggle ${def.label}`}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition",
                    cur.enabled ? "left-[22px]" : "left-0.5"
                  )}
                />
              </button>

              <Select
                value={cur.departmentId}
                disabled={pending}
                className="h-9 w-44 bg-white text-xs"
                onChange={(e) => changeDepartment(def.key, e.target.value)}
              >
                <option value="">Unassigned</option>
                {options.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {!d.active ? " (inactive)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
