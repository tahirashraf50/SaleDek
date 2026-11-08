import Link from "next/link";
import {
  FormInput,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { createCustomField } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Props = {
  searchParams: Promise<{ q?: string; entity?: string }>;
};

async function createFieldAction(formData: FormData) {
  "use server";
  await createCustomField({
    entity: String(formData.get("entity")),
    name: String(formData.get("name")),
    key: String(formData.get("key")),
    fieldType: String(formData.get("fieldType")),
    required: formData.get("required") === "on",
  });
}

const ENTITIES = ["customer", "ticket", "deal", "order"] as const;

const ENTITY_STYLE: Record<string, string> = {
  customer: "bg-sky-50 text-sky-700 ring-sky-100",
  ticket: "bg-amber-50 text-amber-700 ring-amber-100",
  deal: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  order: "bg-violet-50 text-violet-700 ring-violet-100",
};

export default async function SettingsCustomFieldsPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const params = await searchParams;
  const query = params.q?.trim();
  const entityFilter = ENTITIES.includes(params.entity as (typeof ENTITIES)[number])
    ? (params.entity as string)
    : undefined;

  const baseWhere = { organizationId: session.organizationId };

  const [fields, totalAll, byEntity] = await Promise.all([
    db.customField.findMany({
      where: {
        ...baseWhere,
        ...(entityFilter ? { entity: entityFilter } : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query } },
                { key: { contains: query } },
              ],
            }
          : {}),
      },
      orderBy: [{ entity: "asc" }, { name: "asc" }],
    }),
    db.customField.count({ where: baseWhere }),
    db.customField.groupBy({
      by: ["entity"],
      where: baseWhere,
      _count: true,
    }),
  ]);

  const entityCounts = Object.fromEntries(
    byEntity.map((r) => [r.entity, r._count])
  ) as Record<string, number>;
  const requiredCount = fields.filter((f) => f.required).length;

  function href(next: { q?: string; entity?: string }) {
    const qs = new URLSearchParams();
    const q = next.q !== undefined ? next.q : query;
    const entity = next.entity !== undefined ? next.entity : params.entity;
    if (q) qs.set("q", q);
    if (entity) qs.set("entity", entity);
    const s = qs.toString();
    return s ? `/settings/custom-fields?${s}` : "/settings/custom-fields";
  }

  const chips = [
    { id: "", label: "All", count: totalAll },
    ...ENTITIES.map((e) => ({
      id: e,
      label: e.charAt(0).toUpperCase() + e.slice(1),
      count: entityCounts[e] || 0,
    })),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Custom fields
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Extra data on customers, tickets, deals & orders · {fields.length}
            {query || entityFilter ? " matching" : " shown"}
            {totalAll !== fields.length ? ` of ${totalAll}` : ""}
          </p>
        </div>
        <form
          action="/settings/custom-fields"
          method="get"
          className="flex gap-2"
        >
          {entityFilter ? (
            <input type="hidden" name="entity" value={entityFilter} />
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              placeholder="Search fields…"
              defaultValue={query || ""}
              className="h-10 w-64 border-slate-200 bg-white pl-9 shadow-sm sm:w-72"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10 bg-white">
            Search
          </Button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Fields</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalAll}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                Across {byEntity.length} entities
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Required</p>
          <p className="mt-1 text-2xl font-bold text-rose-600">{requiredCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">In current list</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">On customers</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">
            {entityCounts.customer || 0}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Profile extensions</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">On tickets</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {entityCounts.ticket || 0}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Case metadata</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((f) => {
          const active = (entityFilter || "") === f.id;
          return (
            <Link
              key={f.id || "all"}
              href={href({ entity: active && f.id ? "" : f.id })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {f.count}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-indigo-600" />
              <h2 className="text-base font-semibold text-slate-900">
                Defined fields
              </h2>
            </div>
            <p className="text-xs text-slate-400">Schema extensions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Field</th>
                  <th className="px-3 py-3 font-semibold">Entity</th>
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Required</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-slate-50 transition hover:bg-slate-50/90"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                          <FormInput className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {f.name}
                          </p>
                          <p className="font-mono text-[11px] text-slate-400">
                            {f.key}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize ring-1",
                          ENTITY_STYLE[f.entity] ||
                            "bg-slate-50 text-slate-600 ring-slate-100"
                        )}
                      >
                        {f.entity}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                        {f.fieldType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {f.required ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          Required
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          Optional
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {fields.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <SlidersHorizontal className="h-6 w-6" />
                        </div>
                        <p className="font-semibold text-slate-800">
                          No custom fields
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Create one on the right to extend your forms.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="h-fit overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:sticky xl:top-4">
          <div className="border-b border-slate-100 bg-gradient-to-br from-indigo-50/80 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-600/25">
                <Plus className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  New field
                </h2>
                <p className="text-[11px] text-slate-500">
                  Attach to an entity type
                </p>
              </div>
            </div>
          </div>
          <form action={createFieldAction} className="space-y-3.5 p-5">
            <div>
              <Label htmlFor="entity">Entity</Label>
              <Select
                id="entity"
                name="entity"
                defaultValue="customer"
                className="mt-1"
              >
                {ENTITIES.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="name">Label</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Policy number"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                name="key"
                required
                placeholder="policy_number"
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label htmlFor="fieldType">Type</Label>
              <Select
                id="fieldType"
                name="fieldType"
                defaultValue="text"
                className="mt-1"
              >
                <option value="text">text</option>
                <option value="number">number</option>
                <option value="select">select</option>
                <option value="date">date</option>
                <option value="boolean">boolean</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="required" className="rounded" />
              Required on forms
            </label>
            <Button
              type="submit"
              className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Create field
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
