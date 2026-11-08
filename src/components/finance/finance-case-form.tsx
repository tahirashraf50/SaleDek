"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Banknote,
  Check,
  CircleDollarSign,
  MessageSquarePlus,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  financeAddNote,
  financeConfirmPayment,
  financeMarkInstallmentPaid,
  financeStartReview,
} from "@/server/actions/finance";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Payment = {
  id: string;
  amount: number;
  status: string;
  method: string;
  reference: string | null;
  notes: string | null;
  paidAt: string | null;
};

type Installment = {
  id: string;
  number: number;
  amount: number;
  status: string;
  dueDate: string;
  reference: string | null;
  paidAt: string | null;
};

const STEPS = [
  { id: 1, label: "Pending" },
  { id: 2, label: "In review" },
  { id: 3, label: "Cleared" },
] as const;

function isSettled(status: string) {
  return status === "PAID" || status === "CLEARED";
}

function isOverdue(dueDate: string, status: string) {
  if (isSettled(status)) return false;
  return new Date(dueDate).getTime() < Date.now();
}

export function FinanceCaseForm({
  orderId,
  financeStatus,
  orderTotal,
  payments,
  installments,
}: {
  orderId: string;
  financeStatus: string;
  orderTotal: number;
  payments: Payment[];
  installments: Installment[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const done = financeStatus === "CLEARED";
  const step = done ? 3 : financeStatus === "IN_REVIEW" ? 2 : 1;

  const paidPayments = payments
    .filter((p) => isSettled(p.status))
    .reduce((s, p) => s + p.amount, 0);
  const paidInstallments = installments
    .filter((i) => isSettled(i.status))
    .reduce((s, i) => s + i.amount, 0);
  const confirmed = Math.max(paidPayments, paidInstallments);
  const outstanding = Math.max(0, orderTotal - confirmed);
  const openInstallments = installments.filter((i) => !isSettled(i.status)).length;

  function refresh() {
    router.refresh();
  }

  function confirm(
    paymentId: string,
    status: "PAID" | "CLEARED" | "BOUNCED"
  ) {
    const reference =
      (
        document.getElementById(`ref-${paymentId}`) as HTMLInputElement | null
      )?.value || undefined;
    const notes =
      (
        document.getElementById(`notes-${paymentId}`) as HTMLTextAreaElement | null
      )?.value || undefined;
    start(async () => {
      try {
        await financeConfirmPayment(orderId, paymentId, {
          reference,
          notes,
          status,
        });
        toast.success(
          status === "BOUNCED" ? "Marked bounced" : `Payment marked ${status}`
        );
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function payInstallment(id: string) {
    const reference =
      (
        document.getElementById(`inst-ref-${id}`) as HTMLInputElement | null
      )?.value || undefined;
    start(async () => {
      try {
        await financeMarkInstallmentPaid(orderId, id, reference);
        toast.success("Installment marked paid");
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function startReview() {
    start(async () => {
      try {
        await financeStartReview(orderId);
        toast.success("Moved to in review");
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function saveNote() {
    if (!note.trim()) return;
    start(async () => {
      try {
        await financeAddNote(orderId, note);
        setNote("");
        toast.success("Note added");
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, idx) => {
          const active = step >= s.id;
          const current = step === s.id;
          return (
            <div key={s.id} className="flex flex-1 items-center gap-1.5">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  active
                    ? "bg-[#ac16e0] text-white"
                    : "bg-slate-100 text-slate-400"
                )}
              >
                {active && step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
              </div>
              <span
                className={cn(
                  "hidden text-[11px] font-semibold sm:inline",
                  current ? "text-slate-900" : "text-slate-400"
                )}
              >
                {s.label}
              </span>
              {idx < STEPS.length - 1 ? (
                <div
                  className={cn(
                    "mx-1 h-0.5 flex-1 rounded-full",
                    step > s.id ? "bg-[#ac16e0]" : "bg-slate-100"
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Order total
          </p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">
            {formatCurrency(orderTotal)}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/70">
            Confirmed
          </p>
          <p className="mt-0.5 text-sm font-bold text-emerald-800">
            {formatCurrency(confirmed)}
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/70">
            Outstanding
          </p>
          <p className="mt-0.5 text-sm font-bold text-amber-900">
            {formatCurrency(outstanding)}
          </p>
        </div>
      </div>

      {!done && financeStatus === "PENDING" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2.5">
          <p className="text-xs text-sky-900">
            Claim this case and move it into review before confirming funds.
          </p>
          <Button
            size="sm"
            className="h-8 bg-sky-700 text-xs text-white hover:bg-sky-800"
            disabled={pending}
            onClick={startReview}
          >
            Start review
          </Button>
        </div>
      ) : null}

      {done ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-900">
          <BadgeCheck className="h-4 w-4" />
          Finance cleared — payments settled
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Banknote className="h-3.5 w-3.5 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Payments</h3>
          <span className="text-[11px] text-slate-400">{payments.length}</span>
        </div>
        <div className="space-y-2">
          {payments.map((p) => {
            const settled = isSettled(p.status);
            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-xl border p-3",
                  settled
                    ? "border-emerald-100 bg-emerald-50/40"
                    : p.status === "BOUNCED"
                      ? "border-rose-100 bg-rose-50/50"
                      : "border-slate-100 bg-slate-50/80"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(p.amount)}
                      <span className="ml-1.5 text-[11px] font-medium text-slate-500">
                        {p.method}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Status{" "}
                      <span className="font-semibold text-slate-700">
                        {p.status}
                      </span>
                      {p.reference ? ` · Ref ${p.reference}` : ""}
                      {p.paidAt ? ` · ${formatDate(p.paidAt)}` : ""}
                    </p>
                    {p.notes ? (
                      <p className="mt-1 text-[11px] text-slate-600">{p.notes}</p>
                    ) : null}
                  </div>
                  {settled ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      <Check className="h-3 w-3" />
                      {p.status}
                    </span>
                  ) : null}
                </div>

                {!done && !settled ? (
                  <div className="mt-2.5 space-y-2 border-t border-slate-100/80 pt-2.5">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        id={`ref-${p.id}`}
                        placeholder="Bank / txn reference"
                        className="h-8 bg-white text-xs"
                        defaultValue={p.reference || ""}
                        disabled={pending}
                      />
                      <Textarea
                        id={`notes-${p.id}`}
                        placeholder="Optional notes"
                        rows={1}
                        className="min-h-8 resize-none bg-white py-1.5 text-xs"
                        defaultValue={p.notes || ""}
                        disabled={pending}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        className="h-8 bg-[#ac16e0] text-xs text-white hover:bg-[#8b10b8]"
                        disabled={pending}
                        onClick={() => confirm(p.id, "PAID")}
                      >
                        Confirm paid
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-emerald-200 bg-white text-xs text-emerald-800 hover:bg-emerald-50"
                        disabled={pending}
                        onClick={() => confirm(p.id, "CLEARED")}
                      >
                        Mark cleared
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-rose-200 bg-white text-xs text-rose-700 hover:bg-rose-50"
                        disabled={pending}
                        onClick={() => confirm(p.id, "BOUNCED")}
                      >
                        Bounced
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {payments.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
              No payment rows on this order yet.
            </p>
          )}
        </div>
      </div>

      {installments.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Receipt className="h-3.5 w-3.5 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Installments</h3>
            <span className="text-[11px] text-slate-400">
              {openInstallments} open / {installments.length}
            </span>
          </div>
          <div className="space-y-2">
            {installments.map((i) => {
              const settled = isSettled(i.status);
              const overdue = isOverdue(i.dueDate, i.status);
              return (
                <div
                  key={i.id}
                  className={cn(
                    "rounded-xl border px-3 py-2.5",
                    settled
                      ? "border-emerald-100 bg-emerald-50/40"
                      : overdue
                        ? "border-rose-100 bg-rose-50/40"
                        : "border-slate-100 bg-white"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        #{i.number} · {formatCurrency(i.amount)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Due {formatDate(i.dueDate)}
                        {overdue ? (
                          <span className="ml-1 font-semibold text-rose-700">
                            · Overdue
                          </span>
                        ) : null}
                        {i.reference ? ` · Ref ${i.reference}` : ""}
                        {i.paidAt ? ` · Paid ${formatDate(i.paidAt)}` : ""}
                      </p>
                    </div>
                    {settled ? (
                      <span className="text-xs font-semibold text-emerald-700">
                        Paid
                      </span>
                    ) : !done ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Input
                          id={`inst-ref-${i.id}`}
                          placeholder="Reference"
                          className="h-8 w-28 bg-white text-xs"
                          defaultValue={i.reference || ""}
                          disabled={pending}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={pending}
                          onClick={() => payInstallment(i.id)}
                        >
                          Mark paid
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-100 bg-white p-3">
        <div className="mb-2 flex items-center gap-2">
          <MessageSquarePlus className="h-3.5 w-3.5 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Add note</h3>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Internal finance note (visible on activity)…"
          className="resize-none text-xs"
          disabled={pending}
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={pending || !note.trim()}
            onClick={saveNote}
          >
            Save note
          </Button>
        </div>
      </div>

      {!done && outstanding > 0 && payments.length === 0 && openInstallments === 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-900">
          <CircleDollarSign className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No payment or installment rows to clear. Check the original sale, or add
          a note for follow-up.
        </div>
      ) : null}
    </div>
  );
}
