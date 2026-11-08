"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ProductEditor,
  type ProductEditorValues,
} from "@/components/sales/product-editor";
import { deleteProduct } from "@/server/actions/sales";

export function ProductRowActions({
  product,
}: {
  product: ProductEditorValues;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, start] = useTransition();

  function onDelete() {
    if (!product.id) return;
    start(async () => {
      try {
        await deleteProduct(product.id!);
        toast.success("Product deleted");
        setDeleteOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        size="sm"
        variant="outline"
        className="h-8 border-slate-200 bg-white"
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>
              Update price, % of field rule, and custom sale form fields.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="min-h-0 overflow-y-auto">
            <ProductEditor initial={product} onDone={() => setEditOpen(false)} />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete product?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-slate-800">{product.name}</span> catalog
              se hata diya jayega. Past orders keep their line names; only the product
              link is removed.
              {!product.active ? (
                <span className="mt-1 block text-amber-700">
                  This product is inactive (expired / off catalog).
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={onDelete}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
