"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateOperationsCase } from "@/server/actions/operations";

export function OperationsCaseForm({
  orderId,
  status,
  note,
}: {
  orderId: string;
  status: string;
  note: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState(note || "");

  function setStatus(next: "PENDING" | "IN_PROGRESS" | "DONE") {
    start(async () => {
      try {
        await updateOperationsCase(orderId, { status: next, note: body });
        toast.success(`Marked ${next.replace(/_/g, " ").toLowerCase()}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Current status:{" "}
        <span className="font-semibold text-slate-800">
          {status.replace(/_/g, " ")}
        </span>
      </p>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Activation / handoff notes…"
        disabled={pending || status === "DONE"}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending || status === "DONE"}
          onClick={() => setStatus("IN_PROGRESS")}
        >
          In progress
        </Button>
        <Button
          size="sm"
          className="bg-violet-600 text-white hover:bg-violet-700"
          disabled={pending || status === "DONE"}
          onClick={() => setStatus("DONE")}
        >
          Mark complete
        </Button>
      </div>
    </div>
  );
}
