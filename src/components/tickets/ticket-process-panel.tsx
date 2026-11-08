"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  Siren,
  UserRound,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Stage = { id: string; key: string; name: string };
type User = { id: string; name: string };
type Dept = { id: string; name: string };

type Props = {
  ticketId: string;
  currentStageKey: string;
  currentAssigneeId: string | null;
  currentDepartmentId: string | null;
  stages: Stage[];
  users: User[];
  departments: Dept[];
  updateStageAction: (formData: FormData) => Promise<void>;
  assignAction: (formData: FormData) => Promise<void>;
  forwardAction: (formData: FormData) => Promise<void>;
  escalateAction: (formData: FormData) => Promise<void>;
};

const TABS = [
  { id: "stage", label: "Stage", icon: Workflow },
  { id: "assign", label: "Assign", icon: UserRound },
  { id: "forward", label: "Forward", icon: ArrowRightLeft },
  { id: "escalate", label: "Escalate", icon: Siren },
] as const;

export function TicketProcessPanel({
  ticketId,
  currentStageKey,
  currentAssigneeId,
  currentDepartmentId,
  stages,
  users,
  departments,
  updateStageAction,
  assignAction,
  forwardAction,
  escalateAction,
}: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("stage");

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-sm bg-[#ac16e0]" />
          <h2 className="text-sm font-semibold text-slate-900">Process</h2>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-semibold transition",
                  tab === t.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4">
        {tab === "stage" && (
          <form action={updateStageAction} className="space-y-3">
            <input type="hidden" name="ticketId" value={ticketId} />
            <div className="space-y-1.5">
              <Label className="text-[11px]">Move to stage</Label>
              <Select name="stageKey" defaultValue={currentStageKey}>
                {stages.map((s) => (
                  <option key={s.id} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Resolution note</Label>
              <Textarea
                name="resolutionNote"
                rows={2}
                placeholder="Required when resolving / closing"
              />
            </div>
            <Button type="submit" size="sm" className="w-full gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Update stage
            </Button>
          </form>
        )}

        {tab === "assign" && (
          <form action={assignAction} className="space-y-3">
            <input type="hidden" name="ticketId" value={ticketId} />
            <div className="space-y-1.5">
              <Label className="text-[11px]">Assignee</Label>
              <Select name="assigneeId" defaultValue={currentAssigneeId || ""}>
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" size="sm" variant="outline" className="w-full">
              Save assignee
            </Button>
          </form>
        )}

        {tab === "forward" && (
          <form action={forwardAction} className="space-y-3">
            <input type="hidden" name="ticketId" value={ticketId} />
            <div className="space-y-1.5">
              <Label className="text-[11px]">Department</Label>
              <Select
                name="departmentId"
                required
                defaultValue={currentDepartmentId || ""}
              >
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
            <div className="space-y-1.5">
              <Label className="text-[11px]">Assignee (optional)</Label>
              <Select name="assigneeId" defaultValue="">
                <option value="">No assignee</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Note</Label>
              <Textarea name="note" rows={2} placeholder="Why forwarding…" />
            </div>
            <Button type="submit" size="sm" variant="outline" className="w-full">
              Forward ticket
            </Button>
          </form>
        )}

        {tab === "escalate" && (
          <form action={escalateAction} className="space-y-3">
            <input type="hidden" name="ticketId" value={ticketId} />
            <div className="space-y-1.5">
              <Label className="text-[11px]">Reason</Label>
              <Input name="reason" required placeholder="Escalation reason" />
            </div>
            <Button type="submit" size="sm" variant="danger" className="w-full">
              Escalate now
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
