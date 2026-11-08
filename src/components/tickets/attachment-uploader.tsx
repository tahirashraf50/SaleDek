"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadTicketAttachment } from "@/server/actions/attachments";
import { formatDate } from "@/lib/utils";

type Attachment = {
  id: string;
  fileName: string;
  size: number | null;
  createdAt: string | Date;
};

export function AttachmentUploader({
  ticketId,
  attachments,
  embedded,
}: {
  ticketId: string;
  attachments: Attachment[];
  embedded?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      try {
        await uploadTicketAttachment(ticketId, fd);
        toast.success("Uploaded");
        e.target.value = "";
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  return (
    <div className={embedded ? "p-2" : "rounded-xl border border-slate-200 bg-white p-4"}>
      {!embedded ? (
        <h3 className="mb-3 text-sm font-semibold">Attachments</h3>
      ) : null}
      <ul className="mb-3 space-y-2 text-sm">
        {attachments.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2">
            <a
              href={`/api/attachments/${a.id}`}
              target="_blank"
              rel="noreferrer"
              className="truncate text-[#8b10b8] hover:underline"
            >
              {a.fileName}
            </a>
            <span className="shrink-0 text-xs text-slate-400">
              {a.size ? `${Math.round(a.size / 1024)} KB` : ""} ·{" "}
              {formatDate(a.createdAt)}
            </span>
          </li>
        ))}
        {attachments.length === 0 && (
          <li className="text-xs text-slate-400">No files yet</li>
        )}
      </ul>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onChange}
        disabled={pending}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? "Uploading…" : "Upload file"}
      </Button>
    </div>
  );
}
