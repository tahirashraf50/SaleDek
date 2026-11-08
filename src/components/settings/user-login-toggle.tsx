"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setUserActive } from "@/server/actions/settings";
import { cn } from "@/lib/utils";

export function UserLoginToggle({
  userId,
  active,
  disabled,
  size = "sm",
}: {
  userId: string;
  active: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle() {
    if (disabled || pending) return;
    start(async () => {
      try {
        await setUserActive(userId, !active);
        toast.success(active ? "Login disabled" : "Login enabled");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled || pending}
      onClick={toggle}
      title={
        disabled
          ? "Cannot change your own login here"
          : active
            ? "Disable login"
            : "Enable login"
      }
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition",
        size === "md" ? "h-7 w-12" : "h-6 w-10",
        active ? "bg-emerald-500" : "bg-slate-300",
        (disabled || pending) && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow transition",
          size === "md" ? "h-5 w-5" : "h-4 w-4",
          active
            ? size === "md"
              ? "translate-x-6"
              : "translate-x-5"
            : "translate-x-1"
        )}
      />
    </button>
  );
}
