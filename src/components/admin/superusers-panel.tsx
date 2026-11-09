"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  createSuperAdmin,
  resetSuperAdminPassword,
  updateSuperAdmin,
} from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatDate } from "@/lib/utils";

export type SuperUserRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
};

type Mode = "create" | "edit" | "password" | null;

export function SuperUsersPanel({
  users,
  currentUserId,
}: {
  users: SuperUserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<SuperUserRow | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(true);

  function openCreate() {
    setSelected(null);
    setName("");
    setEmail("");
    setPassword("");
    setActive(true);
    setMode("create");
  }

  function openEdit(user: SuperUserRow) {
    setSelected(user);
    setName(user.name);
    setEmail(user.email);
    setPassword("");
    setActive(user.active);
    setMode("edit");
  }

  function openPassword(user: SuperUserRow) {
    setSelected(user);
    setPassword("");
    setMode("password");
  }

  function close() {
    setMode(null);
    setSelected(null);
    setPassword("");
  }

  function submit() {
    start(async () => {
      try {
        if (mode === "create") {
          await createSuperAdmin({ name, email, password });
          toast.success("Superuser created");
        } else if (mode === "edit" && selected) {
          await updateSuperAdmin({
            userId: selected.id,
            name,
            email,
            active,
          });
          toast.success("Superuser updated");
        } else if (mode === "password" && selected) {
          await resetSuperAdminPassword({
            userId: selected.id,
            password,
          });
          toast.success("Password reset");
        }
        close();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Platform access
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Shield className="h-6 w-6 text-teal-700" />
            Superusers
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create, edit, and reset passwords for platform admins.
          </p>
        </div>
        <Button
          type="button"
          className="h-9 gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" />
          Add superuser
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {users.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            No superusers yet
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {user.name}
                    </p>
                    {user.id === currentUserId ? (
                      <span className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800 ring-1 ring-teal-100">
                        You
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                        user.active
                          ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                          : "bg-slate-100 text-slate-500 ring-slate-200",
                      )}
                    >
                      {user.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {user.email} · since {formatDate(user.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 bg-white text-xs"
                    onClick={() => openEdit(user)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 bg-white text-xs"
                    onClick={() => openPassword(user)}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset password
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === "create"
                ? "Add superuser"
                : mode === "edit"
                  ? "Edit superuser"
                  : "Reset password"}
            </DialogTitle>
            <DialogDescription>
              {mode === "password"
                ? `Set a new login password for ${selected?.email || "this user"}.`
                : "Platform admins can access /admin for all tenants."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {mode === "create" || mode === "edit" ? (
              <>
                <div>
                  <Label htmlFor="su-name">Name</Label>
                  <Input
                    id="su-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5"
                    placeholder="Platform admin"
                  />
                </div>
                <div>
                  <Label htmlFor="su-email">Email</Label>
                  <Input
                    id="su-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5"
                    placeholder="admin@saledek.com"
                  />
                </div>
              </>
            ) : null}

            {mode === "create" || mode === "password" ? (
              <div>
                <Label htmlFor="su-password">
                  {mode === "password" ? "New password" : "Password"}
                </Label>
                <Input
                  id="su-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5"
                  placeholder="Min 6 characters"
                  minLength={6}
                />
              </div>
            ) : null}

            {mode === "edit" ? (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={selected?.id === currentUserId}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                Active login
                {selected?.id === currentUserId ? (
                  <span className="text-xs text-slate-400">(your account)</span>
                ) : null}
              </label>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-teal-700 text-white hover:bg-teal-800"
              onClick={submit}
              disabled={pending}
            >
              {pending
                ? "Saving…"
                : mode === "create"
                  ? "Create"
                  : mode === "password"
                    ? "Reset password"
                    : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
