"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import {
  deleteCustomerAttachment,
  uploadCustomerAttachment,
} from "@/server/actions/attachments";

export type CustomerDoc = {
  id: string;
  label: string | null;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string | Date;
};

const DOC_TYPES = [
  "CNIC",
  "NTN / Tax",
  "Agreement",
  "Utility bill",
  "Bank statement",
  "Photo",
  "Other",
];

function sizeLabel(size: number | null) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function CustomerDocuments({
  customerId,
  documents,
  onChanged,
  compact = false,
}: {
  customerId: string;
  documents: CustomerDoc[];
  onChanged?: () => void | Promise<void>;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("CNIC");
  const [customLabel, setCustomLabel] = useState("");
  const [pending, start] = useTransition();
  const [docs, setDocs] = useState(documents);

  useEffect(() => {
    setDocs(documents);
  }, [documents]);

  function resolvedLabel() {
    if (label === "Other") return customLabel.trim() || "Other";
    return label;
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("label", resolvedLabel());
    start(async () => {
      try {
        const created = await uploadCustomerAttachment(customerId, fd);
        setDocs((prev) => [created, ...prev]);
        toast.success("Document uploaded");
        e.target.value = "";
        await onChanged?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  function onDelete(id: string) {
    start(async () => {
      try {
        await deleteCustomerAttachment(id);
        setDocs((prev) => prev.filter((d) => d.id !== id));
        toast.success("Document removed");
        await onChanged?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <div className={compact ? "" : "rounded-xl border border-slate-200 bg-white p-4"}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h4
          className={
            compact
              ? "text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"
              : "text-sm font-semibold text-slate-900"
          }
        >
          Documents
        </h4>
        <span className="text-[10px] text-slate-400">{docs.length} file(s)</span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Select
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-8 w-auto min-w-[7.5rem] text-xs"
        >
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        {label === "Other" && (
          <Input
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Label"
            className="h-8 w-28 text-xs"
          />
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"
          onChange={onPick}
          disabled={pending}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          className="h-8"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          {pending ? "…" : "Add"}
        </Button>
      </div>

      {docs.length === 0 ? (
        <p className="rounded-md bg-slate-50 px-2.5 py-2 text-xs text-slate-400">
          No reference documents yet (CNIC, agreement, etc.)
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg ring-1 ring-slate-200">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-2 border-t border-slate-100 px-2.5 py-1.5 first:border-0"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-[#8b10b8]" />
              <div className="min-w-0 flex-1">
                <a
                  href={`/api/attachments/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs font-medium text-[#8b10b8] hover:underline"
                >
                  {d.label ? `${d.label} · ` : ""}
                  {d.fileName}
                </a>
                <p className="text-[10px] text-slate-400">
                  {[sizeLabel(d.size), formatDate(d.createdAt)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                type="button"
                title="Remove"
                disabled={pending}
                onClick={() => onDelete(d.id)}
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
