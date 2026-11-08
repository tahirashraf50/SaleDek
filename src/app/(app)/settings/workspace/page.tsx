import { redirect } from "next/navigation";
import { Coins } from "lucide-react";
import { requireOrgSession } from "@/lib/session";
import { db } from "@/lib/db";
import { CurrencySettingsForm } from "@/components/settings/currency-settings-form";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage() {
  const session = await requireOrgSession();
  if (session.user.role !== "ORG_ADMIN") {
    redirect("/inbox");
  }

  const org = await db.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true, currency: true },
  });

  if (!org) redirect("/inbox");

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Coins className="h-5 w-5 text-[#ac16e0]" />
          Workspace
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Regional settings for {org.name}
        </p>
      </div>

      <section className="rounded-2xl border border-[#eee8f5] bg-white p-4 md:p-5">
        <h2 className="text-sm font-semibold text-slate-900">Currency</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Choose how money amounts appear across CRM, sales, and finance
        </p>
        <div className="mt-4">
          <CurrencySettingsForm initialCurrency={org.currency || "PKR"} />
        </div>
      </section>
    </div>
  );
}
