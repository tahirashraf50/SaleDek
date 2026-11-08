"use client";

import { useMemo, useState, useTransition, useEffect, useRef } from "react";
import {
  Mail,
  MessageCircle,
  Phone,
  Globe,
  Send,
  TicketPlus,
  ShoppingBag,
  PhoneIncoming,
  Search,
  CheckCheck,
  UserRound,
  Forward,
  Package,
} from "lucide-react";
import {
  WhatsAppCompose,
  type CatalogProduct,
  type QuickReplyItem,
} from "@/components/inbox/whatsapp-compose";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  openComplaintModal,
  openSaleModal,
} from "@/components/layout/app-shell";
import {
  sendMessage,
  logIncomingCall,
  markConversationRead,
  ensureCustomerFromConversation,
} from "@/server/actions/inbox";
import {
  getCustomerProfile,
  type CustomerProfileData,
} from "@/server/actions/customers";
import { CustomerProfileModal } from "@/components/inbox/customer-profile-modal";
import { ForwardDepartmentModal } from "@/components/inbox/forward-department-modal";
import { toast } from "sonner";
import { OmniChannel, TicketChannel } from "@prisma/client";

type Message = {
  id: string;
  direction: "IN" | "OUT";
  body: string;
  subject: string | null;
  sentAt: string | Date;
  meta?: Record<string, unknown> | null;
};

type Conversation = {
  id: string;
  channel: OmniChannel;
  subject: string | null;
  externalRef: string | null;
  status: string;
  unreadCount: number;
  lastMessageAt: string | Date;
  customer: { id: string; name: string; phone: string | null; email: string | null } | null;
  connector?: {
    id: string;
    name: string;
    channel: OmniChannel;
    assigneeId: string | null;
    assignee: { id: string; name: string } | null;
  } | null;
  messages: Message[];
};

type ChannelLine = {
  id: string;
  name: string;
  channel: OmniChannel;
};

type CallLog = {
  id: string;
  phone: string;
  callerName: string | null;
  reason: string | null;
  notes: string | null;
  outcome: string;
  startedAt: string | Date;
  customer: { id: string; name: string } | null;
};

const channels: {
  key: OmniChannel;
  label: string;
  icon: typeof MessageCircle;
}[] = [
  { key: "WHATSAPP", label: "WhatsApp", icon: MessageCircle },
  { key: "EMAIL", label: "Email", icon: Mail },
  { key: "CALL", label: "Call", icon: Phone },
  { key: "PORTAL", label: "Portal", icon: Globe },
];

/** Classic WhatsApp chat doodle wallpaper */
const WA_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260' viewBox='0 0 260 260'%3E%3Cg fill='%23075e54' fill-opacity='0.06'%3E%3Cpath d='M20 30c8 0 12 6 12 12s-4 12-12 12-12-6-12-12 4-12 12-12zm40 80c6 0 10 5 10 10s-4 10-10 10-10-5-10-10 4-10 10-10zm90-50c7 0 11 5 11 11s-4 11-11 11-11-5-11-11 4-11 11-11zm-30 110c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9zm110-40c8 0 12 6 12 12s-4 12-12 12-12-6-12-12 4-12 12-12zM70 200c6 0 10 5 10 10s-4 10-10 10-10-5-10-10 4-10 10-10zm130 20c5 0 8 4 8 8s-3 8-8 8-8-4-8-8 3-8 8-8zM180 40c4 0 7 3 7 7s-3 7-7 7-7-3-7-7 3-7 7-7z'/%3E%3C/g%3E%3C/svg%3E\")";

const WA = {
  chatBg: "#efeae2",
} as const;

function channelToTicket(channel: OmniChannel): TicketChannel {
  if (channel === "WHATSAPP") return "WHATSAPP";
  if (channel === "EMAIL") return "EMAIL";
  if (channel === "CALL") return "PHONE";
  if (channel === "PORTAL") return "PORTAL";
  return "OTHER";
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatChatTime(date: Date | string | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

function avatarClass(channel: OmniChannel) {
  if (channel === "WHATSAPP") return "bg-emerald-500";
  if (channel === "EMAIL") return "bg-sky-500";
  if (channel === "CALL") return "bg-amber-500";
  return "bg-violet-500";
}

export function InboxWorkspace({
  conversations,
  callLogs,
  departments,
  ticketTypes,
  channelLines = [],
  scopedAgent = false,
  quickReplies = [],
  products = [],
}: {
  conversations: Conversation[];
  callLogs: CallLog[];
  departments: { id: string; name: string }[];
  ticketTypes: { id: string; name: string }[];
  channelLines?: ChannelLine[];
  scopedAgent?: boolean;
  quickReplies?: QuickReplyItem[];
  products?: CatalogProduct[];
}) {
  const [threads, setThreads] = useState(conversations);
  useEffect(() => {
    setThreads(conversations);
  }, [conversations]);

  const availableChannels = useMemo(() => {
    if (!scopedAgent) return channels;
    const allowed = new Set(channelLines.map((l) => l.channel));
    // Always keep CALL for logging if they somehow land here; otherwise filter
    const filteredTabs = channels.filter((ch) => allowed.has(ch.key));
    return filteredTabs.length > 0 ? filteredTabs : channels;
  }, [channelLines, scopedAgent]);

  const [channel, setChannel] = useState<OmniChannel>(
    availableChannels[0]?.key || "WHATSAPP"
  );
  const [lineFilter, setLineFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();
  const [profilePending, startProfile] = useTransition();
  const [showCallForm, setShowCallForm] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<CustomerProfileData | null>(null);
  const [profileJustCreated, setProfileJustCreated] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!availableChannels.some((c) => c.key === channel)) {
      setChannel(availableChannels[0]?.key || "WHATSAPP");
    }
  }, [availableChannels, channel]);

  const linesForChannel = useMemo(
    () => channelLines.filter((l) => l.channel === channel),
    [channelLines, channel]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads
      .filter((c) => c.channel === channel)
      .filter((c) => {
        if (lineFilter === "all") return true;
        return c.connector?.id === lineFilter;
      })
      .filter((c) => {
        if (!q) return true;
        const hay = [
          c.customer?.name,
          c.customer?.phone,
          c.customer?.email,
          c.externalRef,
          c.subject,
          c.connector?.name,
          c.messages[c.messages.length - 1]?.body,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
  }, [threads, channel, query, lineFilter]);

  const selected =
    filtered.find((c) => c.id === selectedId) || filtered[0] || null;

  const unreadByChannel = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of threads) {
      map[c.channel] = (map[c.channel] || 0) + c.unreadCount;
    }
    return map;
  }, [threads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.id, selected?.messages.length]);

  function openSelected(conv: Conversation) {
    setSelectedId(conv.id);
    setShowCallForm(false);
    if (conv.unreadCount > 0) {
      setThreads((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
      );
      start(async () => {
        await markConversationRead(conv.id);
      });
    }
  }

  /** Link / create CRM customer for the open thread, then refresh local thread card. */
  async function resolveSelectedCustomer() {
    if (!selected) throw new Error("No conversation selected");
    const result = await ensureCustomerFromConversation(selected.id);
    const customer = {
      id: result.id,
      name: result.name,
      phone: result.phone,
      email: result.email,
    };
    setThreads((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, customer } : c))
    );
    if (result.created) {
      toast.success(`${result.name} saved to CRM`);
    }
    return { ...result, conversationId: selected.id };
  }

  function openCustomerProfile() {
    if (!selected) return;
    setProfileOpen(true);
    setProfile(null);
    startProfile(async () => {
      try {
        const result = await resolveSelectedCustomer();
        setProfileJustCreated(result.created);
        const data = await getCustomerProfile(result.id);
        setProfile(data);
      } catch (err) {
        setProfileOpen(false);
        toast.error(err instanceof Error ? err.message : "Failed to open profile");
      }
    });
  }

  function makeComplaint() {
    if (!selected) return;
    start(async () => {
      try {
        const c = await resolveSelectedCustomer();
        openComplaintModal({
          customerId: c.id,
          conversationId: c.conversationId,
          channel: channelToTicket(selected.channel),
          phone: c.phone || selected.externalRef || undefined,
          name: c.name,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load customer");
      }
    });
  }

  function makeSale() {
    if (!selected) return;
    start(async () => {
      try {
        const c = await resolveSelectedCustomer();
        openSaleModal({
          customerId: c.id,
          conversationId: c.conversationId,
          phone: c.phone || selected.externalRef || undefined,
          name: c.name,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load customer");
      }
    });
  }

  function makeForward() {
    if (!selected) return;
    start(async () => {
      try {
        await resolveSelectedCustomer();
        setForwardOpen(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load customer");
      }
    });
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    start(async () => {
      try {
        await sendMessage(selected.id, reply.trim());
        setReply("");
        toast.success("Message sent");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function onCallSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await logIncomingCall({
          phone: String(fd.get("phone") || ""),
          callerName: String(fd.get("callerName") || "") || undefined,
          reason: String(fd.get("reason") || "") || undefined,
          notes: String(fd.get("notes") || "") || undefined,
          createComplaint: fd.get("createComplaint") === "on",
          subject: String(fd.get("subject") || "") || undefined,
          description: String(fd.get("description") || "") || undefined,
          priority: (String(fd.get("priority") || "MEDIUM") as
            | "LOW"
            | "MEDIUM"
            | "HIGH"
            | "URGENT"),
          departmentId: String(fd.get("departmentId") || "") || undefined,
          typeId: String(fd.get("typeId") || "") || undefined,
        });
        toast.success("Call logged");
        setShowCallForm(false);
        setChannel("CALL");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="-m-5 flex h-[calc(100vh-3.5rem)] overflow-hidden border-t border-[#eee8f5] bg-[#f6f3fb]">
      {/* Channel + threads — same CRM theme for every channel */}
      <div className="flex shrink-0 overflow-hidden border-r border-slate-200/80 bg-white shadow-[8px_0_24px_-20px_rgba(15,23,42,0.35)]">
        <div className="flex w-[68px] flex-col items-center gap-1.5 border-r border-slate-100 bg-white py-4">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#f6f3fb]0 to-[#8b10b8] text-[10px] font-bold tracking-wide text-white shadow-sm">
            IN
          </div>
          {availableChannels.map((ch) => {
            const Icon = ch.icon;
            const active = channel === ch.key;
            const unread = unreadByChannel[ch.key] || 0;
            return (
              <button
                key={ch.key}
                title={ch.label}
                onClick={() => {
                  setChannel(ch.key);
                  setLineFilter("all");
                  setSelectedId(null);
                  setShowCallForm(ch.key === "CALL");
                }}
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all",
                  active
                    ? "bg-[rgba(172,22,224,0.08)] text-[#8b10b8] shadow-[inset_0_0_0_1px_rgba(172,22,224,0.25)]"
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#ac16e0]" />
                )}
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white shadow-sm">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex w-[300px] flex-col bg-white">
          <div className="border-b border-slate-100 px-4 pb-3 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[15px] font-semibold tracking-tight text-slate-900">
                  {channels.find((c) => c.key === channel)?.label}
                </div>
                <div className="text-[11px] text-slate-400">
                  {filtered.length} conversation{filtered.length === 1 ? "" : "s"}
                </div>
              </div>
              {channel === "CALL" && (
                <Button size="sm" onClick={() => setShowCallForm(true)}>
                  <PhoneIncoming className="h-3.5 w-3.5" /> Log call
                </Button>
              )}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations"
                className="w-full rounded-xl border-0 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:bg-white focus:ring-[rgba(172,22,224,0.35)]"
              />
            </div>
            {linesForChannel.length > 1 && (
              <select
                value={lineFilter}
                onChange={(e) => setLineFilter(e.target.value)}
                className="mt-2 w-full rounded-lg border-0 bg-white py-1.5 text-xs text-slate-600 outline-none ring-1 ring-slate-200"
              >
                <option value="all">All lines ({linesForChannel.length})</option>
                {linesForChannel.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
            {scopedAgent && channelLines.length > 0 && linesForChannel.length <= 1 && (
              <p className="mt-2 truncate text-[11px] text-[#8b10b8]">
                Your line: {linesForChannel[0]?.name || channelLines[0]?.name}
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {channel === "CALL" &&
              callLogs.map((call) => (
                <button
                  key={call.id}
                  onClick={() => {
                    const conv = filtered.find((c) => c.externalRef === call.phone);
                    if (conv) openSelected(conv);
                    else setShowCallForm(true);
                  }}
                  className="flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900">
                      {call.callerName || call.phone}
                    </span>
                    <Badge
                      color={call.outcome === "COMPLAINT_CREATED" ? "green" : "amber"}
                    >
                      {call.outcome.replace("_", " ")}
                    </Badge>
                  </div>
                  <span className="truncate text-xs text-slate-500">
                    {call.reason || call.notes || call.phone}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {formatDateTime(call.startedAt)}
                  </span>
                </button>
              ))}

            {filtered.map((conv) => {
              const last = conv.messages[conv.messages.length - 1];
              const active = selected?.id === conv.id && !showCallForm;
              const title = conv.customer?.name || conv.externalRef || "Unknown";
              return (
                <button
                  key={conv.id}
                  onClick={() => openSelected(conv)}
                  className={cn(
                    "flex w-full gap-3 px-3 py-3 text-left transition",
                    active ? "bg-[rgba(172,22,224,0.08)]/80" : "hover:bg-slate-50"
                  )}
                >
                  <div
                    className={cn(
                      "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm ring-2 ring-white",
                      avatarClass(channel),
                      active && "ring-[rgba(172,22,224,0.15)]"
                    )}
                  >
                    {initials(title)}
                  </div>
                  <div className="min-w-0 flex-1 border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {title}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[10px]",
                          conv.unreadCount > 0
                            ? "font-semibold text-[#8b10b8]"
                            : "text-slate-400"
                        )}
                      >
                        {formatChatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    {conv.connector?.name && (
                      <p className="mt-0.5 truncate text-[10px] font-medium text-[#8b10b8]/80">
                        {conv.connector.name}
                      </p>
                    )}
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {last?.direction === "OUT" && (
                        <CheckCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                      )}
                      <div
                        className={cn(
                          "truncate text-xs",
                          conv.unreadCount > 0
                            ? "font-medium text-slate-700"
                            : "text-slate-500"
                        )}
                      >
                        {channel === "EMAIL" && last?.subject
                          ? last.subject
                          : last?.body || conv.subject || "—"}
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#ac16e0] px-1.5 text-[10px] font-semibold text-white shadow-sm">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 && channel !== "CALL" && (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <MessageCircle className="h-7 w-7" />
                </div>
                <p className="text-sm font-medium text-slate-700">No conversations yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  New threads will show up in this list.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main pane */}
      <div className="flex min-w-0 flex-1 flex-col">
        {showCallForm || (channel === "CALL" && !selected) ? (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <h2 className="text-base font-semibold">Call Intake Form</h2>
                <p className="text-xs text-slate-500">
                  Log incoming call — no Asterisk. Optionally create complaint.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openComplaintModal({ channel: "PHONE" })}
                >
                  <TicketPlus className="h-3.5 w-3.5" /> Make Complaint
                </Button>
                <Button size="sm" onClick={() => openSaleModal()}>
                  <ShoppingBag className="h-3.5 w-3.5" /> Make Sale Lead
                </Button>
              </div>
            </div>
            <form onSubmit={onCallSubmit} className="mx-auto w-full max-w-2xl space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Caller phone *</Label>
                  <Input name="phone" required placeholder="03xxxxxxxxx" />
                </div>
                <div>
                  <Label>Caller name</Label>
                  <Input name="callerName" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Call reason</Label>
                  <Input name="reason" placeholder="Billing issue, new connection…" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea name="notes" rows={3} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="createComplaint" defaultChecked className="rounded" />
                Create complaint from this call
              </label>
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Complaint subject</Label>
                  <Input name="subject" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Complaint description</Label>
                  <Textarea name="description" rows={3} />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select name="priority" defaultValue="MEDIUM">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select name="typeId" defaultValue="">
                    <option value="">Select…</option>
                    {ticketTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Forward department</Label>
                  <Select name="departmentId" defaultValue="">
                    <option value="">None</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Submit call intake"}
              </Button>
            </form>
          </div>
        ) : selected ? (
          <>
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-2.5 shadow-sm">
              <button
                type="button"
                onClick={openCustomerProfile}
                disabled={profilePending}
                className="flex min-w-0 items-center gap-3 rounded-xl text-left transition hover:bg-slate-50 disabled:opacity-60"
                title="Open customer profile"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-white shadow-md ring-2 ring-transparent hover:ring-[rgba(172,22,224,0.3)]",
                    avatarClass(selected.channel)
                  )}
                >
                  {initials(selected.customer?.name || selected.externalRef)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-slate-900">
                      {selected.customer?.name || selected.externalRef}
                    </h2>
                    <Badge color="teal">{selected.channel}</Badge>
                    {selected.connector?.name && (
                      <span className="truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {selected.connector.name}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {selected.customer?.phone || selected.externalRef}
                    {selected.customer?.email
                      ? ` · ${selected.customer.email}`
                      : ""}
                    <span className="text-[#8b10b8]"> · tap for profile</span>
                  </p>
                </div>
              </button>
            </div>

            {channel === "EMAIL" ? (
              <div className="flex flex-1 overflow-hidden">
                <div className="w-72 overflow-y-auto border-r border-slate-100 bg-slate-50">
                  {selected.messages.map((m) => (
                    <div key={m.id} className="border-b border-slate-100 px-3 py-3 text-sm">
                      <div className="font-medium text-slate-800">
                        {m.subject || "(no subject)"}
                      </div>
                      <div className="truncate text-xs text-slate-500">{m.body}</div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        {m.direction} · {formatDateTime(m.sentAt)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex-1 overflow-y-auto p-5">
                    {selected.messages.length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-2 text-xs text-slate-500">
                          {formatDateTime(
                            selected.messages[selected.messages.length - 1].sentAt
                          )}
                        </div>
                        <h3 className="mb-3 text-lg font-semibold">
                          {selected.messages[selected.messages.length - 1].subject ||
                            selected.subject ||
                            "Email"}
                        </h3>
                        <div className="whitespace-pre-wrap text-sm text-slate-700">
                          {selected.messages[selected.messages.length - 1].body}
                        </div>
                      </div>
                    )}
                  </div>
                  <form onSubmit={onSend} className="border-t border-slate-200 p-4">
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Write email reply…"
                      rows={3}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button type="submit" disabled={pending || !reply.trim()}>
                        <Send className="h-3.5 w-3.5" /> Send reply
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-10"
                  style={
                    channel === "WHATSAPP"
                      ? {
                          backgroundColor: WA.chatBg,
                          backgroundImage: WA_BG,
                        }
                      : { backgroundColor: "#f8fafc" }
                  }
                >
                  {selected.messages.map((m) => {
                    const outgoing = m.direction === "OUT";
                    const wa = channel === "WHATSAPP";
                    const meta =
                      m.meta && typeof m.meta === "object"
                        ? (m.meta as Record<string, unknown>)
                        : {};
                    const kind = typeof meta.kind === "string" ? meta.kind : "text";
                    return (
                      <div
                        key={m.id}
                        className={cn("flex", outgoing ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[78%] px-3 py-1.5 text-[14.2px] leading-snug shadow-[0_1px_1.5px_rgba(11,20,26,0.13)]",
                            outgoing
                              ? wa
                                ? "rounded-lg rounded-tr-none bg-[#d9fdd3] text-slate-900"
                                : "rounded-lg rounded-tr-sm bg-[#ac16e0] text-white"
                              : wa
                                ? "rounded-lg rounded-tl-none bg-white text-slate-800"
                                : "rounded-lg rounded-tl-sm bg-white text-slate-800"
                          )}
                        >
                          {kind === "image" && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/inbox-media/${m.id}`}
                              alt="Attachment"
                              className="mb-1 max-h-56 w-full rounded-md object-cover"
                            />
                          )}
                          {kind === "audio" && (
                            <audio
                              controls
                              preload="metadata"
                              className="mb-1 max-w-full"
                              src={`/api/inbox-media/${m.id}`}
                            />
                          )}
                          {kind === "product" && (
                            <div className="mb-1 flex gap-2 rounded-md bg-white/70 p-2 ring-1 ring-emerald-200/80">
                              {typeof meta.productImageUrl === "string" &&
                              meta.productImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={meta.productImageUrl}
                                  alt=""
                                  className="h-12 w-12 rounded object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded bg-emerald-50 text-emerald-700">
                                  <Package className="h-5 w-5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-semibold">
                                  {String(meta.productName || "Product")}
                                </div>
                                {typeof meta.productPrice === "number" && (
                                  <div className="text-[11px] text-slate-600">
                                    {formatCurrency(meta.productPrice)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="whitespace-pre-wrap">{m.body}</div>
                          <div
                            className={cn(
                              "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
                              outgoing && !wa ? "text-[#f3e8ff]" : "text-slate-500"
                            )}
                          >
                            {formatChatTime(m.sentAt)}
                            {outgoing && <CheckCheck className="h-3.5 w-3.5 text-sky-500" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                {channel === "WHATSAPP" ? (
                  <WhatsAppCompose
                    conversationId={selected.id}
                    quickReplies={quickReplies}
                    products={products}
                  />
                ) : (
                  <form
                    onSubmit={onSend}
                    className="flex items-end gap-2 border-t border-slate-200/80 bg-white px-3 py-2.5"
                  >
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (reply.trim() && !pending) {
                            onSend(e as unknown as React.FormEvent);
                          }
                        }
                      }}
                      placeholder="Type a reply…"
                      rows={1}
                      className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:bg-white focus:ring-[rgba(172,22,224,0.35)]"
                    />
                    <Button
                      type="submit"
                      disabled={pending || !reply.trim()}
                      className="h-[42px] w-[42px] shrink-0 rounded-full p-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                )}
              </>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center bg-slate-50/60 px-6 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 shadow-sm">
              <MessageCircle className="h-10 w-10" />
            </div>
            <p className="text-lg font-semibold text-slate-800">
              Select a conversation
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Choose a thread to start messaging.
            </p>
          </div>
        )}
      </div>

      {selected && !showCallForm && (
        <div className="hidden w-[280px] flex-col border-l border-slate-200/80 bg-white lg:flex">
          <div className="bg-slate-50 px-5 pb-6 pt-5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Customer
            </p>
            <button
              type="button"
              onClick={openCustomerProfile}
              disabled={profilePending}
              className="mt-3 w-full disabled:opacity-60"
              title="Open customer profile"
            >
              <div
                className={cn(
                  "mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white shadow-lg ring-4 ring-white",
                  avatarClass(selected.channel)
                )}
              >
                {initials(selected.customer?.name || selected.externalRef)}
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {selected.customer?.name || "Unknown"}
              </div>
              <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                <div>
                  {selected.customer?.phone || selected.externalRef || "—"}
                </div>
                <div>{selected.customer?.email || "—"}</div>
              </div>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[11px] font-medium text-[#8b10b8] ring-1 ring-[rgba(172,22,224,0.25)]/80">
                <UserRound className="h-3.5 w-3.5" />
                {profilePending
                  ? "Opening…"
                  : selected.customer?.id
                    ? "View full profile"
                    : "Create & open profile"}
              </span>
            </button>
          </div>
          <div className="space-y-2 p-4">
            <Button
              size="sm"
              className="w-full"
              variant="secondary"
              onClick={makeComplaint}
            >
              Make Complaint
            </Button>
            <Button
              size="sm"
              className="w-full"
              variant="outline"
              onClick={makeForward}
            >
              <Forward className="h-3.5 w-3.5" /> Forward to department
            </Button>
            <Button size="sm" className="w-full" onClick={makeSale}>
              Make Sale Lead
            </Button>
          </div>
        </div>
      )}

      <CustomerProfileModal
        open={profileOpen}
        onOpenChange={setProfileOpen}
        profile={profile}
        loading={profilePending || (profileOpen && !profile)}
        justCreated={profileJustCreated}
        onProfileUpdated={async (customerId) => {
          const data = await getCustomerProfile(customerId);
          setProfile(data);
        }}
      />

      {selected && (
        <ForwardDepartmentModal
          open={forwardOpen}
          onOpenChange={setForwardOpen}
          conversationId={selected.id}
          channel={channelToTicket(selected.channel)}
          customerId={selected.customer?.id}
          customerName={selected.customer?.name || undefined}
          phone={selected.customer?.phone || selected.externalRef || undefined}
          departments={departments}
          ticketTypes={ticketTypes}
          defaultSubject={
            selected.subject ||
            selected.messages[selected.messages.length - 1]?.body?.slice(0, 80) ||
            ""
          }
          defaultDescription={selected.messages
            .slice(-4)
            .map((m) => `${m.direction}: ${m.body}`)
            .join("\n")}
        />
      )}
    </div>
  );
}
