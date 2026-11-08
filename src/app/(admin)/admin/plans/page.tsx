import Link from "next/link";
import {
  BadgeCheck,
  CreditCard,
  Gift,
  Sparkles,
  Timer,
  Users,
  Ticket,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import { cn, formatCurrency } from "@/lib/utils";
import { updateSaaSPlan } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

async function savePlanAction(formData: FormData) {
  "use server";
  const features = String(formData.get("features") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const trialRaw = String(formData.get("trialDays") || "").trim();
  const trialDays =
    trialRaw === "" ? null : Math.max(0, Number(trialRaw) || 0) || null;
  await updateSaaSPlan(String(formData.get("planId")), {
    name: String(formData.get("name") || ""),
    priceMonthly: Number(formData.get("priceMonthly") || 0),
    description: String(formData.get("description") || ""),
    maxUsers: Number(formData.get("maxUsers") || 5),
    maxTicketsPerMonth: Number(formData.get("maxTicketsPerMonth") || 500),
    trialDays,
    active: formData.get("active") === "on",
    features,
  });
}

const PLAN_THEME: Record<
  string,
  { accent: string; chip: string; icon: string; badge?: string }
> = {
  DEMO: {
    accent: "from-amber-50 via-white to-white",
    chip: "bg-amber-100 text-amber-900 ring-amber-200",
    icon: "bg-amber-500 text-white shadow-amber-500/25",
    badge: "15-day trial",
  },
  STARTER: {
    accent: "from-slate-50 via-white to-white",
    chip: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: "bg-slate-800 text-white shadow-slate-800/20",
  },
  PRO: {
    accent: "from-teal-50 via-white to-white",
    chip: "bg-teal-100 text-teal-900 ring-teal-200",
    icon: "bg-teal-700 text-white shadow-teal-700/25",
    badge: "Popular",
  },
  ENTERPRISE: {
    accent: "from-sky-50 via-white to-white",
    chip: "bg-sky-100 text-sky-900 ring-sky-200",
    icon: "bg-sky-800 text-white shadow-sky-800/20",
  },
};

export default async function AdminPlansPage() {
  await requireSuperAdmin();
  const plans = await db.saaSPlan.findMany({ orderBy: { sortOrder: "asc" } });
  const activeCount = plans.filter((p) => p.active).length;
  const trialPlans = plans.filter((p) => p.trialDays && p.trialDays > 0);
  const paid = plans.filter((p) => Number(p.priceMonthly) > 0 && p.active);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-900 px-5 py-6 text-white shadow-[0_12px_40px_-24px_rgba(15,23,42,0.65)] md:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200/80">
              Platform billing
            </p>
            <h1 className="mt-1 text-[28px] font-bold tracking-tight">
              SaaS plans
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-300">
              Package pricing for the public site and tenant onboarding —
              including a free Demo trial.
            </p>
          </div>
          <Link
            href="/site/pricing"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15"
          >
            View public pricing
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
            <p className="text-[11px] text-teal-100/70">Live on site</p>
            <p className="mt-0.5 text-2xl font-bold">{activeCount}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
            <p className="text-[11px] text-teal-100/70">Trial packages</p>
            <p className="mt-0.5 text-2xl font-bold">{trialPlans.length}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
            <p className="text-[11px] text-teal-100/70">Paid MRR range</p>
            <p className="mt-0.5 text-lg font-bold leading-8">
              {paid.length
                ? `${formatCurrency(Math.min(...paid.map((p) => Number(p.priceMonthly))))} – ${formatCurrency(Math.max(...paid.map((p) => Number(p.priceMonthly))))}`
                : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {plans.map((p) => {
          const features = Array.isArray(p.features)
            ? (p.features as string[])
            : [];
          const theme = PLAN_THEME[p.key] || PLAN_THEME.STARTER;
          const isDemo = p.key === "DEMO" || (p.trialDays && p.trialDays > 0);
          const price = Number(p.priceMonthly);

          return (
            <div
              key={p.id}
              className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
            >
              <div
                className={cn(
                  "border-b border-slate-100 bg-gradient-to-br px-5 py-4",
                  theme.accent
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl shadow-sm",
                        theme.icon
                      )}
                    >
                      {isDemo ? (
                        <Gift className="h-4 w-4" />
                      ) : p.key === "PRO" ? (
                        <Sparkles className="h-4 w-4" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-900">
                          {p.name}
                        </h2>
                        {theme.badge ? (
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                              theme.chip
                            )}
                          >
                            {theme.badge}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {p.key}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1",
                      p.active
                        ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                        : "bg-slate-50 text-slate-500 ring-slate-100"
                    )}
                  >
                    <BadgeCheck className="h-3 w-3" />
                    {p.active ? "Active" : "Hidden"}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <p className="text-3xl font-bold tracking-tight text-slate-900">
                    {price === 0 ? "Free" : formatCurrency(price)}
                    {price > 0 ? (
                      <span className="text-sm font-normal text-slate-500">
                        /mo
                      </span>
                    ) : null}
                  </p>
                  {p.trialDays ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-100">
                      <Timer className="h-3.5 w-3.5" />
                      {p.trialDays}-day access
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400">
                      Billed yearly on assign
                    </span>
                  )}
                </div>

                {features.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {features.slice(0, 4).map((f) => (
                      <span
                        key={f}
                        className="rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100"
                      >
                        {f}
                      </span>
                    ))}
                    {features.length > 4 ? (
                      <span className="rounded-md px-2 py-0.5 text-[10px] font-medium text-slate-400">
                        +{features.length - 4} more
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <form action={savePlanAction} className="space-y-3.5 p-5">
                <input type="hidden" name="planId" value={p.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Name</Label>
                    <Input name="name" defaultValue={p.name} className="mt-1" />
                  </div>
                  <div>
                    <Label>Price / month (PKR)</Label>
                    <Input
                      name="priceMonthly"
                      type="number"
                      min={0}
                      defaultValue={price}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    name="description"
                    defaultValue={p.description || ""}
                    className="mt-1"
                    placeholder="Short line for pricing cards"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3 text-slate-400" />
                      Max users
                    </Label>
                    <Input
                      name="maxUsers"
                      type="number"
                      defaultValue={p.maxUsers}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="inline-flex items-center gap-1">
                      <Ticket className="h-3 w-3 text-slate-400" />
                      Tickets / mo
                    </Label>
                    <Input
                      name="maxTicketsPerMonth"
                      type="number"
                      defaultValue={p.maxTicketsPerMonth}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="inline-flex items-center gap-1">
                      <Timer className="h-3 w-3 text-slate-400" />
                      Trial days
                    </Label>
                    <Input
                      name="trialDays"
                      type="number"
                      min={0}
                      placeholder="—"
                      defaultValue={p.trialDays ?? ""}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Features (one per line)</Label>
                  <Textarea
                    name="features"
                    rows={5}
                    defaultValue={features.join("\n")}
                    className="mt-1"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-50 pt-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={p.active}
                      className="h-4 w-4 rounded border-slate-300 text-teal-700"
                    />
                    Show on pricing page
                  </label>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-9 bg-teal-700 px-4 text-white hover:bg-teal-800"
                  >
                    Save {p.name}
                  </Button>
                </div>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
