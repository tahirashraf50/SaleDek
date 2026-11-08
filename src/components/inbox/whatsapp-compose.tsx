"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ImagePlus,
  Mic,
  Package,
  Send,
  Square,
  Zap,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import {
  sendMessage,
  sendWhatsAppMediaMessage,
  sendWhatsAppProduct,
} from "@/server/actions/inbox";

export type QuickReplyItem = {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
  channel: string | null;
};

export type CatalogProduct = {
  id: string;
  name: string;
  sku: string | null;
  unitPrice: number;
  imageUrl: string | null;
  whatsappProductId: string | null;
};

export function WhatsAppCompose({
  conversationId,
  quickReplies,
  products,
}: {
  conversationId: string;
  quickReplies: QuickReplyItem[];
  products: CatalogProduct[];
}) {
  const [reply, setReply] = useState("");
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<"none" | "quick" | "catalog">("none");
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    setReply("");
    setPanel("none");
    stopRecording(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  function applyShortcutExpand(value: string) {
    const match = value.match(/(^|\s)(\/[a-zA-Z0-9_-]+)$/);
    if (!match) return value;
    const shortcut = match[2].toLowerCase();
    const qr = quickReplies.find(
      (r) => r.shortcut?.toLowerCase() === shortcut
    );
    if (!qr) return value;
    return value.replace(/(^|\s)(\/[a-zA-Z0-9_-]+)$/, `$1${qr.body}`);
  }

  function onSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = applyShortcutExpand(reply).trim();
    if (!text) return;
    start(async () => {
      try {
        await sendMessage(conversationId, text);
        setReply("");
        setPanel("none");
        toast.success("Message sent");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function onPickImage(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", "image");
    if (reply.trim()) fd.set("caption", reply.trim());
    start(async () => {
      try {
        await sendWhatsAppMediaMessage(conversationId, fd);
        setReply("");
        toast.success("Photo sent");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setRecordSecs(0);
      timerRef.current = setInterval(() => {
        setRecordSecs(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Microphone permission required");
    }
  }

  function stopRecording(send: boolean) {
    const recorder = mediaRecorderRef.current;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!recorder || recorder.state === "inactive") {
      setRecording(false);
      return;
    }
    recorder.onstop = () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      if (!send) {
        chunksRef.current = [];
        setRecording(false);
        return;
      }
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      chunksRef.current = [];
      setRecording(false);
      if (blob.size < 500) {
        toast.error("Recording too short");
        return;
      }
      const durationMs = Date.now() - startedAtRef.current;
      const file = new File([blob], `voice-${Date.now()}.webm`, {
        type: blob.type || "audio/webm",
      });
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", "audio");
      fd.set("durationMs", String(durationMs));
      start(async () => {
        try {
          await sendWhatsAppMediaMessage(conversationId, fd);
          toast.success("Voice message sent");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed");
        }
      });
    };
    recorder.stop();
    mediaRecorderRef.current = null;
  }

  function sendProduct(productId: string) {
    start(async () => {
      try {
        await sendWhatsAppProduct(conversationId, productId);
        setPanel("none");
        toast.success("Product sent");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const waReplies = quickReplies.filter(
    (r) => !r.channel || r.channel === "WHATSAPP"
  );

  return (
    <div className="border-t border-emerald-900/10 bg-[#f0f2f5]">
      {panel === "quick" && (
        <div className="max-h-48 overflow-y-auto border-b border-emerald-100/80 bg-white px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#008069]">
              Quick replies
            </span>
            <button type="button" onClick={() => setPanel("none")}>
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
          {waReplies.length === 0 ? (
            <p className="text-xs text-slate-500">
              None yet — add in Settings → Quick replies
            </p>
          ) : (
            <div className="space-y-1">
              {waReplies.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setReply(r.body);
                    setPanel("none");
                  }}
                  className="flex w-full flex-col rounded-lg px-2 py-1.5 text-left hover:bg-white"
                >
                  <span className="text-xs font-semibold text-slate-800">
                    {r.title}
                    {r.shortcut ? (
                      <span className="ml-2 font-normal text-[#8b10b8]">
                        {r.shortcut}
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate text-[11px] text-slate-500">
                    {r.body}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {panel === "catalog" && (
        <div className="max-h-56 overflow-y-auto border-b border-emerald-100/80 bg-white px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#008069]">
              Product catalog
            </span>
            <button type="button" onClick={() => setPanel("none")}>
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
          {products.length === 0 ? (
            <p className="text-xs text-slate-500">
              No products — add under Sales → Products, then Sync catalog
            </p>
          ) : (
            <div className="grid gap-1.5">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={pending}
                  onClick={() => sendProduct(p.id)}
                  className="flex items-center gap-2 rounded-lg bg-[#f0f2f5] px-2 py-1.5 text-left ring-1 ring-transparent hover:ring-[#00a884]/40"
                >
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-9 w-9 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded bg-[#dcf8c6] text-[#075e54]">
                      <Package className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-900">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatCurrency(p.unitPrice)}
                      {p.whatsappProductId ? " · synced" : " · not synced"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {recording && (
        <div className="flex items-center justify-between gap-2 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            Recording… {recordSecs}s
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => stopRecording(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => stopRecording(true)}
            >
              <Square className="mr-1 h-3 w-3" /> Send voice
            </Button>
          </div>
        </div>
      )}

      <form
        onSubmit={onSend}
        className="flex items-end gap-1.5 px-2 py-2.5 sm:gap-2 sm:px-3"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onPickImage(e.target.files?.[0] || null);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          title="Quick reply"
          onClick={() => setPanel((p) => (p === "quick" ? "none" : "quick"))}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-white",
            panel === "quick" && "bg-[#dcf8c6] text-[#008069]"
          )}
        >
          <Zap className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Catalog / product"
          onClick={() =>
            setPanel((p) => (p === "catalog" ? "none" : "catalog"))
          }
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-white",
            panel === "catalog" && "bg-[#dcf8c6] text-[#008069]"
          )}
        >
          <Package className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Send photo"
          disabled={pending || recording}
          onClick={() => fileRef.current?.click()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-white disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" />
        </button>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onBlur={() => setReply((v) => applyShortcutExpand(v))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (reply.trim() && !pending) onSend();
            }
          }}
          placeholder="Type a message"
          rows={1}
          disabled={recording}
          className="max-h-28 min-h-[42px] flex-1 resize-none rounded-[24px] border-0 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none shadow-sm ring-1 ring-black/5 placeholder:text-slate-400 focus:ring-[#00a884]/35 disabled:opacity-60"
        />
        {reply.trim() ? (
          <Button
            type="submit"
            disabled={pending}
            className="h-[42px] w-[42px] shrink-0 rounded-full bg-[#00a884] p-0 text-white hover:bg-[#008f72]"
          >
            <Send className="h-4 w-4" />
          </Button>
        ) : (
          <button
            type="button"
            title={recording ? "Stop & send" : "Voice message"}
            disabled={pending}
            onClick={() =>
              recording ? stopRecording(true) : void startRecording()
            }
            className={cn(
              "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-white shadow-md",
              recording ? "bg-rose-600" : "bg-[#00a884] hover:bg-[#008f72]"
            )}
          >
            {recording ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        )}
      </form>
    </div>
  );
}
