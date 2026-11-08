"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Role } from "@prisma/client";
import { toast } from "sonner";
import { updateUser } from "@/server/actions/settings";

const ROLES: Role[] = [
  "ORG_ADMIN",
  "MANAGER",
  "AGENT",
  "DEPARTMENT_USER",
  "VIEWER",
];

function roleLabel(role: string) {
  return role
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}

const fieldClass =
  "mt-1 h-10 w-full rounded-xl border border-[#eee8f5] bg-[#f6f3fb] px-3 text-sm text-slate-900 outline-none transition focus:border-[#ac16e0] focus:bg-white focus:ring-2 focus:ring-[rgba(172,22,224,0.15)] disabled:opacity-60";

export function UserProfileForm({
  user,
  departments,
}: {
  user: {
    id: string;
    name: string;
    role: Role;
    departmentId: string | null;
  };
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await updateUser({
          userId: user.id,
          name: String(fd.get("name") || ""),
          role: String(fd.get("role")) as Role,
          departmentId: String(fd.get("departmentId") || "") || null,
        });
        toast.success("Profile updated");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5">
      <div>
        <label htmlFor="name" className="text-xs font-medium text-slate-500">
          Full name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={user.name}
          className={fieldClass}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="role" className="text-xs font-medium text-slate-500">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={user.role}
            className={fieldClass}
            disabled={user.role === "SUPER_ADMIN"}
          >
            {user.role === "SUPER_ADMIN" ? (
              <option value="SUPER_ADMIN">Super Admin</option>
            ) : null}
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="departmentId"
            className="text-xs font-medium text-slate-500"
          >
            Department
          </label>
          <select
            id="departmentId"
            name="departmentId"
            defaultValue={user.departmentId || ""}
            className={fieldClass}
          >
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-xl bg-[#ac16e0] px-4 text-xs font-semibold text-white hover:bg-[#8b10b8] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
