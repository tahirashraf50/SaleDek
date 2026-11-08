"use client";

import { useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { createTicket } from "@/server/actions/tickets";
import { ensureCustomerFromConversation } from "@/server/actions/inbox";
import { TicketChannel, TicketPriority } from "@prisma/client";

export function ForwardDepartmentModal({
  open,
  onOpenChange,
  conversationId,
  channel,
  customerId,
  customerName,
  phone,
  departments,
  ticketTypes,
  defaultSubject,
  defaultDescription,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
  channel: TicketChannel;
  customerId?: string;
  customerName?: string;
  phone?: string;
  departments: { id: string; name: string }[];
  ticketTypes: { id: string; name: string }[];
  defaultSubject?: string;
  defaultDescription?: string;
}) {
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        let cid = customerId;
        if (!cid) {
          const ensured = await ensureCustomerFromConversation(conversationId);
          cid = ensured.id;
        }
        await createTicket({
          customerId: cid,
          subject: String(fd.get("subject") || ""),
          description: String(fd.get("description") || ""),
          priority: String(fd.get("priority") || "MEDIUM") as TicketPriority,
          channel,
          typeId: String(fd.get("typeId") || "") || undefined,
          departmentId: String(fd.get("departmentId") || ""),
          forwardNote: String(fd.get("forwardNote") || "") || undefined,
          conversationId,
        });
        toast.success("Complaint created & forwarded — department emailed");
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forward to department</DialogTitle>
          <DialogDescription>
            Creates a complaint, assigns the department, emails their team, and drops a message in
            their Email inbox.
            {customerName ? ` Customer: ${customerName}` : phone ? ` Contact: ${phone}` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-3">
            <div>
              <Label>Department *</Label>
              <Select name="departmentId" required defaultValue="">
                <option value="" disabled>
                  Select department
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Subject *</Label>
              <Input name="subject" required defaultValue={defaultSubject || ""} />
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                name="description"
                required
                rows={4}
                defaultValue={defaultDescription || ""}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Priority</Label>
                <Select name="priority" defaultValue="MEDIUM">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select name="typeId" defaultValue="">
                  <option value="">Optional</option>
                  {ticketTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Forward note</Label>
              <Textarea
                name="forwardNote"
                rows={2}
                placeholder="Internal note for the department…"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Forwarding…" : "Create & forward"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
