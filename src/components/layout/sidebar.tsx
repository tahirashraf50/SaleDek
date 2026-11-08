"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Ticket,
  ShoppingCart,
  Package,
  BarChart3,
  Settings,
  Boxes,
  Inbox,
  Store,
  LifeBuoy,
  ChevronRight,
  Building,
  UserRound,
  Shield,
  Wallet,
  Cog,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgModuleKey, Role } from "@prisma/client";

const primary = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const crm = [
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/tickets", label: "Tickets", icon: Ticket },
];

const salesBase = [
  { href: "/sales/orders", label: "Orders", icon: ShoppingCart },
  { href: "/sales/products", label: "Products", icon: Package },
];

const insights = [
  { href: "/reports/service", label: "Service reports", icon: BarChart3 },
  { href: "/reports/sales", label: "Sales reports", icon: BarChart3 },
  { href: "/reports/agents", label: "Agent reports", icon: UserRound },
  { href: "/settings/users", label: "Settings", icon: Settings },
];

const MODULE_ICONS: Record<OrgModuleKey, LucideIcon> = {
  UNDERWRITING: Shield,
  FINANCE: Wallet,
  OPERATIONS: Cog,
  SALES: ShoppingCart,
  TECHNICAL: Wrench,
};

export type ModuleNavItem = {
  href: string;
  label: string;
  key: OrgModuleKey;
};

function NavGroup({
  label,
  items,
  pathname,
}: {
  label?: string;
  items: { href: string; label: string; icon: LucideIcon }[];
  pathname: string;
}) {
  if (!items.length) return null;
  return (
    <div className="space-y-0.5">
      {label && (
        <div className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </div>
      )}
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all",
              active
                ? "bg-[rgba(172,22,224,0.08)] text-[#5b0a7a] shadow-[inset_0_0_0_1px_rgba(172,22,224,0.16)]"
                : "text-slate-600 hover:bg-[#f6f3fb] hover:text-slate-900"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#ac16e0]" />
            )}
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                active
                  ? "bg-[#ac16e0] text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 group-hover:bg-[#eee8f5] group-hover:text-slate-700"
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <span className="truncate">{item.label}</span>
            {active && (
              <ChevronRight className="ml-auto h-3.5 w-3.5 text-[#ac16e0]/70" />
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar({
  orgName,
  orgSlug,
  role,
  moduleNav = [],
}: {
  orgName?: string | null;
  orgSlug?: string | null;
  role?: Role | null;
  moduleNav?: ModuleNavItem[];
}) {
  const pathname = usePathname();
  const isDept = role === "DEPARTMENT_USER";

  const moduleItems = moduleNav.map((m) => ({
    href: m.href,
    label: m.label,
    icon: MODULE_ICONS[m.key] || Boxes,
  }));

  const deptNav = [
    { href: "/department", label: "Dashboard", icon: Building },
    ...moduleItems,
    { href: "/tickets", label: "Tickets", icon: Ticket },
  ];

  const sales = [
    ...salesBase,
    ...moduleItems.filter((m) => m.href === "/underwriting" || m.href === "/sales/desk"),
  ];

  // Avoid duplicate Underwriting / Sales desk in sales group if already listed
  const salesDeduped = sales.filter(
    (item, i, arr) => arr.findIndex((x) => x.href === item.href) === i
  );

  return (
    <aside className="flex h-full w-[248px] flex-col border-r border-slate-200/90 bg-white text-slate-900">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ac16e0] to-[#8b10b8] shadow-[0_10px_24px_-10px_rgba(172,22,224,0.85)]">
            <Boxes className="h-4 w-4 text-white" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#c9ff70]" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
              PulseCRM
            </div>
            <div className="truncate text-[11px] text-slate-500">
              {isDept ? "Department portal" : orgName || "Workspace"}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
        {isDept ? (
          <NavGroup items={deptNav} pathname={pathname} />
        ) : (
          <>
            <NavGroup items={primary} pathname={pathname} />
            <NavGroup label="CRM" items={crm} pathname={pathname} />
            <NavGroup label="Sales" items={salesDeduped} pathname={pathname} />
            <NavGroup label="Modules" items={moduleItems.filter((m) => !["/underwriting", "/sales/desk"].includes(m.href))} pathname={pathname} />
            <NavGroup label="Insights" items={insights} pathname={pathname} />
          </>
        )}

        {orgSlug && !isDept && (
          <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2">
            <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Public links
            </div>
            <Link
              href={`/shop/${orgSlug}`}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Store className="h-3.5 w-3.5" />
              </span>
              Public shop
            </Link>
            <Link
              href={`/portal/${orgSlug}`}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <LifeBuoy className="h-3.5 w-3.5" />
              </span>
              Support portal
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="rounded-2xl bg-gradient-to-br from-[#f6f3fb] to-[rgba(201,255,112,0.18)] px-3 py-3 ring-1 ring-[#eee8f5]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ac16e0]/80">
            {isDept ? "Department" : "Workspace"}
          </div>
          <div className="mt-1 truncate text-xs font-medium text-slate-800">
            {orgName || "Active tenant"}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {isDept ? "Module queues" : "Live · multi-channel"}
          </div>
        </div>
      </div>
    </aside>
  );
}
