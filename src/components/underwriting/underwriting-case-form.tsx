"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileUp, Hash, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  assignPolicyNumber,
  uploadPolicyDocument,
  issueAndEmailPolicy,
} from "@/server/actions/underwriting";
import { cn } from "@/lib/utils";

type Props = {
  orderId: string;
  policyNumber: string | null;
  underwritingStatus: string;
  customerEmail: string | null;
  hasDocument: boolean;
  documentLabel?: string | null;
};

const STEPS = [
  { id: 1, label: "Policy #" },
  { id: 2, label: "Document" },
  { id: 3, label: "Email" },
] as const;

export function UnderwritingCaseForm({
  orderId,
  policyNumber,
  underwritingStatus,
  customerEmail,
  hasDocument,
  documentLabel,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [number, setNumber] = useState(policyNumber || "");
  const [allocated, setAllocated] = useState(Boolean(policyNumber));
  const [attached, setAttached] = useState(hasDocument);
  const [docLabel, setDocLabel] = useState(documentLabel || "");
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    setNumber(policyNumber || "");
    setAllocated(Boolean(policyNumber));
  }, [policyNumber]);

  useEffect(() => {
    setAttached(hasDocument);
    setDocLabel(documentLabel || "");
  }, [hasDocument, documentLabel]);

  const done = underwritingStatus === "SENT";
  const step = done ? 3 : attached ? 3 : allocated ? 2 : 1;
  const canAttach = allocated && !done;
  const canEmail = allocated && attached && !done && Boolean(customerEmail);

  function refresh() {
    router.refresh();
  }

  function saveNumber() {
    start(async () => {
      try {
        const res = await assignPolicyNumber(orderId, number);
        setNumber(res.policyNumber);
        setAllocated(true);
        toast.success("Policy number allocated");
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function runUpload(file: File) {
    if (!canAttach) {
      toast.error("Allocate a policy number first");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      try {
        const res = await uploadPolicyDocument(orderId, fd);
        setAttached(true);
        setDocLabel(res.label);
        setFileName(file.name);
        toast.success("Policy document attached");
        if (fileRef.current) fileRef.current.value = "";
        refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        toast.error(
          /body|large|size|limit/i.test(msg)
            ? "File too large for upload (max 15MB)"
            : msg
        );
      }
    });
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    runUpload(file);
  }

  function sendEmail() {
    start(async () => {
      try {
        const res = await issueAndEmailPolicy(orderId);
        toast.success(
          `Policy emailed to ${res.email} (${res.mode === "LIVE" ? "sent" : "mock / CRM logged"})`
        );
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {STEPS.map((s) => {
          const complete = step > s.id || (s.id === 3 && done);
          const active = step === s.id && !done;
          return (
            <span
              key={s.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                complete
                  ? "bg-emerald-600 text-white"
                  : active
                    ? "bg-amber-600 text-white"
                    : "border border-slate-200 bg-white text-slate-500"
              )}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">
                {complete ? <Check className="h-2.5 w-2.5" /> : s.id}
              </span>
              {s.label}
            </span>
          );
        })}
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <Hash className="h-3.5 w-3.5 text-amber-600" />
            Policy number
          </div>
          <div className="mt-2 flex gap-1.5">
            <Input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="POL-2026-000123"
              className="h-8 font-mono text-xs"
              disabled={pending || done}
            />
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 bg-amber-600 px-2.5 text-xs text-white hover:bg-amber-700"
              disabled={pending || done || !number.trim()}
              onClick={saveNumber}
            >
              Save
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <FileUp className="h-3.5 w-3.5 text-amber-600" />
            Policy document
          </div>
          {docLabel || attached ? (
            <p className="mt-1.5 truncate text-[11px] font-medium text-emerald-700">
              {docLabel || fileName || "Attached"}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-slate-500">
              PDF / image · max 15MB
            </p>
          )}
          <div className="mt-2 flex gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,application/pdf"
              className="block w-full min-w-0 truncate text-[11px] text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-white file:px-2 file:py-1.5 file:text-[11px] file:font-semibold file:text-slate-700 file:ring-1 file:ring-slate-200 disabled:opacity-50"
              disabled={pending || !canAttach}
              onChange={onFileChange}
            />
          </div>
          {!allocated ? (
            <p className="mt-1.5 text-[10px] text-amber-700">
              Save policy # first
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <Mail className="h-3.5 w-3.5 text-amber-600" />
            Email customer
          </div>
          <p className="mt-1.5 truncate text-[11px] text-slate-500">
            {customerEmail || "No email on customer"}
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-2 h-8 gap-1.5 bg-[#ef1e1e] px-2.5 text-xs text-white hover:bg-[#d41919]"
            disabled={pending || !canEmail}
            onClick={sendEmail}
          >
            <Send className="h-3 w-3" />
            {done ? "Already sent" : "Issue & email"}
          </Button>
          {done ? (
            <p className="mt-1.5 text-[10px] font-medium text-emerald-700">
              Case complete
            </p>
          ) : !customerEmail ? (
            <p className="mt-1.5 text-[10px] text-rose-600">
              Add email on customer profile
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
