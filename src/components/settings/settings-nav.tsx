"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/settings/workspace", label: "Workspace", adminOnly: true },
  { href: "/settings/billing", label: "Billing", adminOnly: true },
  { href: "/settings/users", label: "Users" },
  { href: "/settings/departments", label: "Departments" },
  { href: "/settings/ticket-types", label: "Ticket types" },
  { href: "/settings/sla", label: "SLA" },
  { href: "/settings/automations", label: "Automations" },
  { href: "/settings/pipelines", label: "Pipelines" },
  { href: "/settings/custom-fields", label: "Custom fields" },
  { href: "/settings/channels", label: "Channels" },
  { href: "/settings/quick-replies", label: "Quick replies" },
  { href: "/settings/knowledge", label: "Knowledge" },
];

export function SettingsNav({ isOrgAdmin = false }: { isOrgAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1.5">
      {links
        .filter((link) => !link.adminOnly || isOrgAdmin)
        .map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "bg-[#ac16e0] text-white shadow-sm shadow-[0_10px_24px_-12px_rgba(172,22,224,0.35)]"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {link.label}
            </Link>
          );
        })}
    </nav>
  );
}
