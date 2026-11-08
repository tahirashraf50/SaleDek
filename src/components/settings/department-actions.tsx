"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteDepartment,
  updateDepartment,
} from "@/server/actions/settings";

type Props = {
  department: {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    userCount: number;
    ticketCount: number;
  };
};

export function DepartmentActions({ department }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description || "");
  const [active, setActive] = useState(department.active);

  function openEdit() {
    setName(department.name);
    setDescription(department.description || "");
    setActive(department.active);
    setEditOpen(true);
  }

  function save() {
    start(async () => {
      try {
        await updateDepartment(department.id, {
          name,
          description,
          active,
        });
        toast.success("Department updated");
        setEditOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  function remove() {
    start(async () => {
      try {
        await deleteDepartment(department.id);
        toast.success(`Deleted “${department.name}”`);
        setDeleteOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 bg-white px-2 text-xs"
          onClick={openEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 border-rose-200 bg-white px-2 text-xs text-rose-700 hover:bg-rose-50"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit department</DialogTitle>
            <DialogDescription>
              Update name, description, or active status.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div>
              <Label htmlFor={`dept-name-${department.id}`}>Name</Label>
              <Input
                id={`dept-name-${department.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor={`dept-desc-${department.id}`}>Description</Label>
              <Textarea
                id={`dept-desc-${department.id}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1"
                disabled={pending}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                disabled={pending}
                className="h-4 w-4 rounded border-slate-300 text-[#8b10b8]"
              />
              Active (available for ticket routing)
            </label>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !name.trim()}
              className="bg-[#ac16e0] text-white hover:bg-[#8b10b8]"
              onClick={save}
            >
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete department?</DialogTitle>
            <DialogDescription>
              “{department.name}” will be removed permanently. Users (
              {department.userCount}), tickets ({department.ticketCount}), and
              teams linked to it will be unassigned from this department.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={remove}
            >
              {pending ? "Deleting…" : "Delete department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
