"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { PeopleEditor, type AssigneeValue, type Person } from "./people-editor";
import { addTaskAction, updateProjectAction } from "@/server/actions/delivery";

const STATUSES = ["ACTIVE", "ON_HOLD", "DELIVERED", "CLIENT_ACCEPTED", "CANCELLED"] as const;

export function EditProjectDialog({ project }: { project: { id: string; title: string; status: string; startDate: string; targetDate: string; notes: string } }) {
  const t = useTranslations();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(project);
  const [err, setErr] = useState<Record<string, string>>({});
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(project); setErr({}); } }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Pencil /> {t("common.edit")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("delivery.edit")}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <FormField label={t("delivery.projectTitle")} htmlFor="pe-title" error={err.title} required>
            <Input id="pe-title" dir="auto" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </FormField>
          <FormField label={t("delivery.status")} hint={t("delivery.statusAutoHint")}>
            <Select value={v.status} onValueChange={(s) => setV({ ...v, status: s })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`projectStatus.${s}`)}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("delivery.startDate")} htmlFor="pe-start" error={err.startDate}>
              <Input id="pe-start" type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />
            </FormField>
            <FormField label={t("delivery.targetDate")} htmlFor="pe-target" error={err.targetDate}>
              <Input id="pe-target" type="date" value={v.targetDate} onChange={(e) => setV({ ...v, targetDate: e.target.value })} />
            </FormField>
          </div>
          <FormField label={t("common.notes")} htmlFor="pe-notes">
            <Textarea id="pe-notes" rows={3} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
          <Button disabled={pending} onClick={() => run(() => updateProjectAction(project.id, v), { success: "delivery.updated", onSuccess: () => { setOpen(false); router.refresh(); }, onError: (r) => setErr(r.fieldErrors ?? {}) })}>
            {pending && <Loader2 className="animate-spin" />} {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type NewTask = { title: string; scope: string; price: string; estimatedHours: string; startDate: string; dueDate: string; priority: string; assignees: AssigneeValue[]; watchers: string[] };
const blank: NewTask = { title: "", scope: "", price: "", estimatedHours: "", startDate: "", dueDate: "", priority: "MEDIUM", assignees: [], watchers: [] };

export function AddTaskDialog({ projectId, people }: { projectId: string; people: Person[] }) {
  const t = useTranslations();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<NewTask>(blank);
  const [err, setErr] = useState<Record<string, string>>({});
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(blank); setErr({}); } }}>
      <DialogTrigger asChild>
        <Button><Plus /> {t("delivery.addTask")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{t("tasks.newTask")}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("tasks.taskTitle")} htmlFor="nt-title" error={err.title} required className="sm:col-span-2">
            <Input id="nt-title" dir="auto" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </FormField>
          <FormField label={t("tasks.scope")} htmlFor="nt-scope" className="sm:col-span-2">
            <Textarea id="nt-scope" dir="auto" rows={2} value={v.scope} onChange={(e) => setV({ ...v, scope: e.target.value })} />
          </FormField>
          <FormField label={t("tasks.startDate")} htmlFor="nt-start">
            <Input id="nt-start" type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />
          </FormField>
          <FormField label={t("tasks.dueDate")} htmlFor="nt-due" error={err.dueDate}>
            <Input id="nt-due" type="date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} />
          </FormField>
          <FormField label={t("tasks.price")} htmlFor="nt-price" error={err.price}>
            <Input id="nt-price" inputMode="decimal" dir="ltr" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} />
          </FormField>
          <FormField label={t("tasks.estimatedHours")} htmlFor="nt-hours" error={err.estimatedHours}>
            <Input id="nt-hours" inputMode="decimal" dir="ltr" value={v.estimatedHours} onChange={(e) => setV({ ...v, estimatedHours: e.target.value })} />
          </FormField>
          <FormField label={t("tasks.priority")}>
            <Select value={v.priority} onValueChange={(p) => setV({ ...v, priority: p })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-medium">{t("tasks.assignees")}</p>
            <PeopleEditor people={people} assignees={v.assignees} watchers={v.watchers} onChange={(p) => setV({ ...v, ...p })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
          <Button disabled={pending} onClick={() => run(() => addTaskAction(projectId, v), { success: "tasks.created", onSuccess: () => { setOpen(false); router.refresh(); }, onError: (r) => setErr(r.fieldErrors ?? {}) })}>
            {pending && <Loader2 className="animate-spin" />} {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
