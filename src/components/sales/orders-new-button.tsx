"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openSaleModal } from "@/components/layout/app-shell";

export function OrdersNewButton() {
  return (
    <Button
      type="button"
      size="sm"
      className="h-10 bg-[#ef1e1e] text-white hover:bg-[#d41919]"
      onClick={() => openSaleModal()}
    >
      <Plus className="h-4 w-4" />
      New sale
    </Button>
  );
}
