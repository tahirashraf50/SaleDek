"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { markNotificationsRead } from "@/server/actions/settings";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string | Date;
};

export function NotificationsMenu({
  initial,
  unread,
}: {
  initial: Notification[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initial);
  const [count, setCount] = useState(unread);
  const [pending, start] = useTransition();

  function markAll() {
    start(async () => {
      await markNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setCount(0);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#ac16e0]" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            <Button size="sm" variant="ghost" onClick={markAll} disabled={pending || !count}>
              Mark all read
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">No notifications</div>
            )}
            {items.map((n) => (
              <Link
                key={n.id}
                href={n.href || "#"}
                onClick={() => setOpen(false)}
                className={`block border-b border-slate-50 px-3 py-2 hover:bg-slate-50 ${
                  n.read ? "opacity-70" : ""
                }`}
              >
                <div className="text-sm font-medium text-slate-900">{n.title}</div>
                {n.body && <div className="text-xs text-slate-500">{n.body}</div>}
                <div className="text-[10px] text-slate-400">{formatDateTime(n.createdAt)}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
