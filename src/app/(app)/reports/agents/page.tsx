import type { ReactNode } from "react";
import Link from "next/link";
import {
  endOfDay,
  startOfDay,
  startOfYear,
  subDays,
} from "date-fns";
import {
  Building2,
  CheckCircle2,
  MessageSquare,
  Phone,
  Ticket,
  Trophy,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatDate } from "@/lib/utils";
import { CsvDownloadButton } from "@/components/reports/csv-download-button";
import { AgentLeaderboardChart } from "@/components/reports/agent-charts";
import { AgentsProcessTabs } from "@/components/reports/agents-process-tabs";

type Props = {
  searchParams: Promise<{
    range?: string;
    sort?: string;
    tab?: string;
    dept?: string;
  }>;
};

const RANGES = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "ytd", label: "YTD" },
  { id: "all", label: "All time" },
] as const;

const AVATAR = ["#ac16e0", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#22c55e"];

function isSupportDept(name?: string | null) {
  if (!name) return false;
  const n = name.toLowerCase();
  return (
    n.includes("customer support") ||
    n.includes("support") ||
    n.includes("call center") ||
    n.includes("contact center") ||
    n === "cs"
  );
}

function roleLabel(role: string) {
  return role
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function AgentsReportPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const orgId = session.organizationId;
  const params = await searchParams;
  const rangeId = RANGES.some((r) => r.id === params.range)
    ? (params.range as (typeof RANGES)[number]["id"])
    : "30d";
  const tab = params.tab === "departments" ? "departments" : "support";

  const now = new Date();
  const rangeEnd = endOfDay(now);
  let rangeStart: Date | null = startOfDay(subDays(now, 29));
  if (rangeId === "7d") rangeStart = startOfDay(subDays(now, 6));
  else if (rangeId === "30d") rangeStart = startOfDay(subDays(now, 29));
  else if (rangeId === "90d") rangeStart = startOfDay(subDays(now, 89));
  else if (rangeId === "ytd") rangeStart = startOfYear(now);
  else if (rangeId === "all") rangeStart = null;

  const rangeFilter = rangeStart
    ? { gte: rangeStart, lte: rangeEnd }
    : undefined;

  const [
    departments,
    users,
    assignedInRange,
    resolvedInRange,
    openNow,
    notesInRange,
    messagesOut,
    callsInRange,
    openConversations,
  ] = await Promise.all([
    db.department.findMany({
      where: { organizationId: orgId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: {
        organizationId: orgId,
        // Include org admins — they often handle tickets/inbox too
        role: { in: ["AGENT", "MANAGER", "DEPARTMENT_USER", "ORG_ADMIN"] },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
      },
    }),
    db.ticket.groupBy({
      by: ["assigneeId"],
      where: {
        organizationId: orgId,
        assigneeId: { not: null },
        ...(rangeFilter ? { createdAt: rangeFilter } : {}),
      },
      _count: true,
    }),
    db.ticket.groupBy({
      by: ["assigneeId"],
      where: {
        organizationId: orgId,
        assigneeId: { not: null },
        resolvedAt: rangeFilter ? rangeFilter : { not: null },
      },
      _count: true,
    }),
    db.ticket.groupBy({
      by: ["assigneeId"],
      where: {
        organizationId: orgId,
        assigneeId: { not: null },
        stage: { isTerminal: false },
      },
      _count: true,
    }),
    db.ticketNote.groupBy({
      by: ["authorId"],
      where: {
        authorId: { not: null },
        ...(rangeFilter ? { createdAt: rangeFilter } : {}),
        ticket: { organizationId: orgId },
      },
      _count: true,
    }),
    db.message.groupBy({
      by: ["authorUserId"],
      where: {
        authorUserId: { not: null },
        direction: "OUT",
        ...(rangeFilter ? { sentAt: rangeFilter } : {}),
        conversation: { organizationId: orgId },
      },
      _count: true,
    }),
    db.callLog.groupBy({
      by: ["agentId"],
      where: {
        organizationId: orgId,
        agentId: { not: null },
        ...(rangeFilter ? { startedAt: rangeFilter } : {}),
      },
      _count: true,
    }),
    db.conversation.groupBy({
      by: ["assigneeId"],
      where: {
        organizationId: orgId,
        assigneeId: { not: null },
        status: { not: "CLOSED" },
      },
      _count: true,
    }),
  ]);

  const assignedMap = new Map(
    assignedInRange
      .filter((r) => r.assigneeId)
      .map((r) => [r.assigneeId!, r._count])
  );
  const resolvedMap = new Map(
    resolvedInRange
      .filter((r) => r.assigneeId)
      .map((r) => [r.assigneeId!, r._count])
  );
  const openMap = new Map(
    openNow.filter((r) => r.assigneeId).map((r) => [r.assigneeId!, r._count])
  );
  const notesMap = new Map(
    notesInRange.filter((r) => r.authorId).map((r) => [r.authorId!, r._count])
  );
  const messagesMap = new Map(
    messagesOut
      .filter((r) => r.authorUserId)
      .map((r) => [r.authorUserId!, r._count])
  );
  const callsMap = new Map(
    callsInRange.filter((r) => r.agentId).map((r) => [r.agentId!, r._count])
  );
  const inboxMap = new Map(
    openConversations
      .filter((r) => r.assigneeId)
      .map((r) => [r.assigneeId!, r._count])
  );

  const agents = users.map((u) => {
    const assigned = assignedMap.get(u.id) || 0;
    const resolved = resolvedMap.get(u.id) || 0;
    const open = openMap.get(u.id) || 0;
    const worked = notesMap.get(u.id) || 0;
    const messages = messagesMap.get(u.id) || 0;
    const calls = callsMap.get(u.id) || 0;
    const inboxOpen = inboxMap.get(u.id) || 0;
    const resolveRate =
      assigned === 0 ? 0 : Math.round((resolved / assigned) * 1000) / 10;
    const supportScore = resolved * 3 + messages + calls * 2 + inboxOpen;
    const ticketScore = resolved * 4 + worked * 2 + assigned;
    return {
      ...u,
      assigned,
      resolved,
      open,
      worked,
      messages,
      calls,
      inboxOpen,
      resolveRate,
      supportScore,
      ticketScore,
      isSupport: isSupportDept(u.department?.name),
    };
  });

  // Support tab: Customer Support dept + anyone with no department
  // (e.g. ORG_ADMIN) so they are not invisible in reporting
  const supportAgents = agents.filter((a) => a.isSupport || !a.departmentId);
  const deptAgents = agents.filter((a) => !a.isSupport && !!a.departmentId);
  const unassignedAgents: typeof agents = [];

  const supportDepts = departments.filter((d) => isSupportDept(d.name));
  const opsDepts = departments.filter((d) => !isSupportDept(d.name));

  const deptFilter =
    params.dept && opsDepts.some((d) => d.id === params.dept)
      ? params.dept
      : "";

  const supportSort =
    params.sort === "messages" ||
    params.sort === "calls" ||
    params.sort === "tickets" ||
    params.sort === "resolved"
      ? params.sort
      : "resolved";

  const deptSort =
    params.sort === "worked" ||
    params.sort === "tickets" ||
    params.sort === "resolved" ||
    params.sort === "open"
      ? params.sort
      : "resolved";

  const sortedSupport = [...supportAgents].sort((a, b) => {
    if (supportSort === "messages") return b.messages - a.messages;
    if (supportSort === "calls") return b.calls - a.calls;
    if (supportSort === "tickets") return b.assigned - a.assigned;
    return b.resolved - a.resolved || b.supportScore - a.supportScore;
  });

  let sortedDept = [...deptAgents];
  if (deptFilter) {
    sortedDept = sortedDept.filter((a) => a.departmentId === deptFilter);
  }
  sortedDept.sort((a, b) => {
    if (deptSort === "worked") return b.worked - a.worked;
    if (deptSort === "tickets") return b.assigned - a.assigned;
    if (deptSort === "open") return b.open - a.open;
    return b.resolved - a.resolved || b.ticketScore - a.ticketScore;
  });

  const rangeLabel =
    RANGES.find((r) => r.id === rangeId)?.label || "30 days";

  function href(next: {
    range?: string;
    sort?: string;
    tab?: string;
    dept?: string;
  }) {
    const qs = new URLSearchParams();
    const range = next.range !== undefined ? next.range : rangeId;
    const nextTab = next.tab !== undefined ? next.tab : tab;
    const sort =
      next.sort !== undefined
        ? next.sort
        : nextTab === "support"
          ? supportSort
          : deptSort;
    const dept = next.dept !== undefined ? next.dept : deptFilter;
    qs.set("range", range);
    qs.set("tab", nextTab);
    if (sort) qs.set("sort", sort);
    if (nextTab === "departments" && dept) qs.set("dept", dept);
    return `/reports/agents?${qs.toString()}`;
  }

  const supportKpis = {
    agents: supportAgents.filter((a) => a.active).length,
    resolved: supportAgents.reduce((s, a) => s + a.resolved, 0),
    messages: supportAgents.reduce((s, a) => s + a.messages, 0),
    calls: supportAgents.reduce((s, a) => s + a.calls, 0),
    inbox: supportAgents.reduce((s, a) => s + a.inboxOpen, 0),
    open: supportAgents.reduce((s, a) => s + a.open, 0),
  };

  const deptKpis = {
    agents: deptAgents.filter((a) => a.active).length,
    resolved: deptAgents.reduce((s, a) => s + a.resolved, 0),
    worked: deptAgents.reduce((s, a) => s + a.worked, 0),
    assigned: deptAgents.reduce((s, a) => s + a.assigned, 0),
    open: deptAgents.reduce((s, a) => s + a.open, 0),
  };

  const topSupportResolved = [...supportAgents]
    .filter((a) => a.resolved > 0)
    .sort((a, b) => b.resolved - a.resolved)
    .slice(0, 8)
    .map((a) => ({ name: a.name, value: a.resolved }));

  const topSupportOutreach = [...supportAgents]
    .filter((a) => a.messages + a.calls > 0)
    .sort((a, b) => b.messages + b.calls - (a.messages + a.calls))
    .slice(0, 8)
    .map((a) => ({ name: a.name, value: a.messages + a.calls }));

  const topDeptResolved = [...(deptFilter ? sortedDept : deptAgents)]
    .filter((a) => a.resolved > 0)
    .sort((a, b) => b.resolved - a.resolved)
    .slice(0, 8)
    .map((a) => ({ name: a.name, value: a.resolved }));

  const topDeptWorked = [...(deptFilter ? sortedDept : deptAgents)]
    .filter((a) => a.worked > 0)
    .sort((a, b) => b.worked - a.worked)
    .slice(0, 8)
    .map((a) => ({ name: a.name, value: a.worked }));

  const supportCsvRows = sortedSupport.map((a) => ({
    process: "customer_support",
    name: a.name,
    email: a.email,
    role: a.role,
    department: a.department?.name || "",
    tickets_assigned: a.assigned,
    tickets_resolved: a.resolved,
    tickets_open: a.open,
    resolve_rate: a.resolveRate,
    messages_out: a.messages,
    calls: a.calls,
    inbox_open: a.inboxOpen,
  }));

  const departmentsCsvRows = sortedDept.map((a) => ({
    process: "department_ticketing",
    name: a.name,
    email: a.email,
    role: a.role,
    department: a.department?.name || "",
    tickets_assigned: a.assigned,
    tickets_resolved: a.resolved,
    tickets_open: a.open,
    resolve_rate: a.resolveRate,
    ticket_notes_worked: a.worked,
  }));

  const byDeptSections = opsDepts
    .map((d) => ({
      dept: d,
      agents: sortedDept.filter((a) => a.departmentId === d.id),
    }))
    .filter((s) => (deptFilter ? s.dept.id === deptFilter : true));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Agent reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Process-wise performance · {rangeLabel.toLowerCase()}
            {rangeStart
              ? ` · ${formatDate(rangeStart)} – ${formatDate(rangeEnd)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {RANGES.map((r) => (
              <Link
                key={r.id}
                href={href({ range: r.id })}
                scroll={false}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  rangeId === r.id
                    ? "bg-[#ac16e0] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
          <CsvDownloadButton
            filename={`agent-report-${tab}-${rangeId}.csv`}
            rows={tab === "support" ? supportCsvRows : departmentsCsvRows}
          />
        </div>
      </div>

      <AgentsProcessTabs
        initialTab={tab}
        supportHref={href({ tab: "support", sort: "resolved", dept: "" })}
        departmentsHref={href({
          tab: "departments",
          sort: "resolved",
          dept: "",
        })}
        supportSummary={`Inbox, calls & support tickets · ${supportAgents.length} agents${
          supportDepts[0]
            ? ` · ${supportDepts.map((d) => d.name).join(", ")}`
            : ""
        }`}
        departmentsSummary={`Tickets fixed & worked · ${deptAgents.length} people · ${
          opsDepts.map((d) => d.name).join(", ") || "No depts"
        }`}
        supportPanel={
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                label="Support agents"
                value={supportKpis.agents}
                hint={`${supportAgents.length} in support roster`}
                icon={<Users className="h-4 w-4" />}
                tone="teal"
              />
              <Kpi
                label="Tickets resolved"
                value={supportKpis.resolved}
                hint={`${supportKpis.open} open assigned`}
                icon={<CheckCircle2 className="h-4 w-4" />}
                tone="green"
              />
              <Kpi
                label="Outbound messages"
                value={supportKpis.messages}
                hint="WhatsApp / email replies"
                icon={<MessageSquare className="h-4 w-4" />}
                tone="sky"
              />
              <Kpi
                label="Calls logged"
                value={supportKpis.calls}
                hint={`${supportKpis.inbox} open inbox threads`}
                icon={<Phone className="h-4 w-4" />}
                tone="amber"
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <ChartCard
                title="Top support resolvers"
                subtitle="Tickets closed in range"
                accent="teal"
              >
                {topSupportResolved.length ? (
                  <AgentLeaderboardChart
                    data={topSupportResolved}
                    dataKey="value"
                    color="#ac16e0"
                    height={260}
                  />
                ) : (
                  <Empty label="No support resolutions in this range" />
                )}
              </ChartCard>
              <ChartCard
                title="Top outreach"
                subtitle="Messages + calls handled"
                accent="sky"
              >
                {topSupportOutreach.length ? (
                  <AgentLeaderboardChart
                    data={topSupportOutreach}
                    dataKey="value"
                    color="#0284c7"
                    height={260}
                  />
                ) : (
                  <Empty label="No inbox/call activity in this range" />
                )}
              </ChartCard>
            </div>

            <SortChips
              chips={[
                { id: "resolved", label: "By resolved" },
                { id: "tickets", label: "By assigned" },
                { id: "messages", label: "By messages" },
                { id: "calls", label: "By calls" },
              ]}
              active={supportSort}
              hrefFor={(id) => href({ tab: "support", sort: id })}
            />

            <AgentTable
              mode="support"
              rows={sortedSupport}
              rangeId={rangeId}
              emptyHint="No Customer Support agents yet — assign users to the Support department."
            />

            {sortedSupport[0] && sortedSupport[0].supportScore > 0 ? (
              <TopBanner
                tone="support"
                name={sortedSupport[0].name}
                detail={
                  <>
                    {sortedSupport[0].resolved} resolved ·{" "}
                    {sortedSupport[0].messages} messages ·{" "}
                    {sortedSupport[0].calls} calls
                  </>
                }
                href={`/reports/agents/${sortedSupport[0].id}?range=${rangeId}&tab=support`}
                label="Top support agent"
              />
            ) : null}
          </>
        }
        departmentsPanel={
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                label="Dept agents"
                value={deptKpis.agents}
                hint={`${opsDepts.length} departments`}
                icon={<Building2 className="h-4 w-4" />}
                tone="violet"
              />
              <Kpi
                label="Tickets fixed"
                value={deptKpis.resolved}
                hint="Resolved by assignee"
                icon={<CheckCircle2 className="h-4 w-4" />}
                tone="green"
              />
              <Kpi
                label="Work activity"
                value={deptKpis.worked}
                hint="Ticket notes / updates"
                icon={<Wrench className="h-4 w-4" />}
                tone="amber"
              />
              <Kpi
                label="Open queue"
                value={deptKpis.open}
                hint={`${deptKpis.assigned} assigned in range`}
                icon={<Ticket className="h-4 w-4" />}
                tone="rose"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={href({ tab: "departments", dept: "" })}
                scroll={false}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  !deptFilter
                    ? "bg-violet-700 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                All departments
              </Link>
              {opsDepts.map((d) => (
                <Link
                  key={d.id}
                  href={href({
                    tab: "departments",
                    dept: deptFilter === d.id ? "" : d.id,
                  })}
                  scroll={false}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    deptFilter === d.id
                      ? "bg-violet-700 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {d.name}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px]",
                      deptFilter === d.id
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {deptAgents.filter((a) => a.departmentId === d.id).length}
                  </span>
                </Link>
              ))}
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <ChartCard
                title="Top ticket fixers"
                subtitle="Resolved tickets in range"
                accent="violet"
              >
                {topDeptResolved.length ? (
                  <AgentLeaderboardChart
                    data={topDeptResolved}
                    dataKey="value"
                    color="#7c3aed"
                    height={260}
                  />
                ) : (
                  <Empty label="No department resolutions in this range" />
                )}
              </ChartCard>
              <ChartCard
                title="Most active on tickets"
                subtitle="Notes / work updates logged"
                accent="amber"
              >
                {topDeptWorked.length ? (
                  <AgentLeaderboardChart
                    data={topDeptWorked}
                    dataKey="value"
                    color="#d97706"
                    height={260}
                  />
                ) : (
                  <Empty label="No ticket work notes in this range" />
                )}
              </ChartCard>
            </div>

            <SortChips
              chips={[
                { id: "resolved", label: "By fixed" },
                { id: "worked", label: "By work notes" },
                { id: "tickets", label: "By assigned" },
                { id: "open", label: "By open queue" },
              ]}
              active={deptSort}
              hrefFor={(id) => href({ tab: "departments", sort: id })}
            />

            {deptFilter ? (
              <AgentTable
                mode="departments"
                rows={sortedDept}
                rangeId={rangeId}
                emptyHint="No agents in this department for the selected filters."
              />
            ) : (
              <div className="space-y-5">
                {byDeptSections.map(({ dept, agents: rows }) => (
                  <div key={dept.id} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <Building2 className="h-4 w-4 text-violet-600" />
                        {dept.name}
                      </h3>
                      <span className="text-[11px] text-slate-400">
                        {rows.length} people ·{" "}
                        {rows.reduce((s, a) => s + a.resolved, 0)} fixed
                      </span>
                    </div>
                    <AgentTable
                      mode="departments"
                      rows={rows}
                      rangeId={rangeId}
                      compact
                      emptyHint={`No ${dept.name} agents yet.`}
                    />
                  </div>
                ))}
                {unassignedAgents.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="px-1 text-sm font-bold text-slate-800">
                      No department
                    </h3>
                    <AgentTable
                      mode="departments"
                      rows={unassignedAgents.sort(
                        (a, b) => b.resolved - a.resolved
                      )}
                      rangeId={rangeId}
                      compact
                      emptyHint=""
                    />
                  </div>
                )}
                {byDeptSections.every((s) => s.agents.length === 0) &&
                  unassignedAgents.length === 0 && (
                    <Empty label="No department agents found" />
                  )}
              </div>
            )}

            {sortedDept[0] && sortedDept[0].ticketScore > 0 ? (
              <TopBanner
                tone="departments"
                name={sortedDept[0].name}
                detail={
                  <>
                    {sortedDept[0].resolved} fixed · {sortedDept[0].worked}{" "}
                    work notes · {sortedDept[0].department?.name || "—"}
                  </>
                }
                href={`/reports/agents/${sortedDept[0].id}?range=${rangeId}&tab=departments`}
                label="Top department fixer"
              />
            ) : null}
          </>
        }
      />
    </div>
  );
}

function TopBanner({
  tone,
  name,
  detail,
  href,
  label,
}: {
  tone: "support" | "departments";
  name: string;
  detail: ReactNode;
  href: string;
  label: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]",
        tone === "support"
          ? "border-[rgba(172,22,224,0.15)] bg-gradient-to-r from-[#f6f3fb] to-white"
          : "border-violet-100 bg-gradient-to-r from-violet-50 to-white"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm",
              tone === "support" ? "bg-[#ac16e0]" : "bg-violet-600"
            )}
          >
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                tone === "support" ? "text-[#8b10b8]/80" : "text-violet-700/80"
              )}
            >
              {label}
            </p>
            <p className="text-lg font-bold text-slate-900">{name}</p>
            <p className="text-xs text-slate-500">{detail}</p>
          </div>
        </div>
        <Link
          href={href}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          View dashboard
        </Link>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  tone: "teal" | "green" | "sky" | "amber" | "violet" | "rose";
}) {
  const tones = {
    teal: "bg-[#ac16e0] text-white",
    green: "bg-emerald-50 text-emerald-600",
    sky: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-600",
  };
  const valueTone =
    tone === "green"
      ? "text-emerald-600"
      : tone === "sky"
        ? "text-sky-600"
        : tone === "amber"
          ? "text-amber-600"
          : tone === "rose"
            ? "text-rose-600"
            : tone === "violet"
              ? "text-violet-700"
              : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className={cn("mt-1 text-2xl font-bold", valueTone)}>{value}</p>
          <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
        </div>
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            tones[tone]
          )}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  accent: "teal" | "sky" | "violet" | "amber";
  children: ReactNode;
}) {
  const bar =
    accent === "teal"
      ? "bg-[#ac16e0]"
      : accent === "sky"
        ? "bg-sky-600"
        : accent === "violet"
          ? "bg-violet-600"
          : "bg-amber-500";
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <span className={cn("h-4 w-1 rounded-sm", bar)} />
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

function SortChips({
  chips,
  active,
  hrefFor,
}: {
  chips: { id: string; label: string }[];
  active: string;
  hrefFor: (id: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((s) => (
        <Link
          key={s.id}
          href={hrefFor(s.id)}
          scroll={false}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
            active === s.id
              ? "bg-slate-900 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          )}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}

function AgentTable({
  mode,
  rows,
  rangeId,
  emptyHint,
  compact,
}: {
  mode: "support" | "departments";
  rows: Array<{
    id: string;
    name: string;
    role: string;
    active: boolean;
    department?: { name: string } | null;
    assigned: number;
    resolved: number;
    open: number;
    worked: number;
    messages: number;
    calls: number;
    inboxOpen: number;
    resolveRate: number;
  }>;
  rangeId: string;
  emptyHint: string;
  compact?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      {!compact && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-4 w-1 rounded-sm",
                mode === "support" ? "bg-[#ac16e0]" : "bg-violet-600"
              )}
            />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {mode === "support"
                  ? "Support agent leaderboard"
                  : "Department ticket leaderboard"}
              </h2>
              <p className="text-[11px] text-slate-400">
                Click a row for full agent dashboard
              </p>
            </div>
          </div>
          <Trophy className="h-4 w-4 text-amber-500" />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3 font-semibold">#</th>
              <th className="px-3 py-3 font-semibold">Agent</th>
              {mode === "support" ? (
                <>
                  <th className="px-3 py-3 font-semibold">Assigned</th>
                  <th className="px-3 py-3 font-semibold">Resolved</th>
                  <th className="px-3 py-3 font-semibold">Inbox</th>
                  <th className="px-3 py-3 font-semibold">Calls</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-3 font-semibold">Assigned</th>
                  <th className="px-3 py-3 font-semibold">Fixed</th>
                  <th className="px-3 py-3 font-semibold">Work notes</th>
                  <th className="px-3 py-3 font-semibold">Open</th>
                </>
              )}
              <th className="px-5 py-3 font-semibold text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => (
              <tr
                key={a.id}
                className={cn(
                  "border-b border-slate-50 transition hover:bg-slate-50/90",
                  !a.active && "opacity-60"
                )}
              >
                <td className="px-5 py-3.5">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold",
                      i === 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-50 text-slate-500"
                    )}
                  >
                    {i + 1}
                  </span>
                </td>
                <td className="px-3 py-3.5">
                  <Link
                    href={`/reports/agents/${a.id}?range=${rangeId}&tab=${mode === "support" ? "support" : "departments"}`}
                    className="flex items-center gap-3"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                      style={{ backgroundColor: AVATAR[i % AVATAR.length] }}
                    >
                      {initials(a.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 hover:text-[#8b10b8]">
                        {a.name}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {roleLabel(a.role)}
                        {a.department?.name ? ` · ${a.department.name}` : ""}
                      </p>
                    </div>
                  </Link>
                </td>
                {mode === "support" ? (
                  <>
                    <td className="px-3 py-3.5 text-sm font-medium">{a.assigned}</td>
                    <td className="px-3 py-3.5">
                      <p className="font-bold text-emerald-600">{a.resolved}</p>
                      <p className="text-[10px] text-slate-400">
                        {a.resolveRate}%
                      </p>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-100">
                        <MessageSquare className="h-3 w-3" />
                        {a.messages}
                        {a.inboxOpen > 0 ? ` · ${a.inboxOpen} open` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 ring-1 ring-orange-100">
                        <Phone className="h-3 w-3" />
                        {a.calls}
                      </span>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-3.5 text-sm font-medium">{a.assigned}</td>
                    <td className="px-3 py-3.5">
                      <p className="font-bold text-emerald-600">{a.resolved}</p>
                      <p className="text-[10px] text-slate-400">
                        {a.resolveRate}%
                      </p>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-100">
                        <Wrench className="h-3 w-3" />
                        {a.worked}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-sm font-medium text-amber-700">
                      {a.open}
                    </td>
                  </>
                )}
                <td className="px-5 py-3.5 text-right">
                  <Link
                    href={`/reports/agents/${a.id}?range=${rangeId}&tab=${mode === "support" ? "support" : "departments"}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#8b10b8] hover:underline"
                  >
                    Dashboard
                    <UserRound className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && emptyHint && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                  {emptyHint}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Users className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}
