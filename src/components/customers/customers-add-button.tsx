"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openCustomerModal } from "@/components/layout/app-shell";

export function CustomersAddButton() {
  return (
    <Button
      type="button"
      size="sm"
      className="bg-[#ef1e1e] text-white hover:bg-[#d41919]"
      onClick={() => openCustomerModal()}
    >
      <Plus className="h-4 w-4" />
      Add customer
    </Button>
  );
}
