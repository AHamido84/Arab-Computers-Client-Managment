"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, CalendarSync, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { useFmt } from "@/components/shared/format-provider";
import { ProgressBar } from "./progress-bar";
import { PeopleEditor, type AssigneeValue, type Person } from "./people-editor";
import { TASK_STATUSES } from "@/lib/delivery";
import {
  addChecklistItemAction,
  addCommentAction,
  changeDueDateAction,
  deleteChecklistItemAction,
  deleteCommentAction,
  deleteTimeLogAction,
  logTimeAction,
  setTaskPeopleAction,
  toggleChecklistItemAction,
  updateTaskAction,
} from "@/server/actions/delivery";
import { cn } from "@/lib/utils";

export type TaskDTO = {
  id: string;
  title: string;
  scope: string | null;
  status: string;
  priority: string;
  progress: number;
  price: number | null;
  currency: string;
  estimatedHours: number | null;
  startDate: string | null;
  dueDate: string | null;
  originalDueDate: string | null;
  delayReason: string | null;
  overdue: boolean;
  assignees: AssigneeValue[];
  watchers: string[];
  checklist: { id: string; title: string; done: boolean }[];
  comments: { id: string; body: string; createdAt: string; author: { id: string; name: string } | null; mentions: string[] }[];
  timeLogs: { id: string; date: string; hours: number; note: string | null; user: { id: string; name: string } }[];
  dueChanges: { id: string; oldDate: string | null; newDate: string | null; reason: string; createdAt: string; by: string | null }[];
};

type Perms = { canWork: boolean; canComment: boolean; canChangeDue: boolean; canManage: boolean; showPrice: boolean };

export function TaskWorkspace({ task, people, perms, meId, today }: { task: TaskDTO; people: Person[]; perms: Perms; meId: string; today: string }) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const refresh = () => router.refresh();
  const save = (patch: Record<string, unknown>) => run(() => updateTaskAction(task.id, patch), { success: "tasks.saved", onSuccess: refresh });
  const [progress, setProgress] = useState(task.progress);
  const [delay, setDelay] = useState(task.delayReason ?? "");
  const [dueOpen, setDueOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const logged = task.timeLogs.reduce((s, l) => s + l.hours, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
      <div className="space-y-6 xl:col-span-2">
        {/* Details */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("tasks.details")}</CardTitle>
            {perms.canManage && (
              <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil /> {t("common.edit")}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {task.scope ? <p className="whitespace-pre-wrap" dir="auto">{task.scope}</p> : <p className="text-muted-foreground">—</p>}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
              {perms.showPrice && task.price != null && <span>{t("tasks.price")}: <span className="num text-foreground">{f.money(task.price, task.currency)}</span></span>}
              <span>{t("tasks.estimatedHours")}: <span className="num text-foreground">{task.estimatedHours != null ? f.number(task.estimatedHours, 0) : "—"}</span></span>
            </div>
          </CardContent>
        </Card>

        <Checklist task={task} canWork={perms.canWork} />
        <Comments task={task} people={people} canComment={perms.canComment} canManage={perms.canManage} meId={meId} />
      </div>

      <div className="space-y-6">
        {/* Status & progress */}
        <Card>
          <CardContent className="space-y-4">
            <FormField label={t("tasks.status")}>
              <Select value={task.status} disabled={!perms.canWork || pending} onValueChange={(v) => save({ status: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`taskStatus.${s}`)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label={t("tasks.priority")}>
              <Select value={task.priority} disabled={!perms.canManage || pending} onValueChange={(v) => save({ priority: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label={t("tasks.progress")} htmlFor="t-progress">
              <ProgressBar value={progress} label={t("tasks.progress")} tone={task.overdue ? "danger" : progress === 100 ? "success" : "default"} />
              {perms.canWork && (
                <input
                  id="t-progress"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  onPointerUp={() => progress !== task.progress && save({ progress })}
                  onKeyUp={(e) => ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key) && progress !== task.progress && save({ progress })}
                  className="w-full accent-[var(--primary)]"
                  aria-valuetext={t("tasks.progressLabel", { value: progress })}
                />
              )}
            </FormField>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{t("tasks.startDate")}</p>
                <p>{f.date(task.startDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("tasks.dueDate")}</p>
                <p className={cn(task.overdue && "inline-flex items-center gap-1 font-medium text-destructive")}>
                  {task.overdue && <AlertTriangle className="size-3.5" />} {f.date(task.dueDate)}
                </p>
              </div>
              {task.originalDueDate && task.originalDueDate !== task.dueDate && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">{t("tasks.originalDueDate")}</p>
                  <p>{f.date(task.originalDueDate)}</p>
                </div>
              )}
            </div>
            {perms.canChangeDue && (
              <Button variant="outline" size="sm" onClick={() => setDueOpen(true)}>
                <CalendarSync /> {t("tasks.changeDueDate")}
              </Button>
            )}
            {(task.overdue || task.delayReason) && (
              <FormField label={t("tasks.delayReason")} htmlFor="t-delay" hint={task.overdue ? t("tasks.delayReasonHint") : undefined}>
                <Textarea id="t-delay" rows={2} dir="auto" value={delay} disabled={!perms.canWork} onChange={(e) => setDelay(e.target.value)} onBlur={() => delay !== (task.delayReason ?? "") && save({ delayReason: delay })} />
              </FormField>
            )}
          </CardContent>
        </Card>

        {/* People */}
        <Card>
          <CardHeader>
            <CardTitle>{t("tasks.assignees")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PeopleEditor
              people={people}
              assignees={task.assignees}
              watchers={task.watchers}
              disabled={!perms.canManage || pending}
              onChange={(p) => run(() => setTaskPeopleAction(task.id, p), { success: "tasks.saved", onSuccess: refresh })}
            />
          </CardContent>
        </Card>

        <TimeLog task={task} canWork={perms.canWork} canManage={perms.canManage} meId={meId} today={today} logged={logged} />
        <DueHistory task={task} />
      </div>

      <DueDateDialog open={dueOpen} onOpenChange={setDueOpen} task={task} onDone={refresh} />
      {perms.canManage && <EditTaskDialog open={editOpen} onOpenChange={setEditOpen} task={task} onDone={refresh} />}
    </div>
  );
}

function Checklist({ task, canWork }: { task: TaskDTO; canWork: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [title, setTitle] = useState("");
  const done = task.checklist.filter((c) => c.done).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("tasks.checklist")} {task.checklist.length > 0 && <span className="text-sm font-normal text-muted-foreground">({done}/{task.checklist.length})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-1">
          {task.checklist.map((c) => (
            <li key={c.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
              <Checkbox id={`cl-${c.id}`} checked={c.done} disabled={!canWork || pending} onCheckedChange={(v) => run(() => toggleChecklistItemAction(c.id, !!v), { onSuccess: () => router.refresh() })} />
              <label htmlFor={`cl-${c.id}`} className={cn("flex-1 text-sm", c.done && "text-muted-foreground line-through")} dir="auto">
                {c.title}
              </label>
              {canWork && (
                <Button variant="ghost" size="icon-xs" className="opacity-60 group-hover:opacity-100" aria-label={`${t("common.delete")} ${c.title}`} onClick={() => run(() => deleteChecklistItemAction(c.id), { onSuccess: () => router.refresh() })}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {canWork && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              run(() => addChecklistItemAction(task.id, title), { onSuccess: () => { setTitle(""); router.refresh(); } });
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("tasks.checklistPlaceholder")} aria-label={t("tasks.addChecklist")} dir="auto" />
            <Button type="submit" variant="outline" disabled={pending}>
              <Plus /> {t("common.add")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/** Comments with @mention autocomplete (mentioned people get notified). */
function Comments({ task, people, canComment, canManage, meId }: { task: TaskDTO; people: Person[]; canComment: boolean; canManage: boolean; meId: string }) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [body, setBody] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const suggestions = useMemo(
    () => (query == null ? [] : people.filter((p) => p.id !== meId && p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)),
    [query, people, meId],
  );

  const caret = useRef<number | null>(null);
  function onChange(v: string) {
    setBody(v);
    const pos = ref.current?.selectionStart ?? v.length;
    const m = /(^|\s)@([\p{L}\p{N}_.-]*)$/u.exec(v.slice(0, pos));
    setQuery(m ? m[2] : null);
  }
  function pick(p: Person) {
    const el = ref.current;
    const pos = el?.selectionStart ?? body.length;
    const before = body.slice(0, pos).replace(/@([\p{L}\p{N}_.-]*)$/u, `@${p.name} `);
    const next = before + body.slice(pos);
    caret.current = before.length;
    setBody(next);
    setQuery(null);
    el?.focus();
  }
  // Place the caret right after the inserted mention before the next keystroke can land.
  useLayoutEffect(() => {
    if (caret.current == null || !ref.current) return;
    ref.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [body]);
  const mentionIds = () => people.filter((p) => body.includes(`@${p.name}`)).map((p) => p.id);
  const name = (id: string) => people.find((p) => p.id === id)?.name;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("tasks.comments")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {task.comments.length === 0 && <p className="text-sm text-muted-foreground">{t("tasks.noComments")}</p>}
        <ol className="space-y-3">
          {task.comments.map((c) => (
            <li key={c.id} className="rounded-lg border p-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">{c.author?.name ?? "—"}</span> · {f.dateTime(c.createdAt)}
                </span>
                {(c.author?.id === meId || canManage) && (
                  <Button variant="ghost" size="icon-xs" aria-label={t("tasks.deleteComment")} onClick={() => run(() => deleteCommentAction(c.id), { onSuccess: () => router.refresh() })}>
                    <Trash2 />
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm" dir="auto">
                {highlightMentions(c.body, c.mentions.map(name).filter((x): x is string => !!x))}
              </p>
            </li>
          ))}
        </ol>
        {canComment && (
          <form
            className="relative space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!body.trim()) return;
              run(() => addCommentAction(task.id, body, mentionIds()), { onSuccess: () => { setBody(""); router.refresh(); } });
            }}
          >
            <Textarea
              ref={ref}
              value={body}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (suggestions.length && (e.key === "Enter" || e.key === "Tab")) { e.preventDefault(); pick(suggestions[0]); }
                if (e.key === "Escape") setQuery(null);
              }}
              placeholder={t("tasks.commentPlaceholder")}
              aria-label={t("tasks.comments")}
              rows={3}
              dir="auto"
            />
            {suggestions.length > 0 && (
              <ul role="listbox" aria-label={t("tasks.assignees")} className="absolute z-10 mt-1 w-64 rounded-lg border bg-popover p-1 shadow-md">
                {suggestions.map((p) => (
                  <li key={p.id}>
                    <button type="button" role="option" aria-selected={false} onClick={() => pick(p)} className="w-full rounded px-2 py-1 text-start text-sm hover:bg-accent">
                      @{p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={pending || !body.trim()}>
                {pending ? <Loader2 className="animate-spin" /> : <Send className="rtl:-scale-x-100" />} {t("tasks.postComment")}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function TimeLog({ task, canWork, canManage, meId, today, logged }: { task: TaskDTO; canWork: boolean; canManage: boolean; meId: string; today: string; logged: number }) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [v, setV] = useState({ date: today.slice(0, 10), hours: "", note: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const byPerson = [...task.timeLogs.reduce((m, l) => m.set(l.user.name, (m.get(l.user.name) ?? 0) + l.hours), new Map<string, number>())];
  const over = task.estimatedHours != null && logged > task.estimatedHours;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("tasks.timeLog")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className={cn("font-medium", over && "text-destructive")}>
          {t("tasks.estimatedVsActual", { actual: f.number(logged, 0), estimated: task.estimatedHours != null ? f.number(task.estimatedHours, 0) : "—" })}
        </p>
        {byPerson.length > 0 && (
          <ul className="text-xs text-muted-foreground">
            {byPerson.map(([n, h]) => <li key={n}>{n}: <span className="num">{f.number(h, 0)}</span> h</li>)}
          </ul>
        )}
        {canWork && (
          <form
            className="grid grid-cols-2 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => logTimeAction(task.id, v), { success: "tasks.saved", onSuccess: () => { setV({ ...v, hours: "", note: "" }); setErr({}); router.refresh(); }, onError: (r) => setErr(r.fieldErrors ?? {}) });
            }}
          >
            <FormField label={t("tasks.date")} htmlFor="tl-date" error={err.date}>
              <Input id="tl-date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
            </FormField>
            <FormField label={t("tasks.hours")} htmlFor="tl-hours" error={err.hours}>
              <Input id="tl-hours" inputMode="decimal" dir="ltr" value={v.hours} onChange={(e) => setV({ ...v, hours: e.target.value })} />
            </FormField>
            <FormField label={t("tasks.note")} htmlFor="tl-note" className="col-span-2">
              <Input id="tl-note" dir="auto" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
            </FormField>
            <Button type="submit" variant="outline" size="sm" className="col-span-2" disabled={pending}>
              <Plus /> {t("tasks.logTime")}
            </Button>
          </form>
        )}
        {task.timeLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("tasks.noTime")}</p>
        ) : (
          <ul className="divide-y text-xs">
            {task.timeLogs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-1.5">
                <span>
                  {f.date(l.date)} · {l.user.name} · <span className="num font-medium">{f.number(l.hours, 2)} h</span>
                  {l.note && <span className="text-muted-foreground" dir="auto"> — {l.note}</span>}
                </span>
                {(l.user.id === meId || canManage) && (
                  <Button variant="ghost" size="icon-xs" aria-label={t("common.delete")} onClick={() => run(() => deleteTimeLogAction(l.id), { onSuccess: () => router.refresh() })}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DueHistory({ task }: { task: TaskDTO }) {
  const t = useTranslations();
  const f = useFmt();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("tasks.dueHistory")}</CardTitle>
      </CardHeader>
      <CardContent>
        {task.dueChanges.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("tasks.noHistory")}</p>
        ) : (
          <ol className="space-y-3 text-sm">
            {task.dueChanges.map((c) => (
              <li key={c.id} className="border-s-2 border-primary/40 ps-3">
                <p className="font-medium">
                  {f.date(c.oldDate)} <span aria-hidden>→</span>
                  <span className="sr-only">{t("tasks.newDate")}</span> {f.date(c.newDate)}
                </p>
                <p dir="auto">{c.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {c.by} · {f.dateTime(c.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function DueDateDialog({ open, onOpenChange, task, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; task: TaskDTO; onDone: () => void }) {
  const t = useTranslations();
  const { pending, run } = useServerAction();
  const [date, setDate] = useState(task.dueDate?.slice(0, 10) ?? "");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) { setDate(task.dueDate?.slice(0, 10) ?? ""); setReason(""); setErr({}); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("tasks.changeDueDate")}</DialogTitle>
          <DialogDescription dir="auto">{task.title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label={t("tasks.newDate")} htmlFor="dd-date" error={err.newDate}>
            <Input id="dd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField label={t("tasks.changeReason")} htmlFor="dd-reason" error={err.reason} required>
            <Textarea id="dd-reason" rows={3} dir="auto" value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={pending} onClick={() => run(() => changeDueDateAction(task.id, { newDate: date, reason }), { success: "tasks.saved", onSuccess: () => { onOpenChange(false); onDone(); }, onError: (r) => setErr(r.fieldErrors ?? {}) })}>
            {pending && <Loader2 className="animate-spin" />} {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTaskDialog({ open, onOpenChange, task, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; task: TaskDTO; onDone: () => void }) {
  const t = useTranslations();
  const { pending, run } = useServerAction();
  const init = { title: task.title, scope: task.scope ?? "", price: task.price?.toString() ?? "", estimatedHours: task.estimatedHours?.toString() ?? "", startDate: task.startDate?.slice(0, 10) ?? "" };
  const [v, setV] = useState(init);
  const [err, setErr] = useState<Record<string, string>>({});
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) { setV(init); setErr({}); } }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{t("common.edit")}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("tasks.taskTitle")} htmlFor="et-title" error={err.title} required className="sm:col-span-2">
            <Input id="et-title" dir="auto" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </FormField>
          <FormField label={t("tasks.scope")} htmlFor="et-scope" className="sm:col-span-2">
            <Textarea id="et-scope" dir="auto" rows={4} value={v.scope} onChange={(e) => setV({ ...v, scope: e.target.value })} />
          </FormField>
          <FormField label={t("tasks.price")} htmlFor="et-price" error={err.price}>
            <Input id="et-price" inputMode="decimal" dir="ltr" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} />
          </FormField>
          <FormField label={t("tasks.estimatedHours")} htmlFor="et-hours" error={err.estimatedHours}>
            <Input id="et-hours" inputMode="decimal" dir="ltr" value={v.estimatedHours} onChange={(e) => setV({ ...v, estimatedHours: e.target.value })} />
          </FormField>
          <FormField label={t("tasks.startDate")} htmlFor="et-start" error={err.startDate}>
            <Input id="et-start" type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={pending} onClick={() => run(() => updateTaskAction(task.id, v), { success: "tasks.saved", onSuccess: () => { onOpenChange(false); onDone(); }, onError: (r) => setErr(r.fieldErrors ?? {}) })}>
            {pending && <Loader2 className="animate-spin" />} {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/** Highlight "@Full Name" for the people actually mentioned (names can contain spaces). */
function highlightMentions(body: string, names: string[]) {
  if (!names.length) return body;
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(@(?:${names.sort((a, b) => b.length - a.length).map(esc).join("|")}))`, "gu");
  return body.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="rounded bg-accent px-0.5 font-medium text-accent-foreground">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
