"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { portalSubmitComplaint, portalTrackTicket } from "@/server/actions/portal";

export function PortalClient({
  orgSlug,
  orgName,
}: {
  orgSlug: string;
  orgName: string;
}) {
  const [tab, setTab] = useState<"submit" | "track">("submit");
  const [pending, start] = useTransition();
  const [created, setCreated] = useState<{ ticketNumber: number; trackingCode: string } | null>(
    null
  );
  const [tracked, setTracked] = useState<{
    number: number;
    subject: string;
    stage: string;
    priority: string;
    customerName: string;
    createdAt: string;
  } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const result = await portalSubmitComplaint({
          orgSlug,
          name: String(fd.get("name") || ""),
          phone: String(fd.get("phone") || "") || undefined,
          email: String(fd.get("email") || "") || undefined,
          subject: String(fd.get("subject") || ""),
          description: String(fd.get("description") || ""),
          priority: String(fd.get("priority") || "MEDIUM") as
            | "LOW"
            | "MEDIUM"
            | "HIGH"
            | "URGENT",
        });
        setCreated(result);
        toast.success(`Complaint #${result.ticketNumber} submitted`);
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function onTrack(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const result = await portalTrackTicket(
          orgSlug,
          Number(fd.get("ticketNumber")),
          String(fd.get("contact") || "")
        );
        setTracked(result);
      } catch (err) {
        setTracked(null);
        toast.error(err instanceof Error ? err.message : "Not found");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={tab === "submit" ? "default" : "outline"}
          onClick={() => setTab("submit")}
        >
          Submit complaint
        </Button>
        <Button
          variant={tab === "track" ? "default" : "outline"}
          onClick={() => setTab("track")}
        >
          Track status
        </Button>
      </div>

      {tab === "submit" ? (
        <Card>
          <CardHeader>
            <CardTitle>New complaint</CardTitle>
            <CardDescription>
              Send a complaint to {orgName}. You will get a ticket number to track.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {created && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Submitted. Ticket <strong>#{created.ticketNumber}</strong>
                <div className="text-xs">Tracking: {created.trackingCode}</div>
              </div>
            )}
            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Your name *</Label>
                <Input name="name" required />
              </div>
              <div>
                <Label>Phone</Label>
                <Input name="phone" placeholder="03xxxxxxxxx" />
              </div>
              <div>
                <Label>Email</Label>
                <Input name="email" type="email" />
              </div>
              <div className="sm:col-span-2">
                <Label>Subject *</Label>
                <Input name="subject" required />
              </div>
              <div className="sm:col-span-2">
                <Label>Details *</Label>
                <Textarea name="description" required rows={5} />
              </div>
              <div>
                <Label>Priority</Label>
                <Select name="priority" defaultValue="MEDIUM">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={pending} className="w-full">
                  {pending ? "Submitting…" : "Submit complaint"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Track ticket</CardTitle>
            <CardDescription>
              Enter ticket number and the phone or email used when submitting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onTrack} className="mb-4 grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Ticket #</Label>
                <Input name="ticketNumber" type="number" required placeholder="1001" />
              </div>
              <div>
                <Label>Phone or email</Label>
                <Input name="contact" required />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={pending} className="w-full">
                  Track
                </Button>
              </div>
            </form>
            {tracked && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">
                    #{tracked.number} {tracked.subject}
                  </h3>
                  <Badge color="teal">{tracked.stage}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {tracked.customerName} · {tracked.priority}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Created {new Date(tracked.createdAt).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
