"use client";

import { Plus, Search, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { UserMenu, type UserMenuProfile } from "@/components/layout/user-menu";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string | Date;
};

type Props = {
  profile: UserMenuProfile;
  unread?: number;
  notifications?: Notification[];
  onNewComplaint: () => void;
  onNewSale: () => void;
  onNewCustomer: () => void;
  onSearch: () => void;
};

export function Topbar({
  profile,
  unread = 0,
  notifications = [],
  onNewComplaint,
  onNewSale,
  onNewCustomer,
  onSearch,
}: Props) {
  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-[#eee8f5] bg-white px-4 md:px-5">
      <button
        onClick={onSearch}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-xl bg-[#f6f3fb] px-3 text-sm text-slate-500 ring-1 ring-[#eee8f5] transition hover:bg-white hover:text-slate-700 hover:ring-[rgba(172,22,224,0.3)]"
      >
        <Search className="h-4 w-4 text-slate-400" />
        <span className="truncate">Search customers, tickets, orders…</span>
        <span className="ml-auto hidden items-center gap-0.5 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 ring-1 ring-slate-200 sm:inline-flex">
          <Command className="h-2.5 w-2.5" />K
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onNewCustomer}
          className="hidden rounded-xl sm:inline-flex"
        >
          <Plus className="h-3.5 w-3.5" /> Customer
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onNewComplaint}
          className="rounded-xl"
        >
          <Plus className="h-3.5 w-3.5" /> Complaint
        </Button>
        <Button size="sm" onClick={onNewSale} className="rounded-xl">
          <Plus className="h-3.5 w-3.5" /> Sale
        </Button>
        <NotificationsMenu initial={notifications} unread={unread} />
        <UserMenu profile={profile} />
      </div>
    </header>
  );
}
