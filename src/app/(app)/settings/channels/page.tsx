import {
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Radio,
  UserRound,
} from "lucide-react";
import { OmniChannel } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  upsertChannelConnector,
  createChannelConnector,
  deleteChannelConnector,
  ensureDefaultConnectors,
  simulateInboundMessage,
} from "@/server/actions/connectors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

async function saveAction(formData: FormData) {
  "use server";
  const channel = String(formData.get("channel")) as OmniChannel;
  const config: Record<string, unknown> = {
    mock: formData.get("mock") === "on",
  };
  if (channel === "WHATSAPP") {
    config.accessToken = String(formData.get("accessToken") || "");
    config.phoneNumberId = String(formData.get("phoneNumberId") || "");
  }
  if (channel === "EMAIL") {
    config.smtpHost = String(formData.get("smtpHost") || "");
    config.smtpPort = Number(formData.get("smtpPort") || 587);
    config.smtpUser = String(formData.get("smtpUser") || "");
    config.smtpPass = String(formData.get("smtpPass") || "");
    config.fromEmail = String(formData.get("fromEmail") || "");
  }
  await upsertChannelConnector({
    id: String(formData.get("id") || "") || undefined,
    channel,
    name: String(formData.get("name") || ""),
    enabled: formData.get("enabled") === "on",
    mode: String(formData.get("mode") || "UI_ONLY") as "UI_ONLY" | "WEBHOOK",
    regenerateSecret: formData.get("regenerateSecret") === "on",
    assigneeId: String(formData.get("assigneeId") || "") || null,
    config,
  });
}

async function ensureAction() {
  "use server";
  await ensureDefaultConnectors();
}

async function addWhatsAppAction() {
  "use server";
  await createChannelConnector({ channel: "WHATSAPP" });
}

async function addEmailAction() {
  "use server";
  await createChannelConnector({ channel: "EMAIL" });
}

async function deleteAction(formData: FormData) {
  "use server";
  await deleteChannelConnector(String(formData.get("id")));
}

async function simulateAction(formData: FormData) {
  "use server";
  await simulateInboundMessage({
    connectorId: String(formData.get("connectorId") || "") || undefined,
    channel: String(formData.get("channel")) as OmniChannel,
    externalRef: String(formData.get("externalRef") || ""),
    body: String(formData.get("body") || ""),
    subject: String(formData.get("subject") || "") || undefined,
    customerName: String(formData.get("customerName") || "") || undefined,
  });
}

function channelIcon(channel: string) {
  if (channel === "WHATSAPP") return MessageCircle;
  if (channel === "EMAIL") return Mail;
  if (channel === "PHONE") return Phone;
  return Radio;
}

function channelAccent(channel: string) {
  if (channel === "WHATSAPP") return "bg-emerald-600 shadow-emerald-600/25";
  if (channel === "EMAIL") return "bg-sky-600 shadow-sky-600/25";
  if (channel === "PHONE") return "bg-amber-600 shadow-amber-600/25";
  return "bg-slate-700 shadow-slate-700/25";
}

export default async function ChannelsSettingsPage() {
  const session = await requireOrgSession();
  const [org, connectors, agents] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: session.organizationId },
    }),
    db.channelConnector.findMany({
      where: { organizationId: session.organizationId },
      include: { assignee: { select: { id: true, name: true, email: true } } },
      orderBy: [{ channel: "asc" }, { createdAt: "asc" }],
    }),
    db.user.findMany({
      where: {
        organizationId: session.organizationId,
        active: true,
        role: { in: ["AGENT", "MANAGER", "ORG_ADMIN"] },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
  const enabledCount = connectors.filter((c) => c.enabled).length;
  const assignedCount = connectors.filter((c) => c.assigneeId).length;
  const whatsappCount = connectors.filter((c) => c.channel === "WHATSAPP").length;
  const emailCount = connectors.filter((c) => c.channel === "EMAIL").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Channels
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            WhatsApp lines & email mailboxes — assign each to an agent for Inbox
            routing
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={addWhatsAppAction}>
            <Button
              type="submit"
              size="sm"
              className="h-9 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Plus className="h-3.5 w-3.5" />
              WhatsApp
            </Button>
          </form>
          <form action={addEmailAction}>
            <Button
              type="submit"
              size="sm"
              className="h-9 bg-sky-600 text-white hover:bg-sky-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Email
            </Button>
          </form>
          <form action={ensureAction}>
            <Button type="submit" variant="outline" size="sm" className="h-9 bg-white">
              Create defaults
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Connectors</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {connectors.length}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {enabledCount} enabled
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-white shadow-md shadow-slate-800/20">
              <Radio className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">WhatsApp</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{whatsappCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Lines configured</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Email</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{emailCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Mailboxes</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Assigned</p>
          <p className="mt-1 text-2xl font-bold text-[#ac16e0]">{assignedCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">With a support agent</p>
        </div>
      </div>

      {connectors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Radio className="h-6 w-6" />
          </div>
          <p className="font-semibold text-slate-800">No connectors yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Click Create defaults or add WhatsApp / Email above.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {connectors.map((c) => {
            const cfg =
              c.config && typeof c.config === "object"
                ? (c.config as Record<string, unknown>)
                : {};
            const webhookUrl = `${baseUrl}/api/webhooks/inbound/${org.slug}/connector/${c.id}`;
            const canDelete = c.channel === "WHATSAPP" || c.channel === "EMAIL";
            const Icon = channelIcon(c.channel);
            return (
              <div
                key={c.id}
                className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md",
                        channelAccent(c.channel)
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{c.name}</p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {c.channel}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                        c.enabled
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                          : "bg-slate-50 text-slate-500 ring-slate-100"
                      )}
                    >
                      {c.enabled ? "Enabled" : "Off"}
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                        cfg.mock !== false
                          ? "bg-amber-50 text-amber-700 ring-amber-100"
                          : "bg-[rgba(172,22,224,0.08)] text-[#8b10b8] ring-[rgba(172,22,224,0.15)]"
                      )}
                    >
                      {cfg.mock !== false ? "MOCK" : "LIVE"}
                    </span>
                    {c.assignee ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                        <UserRound className="h-3 w-3" />
                        {c.assignee.name}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <form action={saveAction} className="space-y-3">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="channel" value={c.channel} />
                    <div>
                      <Label>Display name</Label>
                      <Input name="name" defaultValue={c.name} className="mt-1" />
                    </div>
                    <div>
                      <Label>Assigned support agent</Label>
                      <Select
                        name="assigneeId"
                        defaultValue={c.assigneeId || ""}
                        className="mt-1"
                      >
                        <option value="">Unassigned (admins only)</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} · {a.role}
                          </option>
                        ))}
                      </Select>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Only this agent sees this line in Inbox (admins &amp;
                        managers still see all).
                      </p>
                    </div>
                    <div>
                      <Label>Mode</Label>
                      <Select name="mode" defaultValue={c.mode} className="mt-1">
                        <option value="UI_ONLY">UI only</option>
                        <option value="WEBHOOK">Webhook ingest</option>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          name="enabled"
                          defaultChecked={c.enabled}
                          className="rounded"
                        />
                        Enabled
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          name="mock"
                          defaultChecked={cfg.mock !== false}
                          className="rounded"
                        />
                        Mock / sandbox
                      </label>
                    </div>

                    {c.channel === "WHATSAPP" && (
                      <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                        <p className="text-xs text-slate-500">
                          Meta Cloud API — leave empty to stay in mock
                        </p>
                        <div>
                          <Label>Phone number ID</Label>
                          <Input
                            name="phoneNumberId"
                            defaultValue={String(cfg.phoneNumberId || "")}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Access token</Label>
                          <Input
                            name="accessToken"
                            type="password"
                            defaultValue={String(cfg.accessToken || "")}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}

                    {c.channel === "EMAIL" && (
                      <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                        <p className="text-xs text-slate-500">
                          SMTP for outbound — optional
                        </p>
                        <div>
                          <Label>From email</Label>
                          <Input
                            name="fromEmail"
                            defaultValue={String(cfg.fromEmail || "")}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>SMTP host</Label>
                          <Input
                            name="smtpHost"
                            defaultValue={String(cfg.smtpHost || "")}
                            className="mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Port</Label>
                            <Input
                              name="smtpPort"
                              type="number"
                              defaultValue={String(cfg.smtpPort || 587)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>User</Label>
                            <Input
                              name="smtpUser"
                              defaultValue={String(cfg.smtpUser || "")}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Password</Label>
                          <Input
                            name="smtpPass"
                            type="password"
                            defaultValue={String(cfg.smtpPass || "")}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="regenerateSecret"
                        className="rounded"
                      />
                      Regenerate webhook secret
                    </label>
                    {c.mode === "WEBHOOK" && c.webhookSecret && (
                      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-100">
                        <div className="mb-1 font-medium">POST (this instance)</div>
                        <code className="break-all">{webhookUrl}</code>
                        <div className="mt-2">
                          Header: <code>x-webhook-secret: {c.webhookSecret}</code>
                        </div>
                      </div>
                    )}
                    <Button
                      type="submit"
                      size="sm"
                      className="bg-slate-900 text-white hover:bg-slate-800"
                    >
                      Save connector
                    </Button>
                  </form>

                  {canDelete && (
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" size="sm" variant="ghost" className="text-rose-600">
                        Remove this{" "}
                        {c.channel === "WHATSAPP" ? "WhatsApp" : "email"}
                      </Button>
                    </form>
                  )}

                  {(c.channel === "WHATSAPP" ||
                    c.channel === "EMAIL" ||
                    c.channel === "PORTAL") && (
                    <form
                      action={simulateAction}
                      className="space-y-2 border-t border-slate-100 pt-4"
                    >
                      <input type="hidden" name="channel" value={c.channel} />
                      <input type="hidden" name="connectorId" value={c.id} />
                      <p className="text-xs font-semibold text-slate-600">
                        Simulate inbound → agent inbox
                      </p>
                      <Input
                        name="externalRef"
                        required
                        placeholder={
                          c.channel === "EMAIL"
                            ? "customer@email.com"
                            : "03001234567"
                        }
                      />
                      <Input name="customerName" placeholder="Customer name" />
                      {c.channel === "EMAIL" && (
                        <Input name="subject" placeholder="Subject" />
                      )}
                      <Textarea
                        name="body"
                        required
                        rows={2}
                        placeholder="Message body"
                      />
                      <Button type="submit" size="sm" variant="outline" className="bg-white">
                        Inject into Inbox
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
