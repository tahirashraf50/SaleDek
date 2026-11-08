"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  CreditCard,
  LogOut,
  Mail,
  Shield,
  UserRound,
} from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { formatDate } from "@/lib/utils";

export type UserMenuProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  departmentName: string | null;
  organizationName: string;
  canViewTenant: boolean;
  canViewBilling: boolean;
  planName: string | null;
  tenantStatus: string | null;
  startedAt: string | null;
  expiresAt: string | null;
};

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f6f3fb] text-[#ac16e0]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

export function UserMenu({ profile }: { profile: UserMenuProfile }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1 flex items-center gap-2 rounded-xl bg-[#f6f3fb] py-1 pl-1 pr-2 ring-1 ring-[#eee8f5] transition hover:bg-white hover:ring-[rgba(172,22,224,0.25)] sm:pr-2.5"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#ac16e0] to-[#8b10b8] text-[11px] font-semibold text-white">
          {(profile.name || "U").slice(0, 1).toUpperCase()}
        </div>
        <div className="hidden max-w-[110px] truncate text-left text-xs font-medium text-slate-700 sm:block">
          {profile.name}
        </div>
        <ChevronDown
          className={`hidden h-3.5 w-3.5 text-slate-400 transition sm:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-2xl border border-[#eee8f5] bg-white shadow-[0_24px_50px_-28px_rgba(172,22,224,0.45)]"
        >
          <div className="border-b border-[#eee8f5] bg-gradient-to-br from-[#f6f3fb] to-white px-4 py-3.5">
            <p className="text-sm font-semibold text-slate-900">{profile.name}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{profile.email}</p>
          </div>

          <div className="space-y-3.5 px-4 py-3.5">
            <Row icon={Mail} label="Email" value={profile.email} />
            <Row
              icon={Building2}
              label="Company"
              value={profile.organizationName || "—"}
            />
            <Row icon={Shield} label="Role" value={profile.roleLabel} />
            <Row
              icon={UserRound}
              label="Department"
              value={profile.departmentName || "—"}
            />
          </div>

          {profile.canViewTenant && (
            <div className="border-t border-[#eee8f5] px-4 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ac16e0]">
                Tenant plan
              </p>
              <div className="mt-2 rounded-xl bg-[#f6f3fb] px-3 py-2.5 ring-1 ring-[#eee8f5]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {profile.planName || "No plan"}
                  </p>
                  {profile.tenantStatus && (
                    <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8b10b8] ring-1 ring-[rgba(172,22,224,0.15)]">
                      {profile.tenantStatus}
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-slate-400">Started</p>
                    <p className="font-medium text-slate-700">
                      {formatDate(profile.startedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Expires</p>
                    <p className="font-medium text-slate-700">
                      {formatDate(profile.expiresAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-[#eee8f5] p-2">
            {profile.canViewBilling && (
              <Link
                href="/settings/billing"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[#f6f3fb] hover:text-[#8b10b8]"
              >
                <CreditCard className="h-4 w-4 text-[#ac16e0]" />
                Billing &amp; invoices
              </Link>
            )}
            <Link
              href={`/settings/users/${profile.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[#f6f3fb]"
            >
              <UserRound className="h-4 w-4 text-slate-400" />
              Account settings
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
