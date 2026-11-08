import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { createDeal } from "@/server/actions/sales";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DealBoard } from "@/components/sales/deal-board";

async function createDealAction(formData: FormData) {
  "use server";
  await createDeal({
    title: String(formData.get("title")),
    customerId: String(formData.get("customerId")),
    value: Number(formData.get("value") || 0),
    closeDate: String(formData.get("closeDate") || "") || undefined,
    stageKey: String(formData.get("stageKey") || "LEAD") || undefined,
  });
}

export default async function DealsPage() {
  const session = await requireOrgSession();

  const [stages, customers, deals] = await Promise.all([
    db.dealStage.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { position: "asc" },
    }),
    db.customer.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true },
    }),
    db.deal.findMany({
      where: { organizationId: session.organizationId },
      include: {
        stage: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const serialized = deals.map((d) => ({
    id: d.id,
    number: d.number,
    title: d.title,
    value: Number(d.value),
    stageId: d.stageId,
    closeDate: d.closeDate?.toISOString() || null,
    customer: d.customer,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Deals</h1>
        <p className="text-sm text-slate-500">Drag cards across stages</p>
      </div>

      <DealBoard stages={stages} deals={serialized} />

      <Card>
        <CardHeader>
          <CardTitle>New deal</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createDealAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label>Title</Label>
              <Input name="title" required />
            </div>
            <div>
              <Label>Customer</Label>
              <Select name="customerId" required defaultValue="">
                <option value="" disabled>
                  Select…
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input name="value" type="number" defaultValue={0} />
            </div>
            <div>
              <Label>Stage</Label>
              <Select name="stageKey" defaultValue="LEAD">
                {stages.map((s) => (
                  <option key={s.id} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Close date</Label>
              <Input name="closeDate" type="date" />
            </div>
            <div className="flex items-end">
              <Button type="submit">Create deal</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
