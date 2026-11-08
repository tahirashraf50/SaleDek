"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  CheckCircle2,
  FilePlus2,
  Mail,
  MessageSquareMore,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  createRenewalInvoice,
  markPlatformInvoicePaid,
  sendPlatformInvoiceEmail,
  sendPlatformInvoiceFollowUp,
  sendPlatformInvoiceReminder,
  updateInvoiceBillingEmail,
  updateSubscriptionPeriod,
} from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Invoice = {
  id: string;
  number: string;
  year: number;
  amount: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  dueAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  billingEmail: string | null;
  notes: string | null;
  events: {
    id: string;
    type: string;
    toEmail: string | null;
    subject: string | null;
    mode: string | null;
    createdAt: string;
  }[];
};

const INV_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-50 text-slate-700 ring-slate-100",
  SENT: "bg-sky-50 text-sky-800 ring-sky-100",
  PAID: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  OVERDUE: "bg-rose-50 text-rose-800 ring-rose-100",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-200",
};

function toDateInput(iso: string | null | undefined) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function OrgBillingPanel({
  orgId,
  startedAt,
  endsAt,
  invoices,
  defaultBillingEmail,
  nextYear,
}: {
  orgId: string;
  startedAt: string | null;
  endsAt: string | null;
  invoices: Invoice[];
  defaultBillingEmail: string | null;
  nextYear: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [startDate, setStartDate] = useState(toDateInput(startedAt));
  const [endDate, setEndDate] = useState(toDateInput(endsAt));
  const [followNote, setFollowNote] = useState("");
  const [emails, setEmails] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const inv of invoices) {
      init[inv.id] = inv.billingEmail || defaultBillingEmail || "";
    }
    return init;
  });

  function refresh() {
    router.refresh();
  }

  function savePeriod() {
    start(async () => {
      try {
        await updateSubscriptionPeriod(orgId, {
          startedAt: startDate,
          endsAt: endDate,
        });
        toast.success("Plan period updated");
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function createInvoice() {
    start(async () => {
      try {
        const res = await createRenewalInvoice(orgId, {
          year: nextYear,
          billingEmail: defaultBillingEmail || undefined,
        });
        toast.success(`Draft ${res.number} created`);
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function run(
    label: string,
    fn: () => Promise<{ mode?: string } | void>
  ) {
    start(async () => {
      try {
        const res = await fn();
        toast.success(
          res && "mode" in res && res.mode
            ? `${label} (${res.mode})`
            : label
        );
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Plan period
          </h2>
          <p className="text-[11px] text-slate-500">
            Start and expiry for the current subscription cycle
          </p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label htmlFor="plan-start">Starts</Label>
            <Input
              id="plan-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <Label htmlFor="plan-end">Expires</Label>
            <Input
              id="plan-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              className="h-9 w-full bg-teal-700 text-white hover:bg-teal-800 sm:w-auto"
              disabled={pending || !startDate || !endDate}
              onClick={savePeriod}
            >
              Save dates
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Renewal invoices
            </h2>
            <p className="text-[11px] text-slate-500">
              Manual next-year invoice · email · reminders · follow-ups
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
            disabled={pending}
            onClick={createInvoice}
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Invoice {nextYear}
          </Button>
        </div>

        <div className="divide-y divide-slate-50">
          {invoices.map((inv) => {
            const unpaid = inv.status !== "PAID" && inv.status !== "CANCELLED";
            return (
              <div key={inv.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {inv.number}
                      </p>
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                          INV_STYLE[inv.status] || INV_STYLE.DRAFT
                        )}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatCurrency(inv.amount)} ·{" "}
                      {formatDate(inv.periodStart)} –{" "}
                      {formatDate(inv.periodEnd)}
                      {inv.paidAt ? ` · Paid ${formatDate(inv.paidAt)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <div>
                    <Label className="text-[11px]">Billing email</Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        value={emails[inv.id] || ""}
                        onChange={(e) =>
                          setEmails((prev) => ({
                            ...prev,
                            [inv.id]: e.target.value,
                          }))
                        }
                        placeholder="billing@company.com"
                        className="h-9 text-xs"
                        disabled={pending}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 shrink-0 text-xs"
                        disabled={pending}
                        onClick={() =>
                          run("Billing email saved", async () => {
                            await updateInvoiceBillingEmail(
                              inv.id,
                              emails[inv.id] || ""
                            );
                          })
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>

                {unpaid ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1 bg-teal-700 text-[11px] text-white hover:bg-teal-800"
                      disabled={pending}
                      onClick={() =>
                        run("Invoice emailed", () =>
                          sendPlatformInvoiceEmail(inv.id)
                        )
                      }
                    >
                      <Send className="h-3 w-3" />
                      Send invoice
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-[11px]"
                      disabled={pending}
                      onClick={() =>
                        run("Reminder sent", () =>
                          sendPlatformInvoiceReminder(
                            inv.id,
                            followNote || undefined
                          )
                        )
                      }
                    >
                      <BellRing className="h-3 w-3" />
                      Reminder
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-[11px]"
                      disabled={pending}
                      onClick={() =>
                        run("Follow-up sent", () =>
                          sendPlatformInvoiceFollowUp(
                            inv.id,
                            followNote || undefined
                          )
                        )
                      }
                    >
                      <MessageSquareMore className="h-3 w-3" />
                      Follow-up
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 border-emerald-200 text-[11px] text-emerald-800 hover:bg-emerald-50"
                      disabled={pending}
                      onClick={() =>
                        run("Marked paid", async () => {
                          await markPlatformInvoicePaid(inv.id);
                        })
                      }
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Mark paid
                    </Button>
                  </div>
                ) : null}

                {inv.events.length > 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Email / follow-up log
                    </p>
                    <ul className="space-y-1">
                      {inv.events.slice(0, 6).map((e) => (
                        <li
                          key={e.id}
                          className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600"
                        >
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span className="font-semibold text-slate-800">
                            {e.type.replace(/_/g, " ")}
                          </span>
                          {e.mode ? (
                            <span className="text-slate-400">· {e.mode}</span>
                          ) : null}
                          {e.toEmail ? (
                            <span className="text-slate-400">· {e.toEmail}</span>
                          ) : null}
                          <span className="text-slate-400">
                            · {formatDate(e.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}

          {invoices.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No invoices yet. Create a {nextYear} renewal draft to start the
              email reminder flow.
            </div>
          ) : null}
        </div>

        {invoices.some(
          (i) => i.status !== "PAID" && i.status !== "CANCELLED"
        ) ? (
          <div className="border-t border-slate-100 px-5 py-3">
            <Label className="text-[11px]">
              Optional note for reminder / follow-up
            </Label>
            <Textarea
              value={followNote}
              onChange={(e) => setFollowNote(e.target.value)}
              rows={2}
              className="mt-1 resize-none text-xs"
              placeholder="e.g. Please confirm payment by Friday…"
              disabled={pending}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
