"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteOrganization } from "@/server/actions/admin";
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

export function DeleteTenantButton({
  orgId,
  orgName,
  orgSlug,
  redirectTo = "/admin/orgs",
}: {
  orgId: string;
  orgName: string;
  orgSlug: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();

  const canDelete = confirm.trim().toLowerCase() === orgSlug.trim().toLowerCase();

  function onDelete() {
    if (!canDelete) return;
    start(async () => {
      try {
        await deleteOrganization(orgId, confirm);
        toast.success(`${orgName} deleted`);
        setOpen(false);
        router.push(redirectTo);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 border-rose-200 bg-white px-2.5 text-xs text-rose-700 hover:bg-rose-50"
        onClick={() => {
          setConfirm("");
          setOpen(true);
        }}
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        Delete
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!pending) {
            setOpen(v);
            if (!v) setConfirm("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete tenant</DialogTitle>
            <DialogDescription>
              This permanently removes <span className="font-semibold text-slate-800">{orgName}</span>{" "}
              and all of its users, tickets, customers, and sales data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div>
              <Label htmlFor="confirm-slug">
                Type <span className="font-mono text-rose-700">{orgSlug}</span> to confirm
              </Label>
              <Input
                id="confirm-slug"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={orgSlug}
                autoComplete="off"
                className="mt-1.5"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canDelete || pending}
              className="bg-rose-700 text-white hover:bg-rose-800"
              onClick={onDelete}
            >
              {pending ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
