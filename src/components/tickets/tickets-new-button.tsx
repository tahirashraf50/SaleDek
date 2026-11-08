"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openComplaintModal } from "@/components/layout/app-shell";

export function TicketsNewButton() {
  return (
    <Button
      type="button"
      size="sm"
      className="h-10 bg-[#ac16e0] text-white hover:bg-[#8b10b8]"
      onClick={() => openComplaintModal()}
    >
      <Plus className="h-4 w-4" />
      New ticket
    </Button>
  );
}
