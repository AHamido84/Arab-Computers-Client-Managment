"use client";

/**
 * Confirmation screen: review generated tasks, adjust dates, split/merge,
 * assign people, then create the delivery project.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Combine, Loader2, Plus, Scissors, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { useFmt } from "@/components/shared/format-provider";
import { PeopleEditor, type Person } from "./people-editor";
import { draftKey, latestDueDate, mergeDrafts, splitDraft, type DraftTask } from "@/lib/delivery";
import { createDeliveryProjectAction } from "@/server/actions/delivery";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type Row = DraftTask & { priority: Priority };

export function DeliverySetup({
  source,
  sourceId,
  clientId,
  reference,
  defaultTitle,
  currency,
  drafts,
  people,
}: {
  source: "QUOTATION" | "CONTRACT";
  sourceId: string;
  clientId: string;
  reference: string;
  defaultTitle: string;
  currency: string;
  drafts: DraftTask[];
  people: Person[];
}) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [title, setTitle] = useState(defaultTitle);
  const [startDate, setStartDate] = useState(drafts.map((d) => d.startDate).filter(Boolean).sort()[0] ?? "");
  const [targetOverride, setTargetOverride] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(drafts.map((d) => ({ ...d, priority: "MEDIUM" })));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const autoTarget = useMemo(() => latestDueDate(rows) ?? "", [rows]);
  const targetDate = targetOverride ?? autoTarget;
  const totalPrice = rows.reduce((s, r) => s + (r.price ?? 0), 0);
  const totalHours = rows.reduce((s, r) => s + (r.estimatedHours ?? 0), 0);

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const err = (i: number, field: string) => errors[`tasks.${i}.${field}`];

  function split(r: Row) {
    setRows((rs) => rs.flatMap((x) => (x.key === r.key ? splitDraft(x).map((p) => ({ ...p, priority: r.priority })) : [x])));
  }
  function merge() {
    const picked = rows.filter((r) => selected.has(r.key));
    if (picked.length < 2) return;
    const merged: Row = { ...mergeDrafts(picked), priority: picked.some((p) => p.priority === "URGENT") ? "URGENT" : picked[0].priority };
    const firstIdx = rows.findIndex((r) => selected.has(r.key));
    setRows((rs) => {
      const rest = rs.filter((r) => !selected.has(r.key));
      rest.splice(firstIdx, 0, merged);
      return rest;
    });
    setSelected(new Set());
  }
  function addRow() {
    setRows((rs) => [...rs, { key: draftKey(), title: "", scope: "", price: null, estimatedHours: null, startDate: "", dueDate: "", requestId: null, quotationItemId: null, assignees: [], watchers: [], priority: "MEDIUM" }]);
  }

  const save = () =>
    run(
      () =>
        createDeliveryProjectAction({
          source,
          sourceId,
          clientId,
          title,
          startDate,
          targetDate,
          tasks: rows.map(({ key: _k, ...r }) => {
            void _k;
            return { ...r, price: r.price ?? "", estimatedHours: r.estimatedHours ?? "" };
          }),
        }),
      {
        success: "delivery.created",
        onSuccess: (d) => {
          router.push(`/delivery/${d.id}`);
          router.refresh();
        },
        onError: (r) => setErrors(r.fieldErrors ?? {}),
      },
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("delivery.confirmTitle")}</CardTitle>
          <CardDescription>{t("delivery.confirmHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <FormField label={t("delivery.projectTitle")} htmlFor="dp-title" error={errors.title} required className="md:col-span-2">
            <Input id="dp-title" dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label={t("delivery.startDate")} htmlFor="dp-start">
            <Input id="dp-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </FormField>
          <FormField label={t("delivery.targetDate")} htmlFor="dp-target" hint={targetOverride === null && autoTarget ? `= ${f.date(autoTarget)}` : undefined}>
            <Input id="dp-target" type="date" value={targetDate} onChange={(e) => setTargetOverride(e.target.value)} />
          </FormField>
          <p className="text-sm text-muted-foreground md:col-span-4">
            <span dir="ltr">{reference}</span> · {t("delivery.tasksCount")}: <span className="num">{rows.length}</span>
            {totalPrice > 0 && <> · {t("tasks.price")}: <span className="num">{f.money(totalPrice, currency)}</span></>}
            {totalHours > 0 && <> · {t("tasks.estimatedHours")}: <span className="num">{f.number(totalHours, 0)}</span></>}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={merge} disabled={selected.size < 2} title={t("delivery.mergeHint")}>
          <Combine /> {t("delivery.merge")} {selected.size >= 2 && `(${selected.size})`}
        </Button>
        <Button type="button" variant="outline" onClick={addRow}>
          <Plus /> {t("delivery.addTask")}
        </Button>
        {errors.tasks && <p className="text-sm text-destructive" role="alert">{t(errors.tasks)}</p>}
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => (
          <Card key={r.key} className={selected.has(r.key) ? "ring-2 ring-primary" : ""}>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  className="mt-2.5"
                  checked={selected.has(r.key)}
                  onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(r.key); else n.delete(r.key); return n; })}
                  aria-label={t("delivery.selectTask", { n: i + 1 })}
                />
                <div className="grid flex-1 gap-3 md:grid-cols-12">
                  <FormField label={t("tasks.taskTitle")} error={err(i, "title")} required className="md:col-span-6">
                    <Input dir="auto" value={r.title} onChange={(e) => update(r.key, { title: e.target.value })} aria-invalid={!!err(i, "title")} />
                  </FormField>
                  <FormField label={t("tasks.startDate")} className="md:col-span-2">
                    <Input type="date" value={r.startDate} onChange={(e) => update(r.key, { startDate: e.target.value })} />
                  </FormField>
                  <FormField label={t("tasks.dueDate")} error={err(i, "dueDate")} className="md:col-span-2">
                    <Input type="date" value={r.dueDate} onChange={(e) => update(r.key, { dueDate: e.target.value })} />
                  </FormField>
                  <FormField label={t("tasks.priority")} className="md:col-span-2">
                    <Select value={r.priority} onValueChange={(v) => update(r.key, { priority: v as Priority })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={t("tasks.scope")} className="md:col-span-8">
                    <Textarea dir="auto" rows={2} value={r.scope} onChange={(e) => update(r.key, { scope: e.target.value })} />
                  </FormField>
                  <FormField label={`${t("tasks.price")} (${currency})`} error={err(i, "price")} className="md:col-span-2">
                    <Input inputMode="decimal" dir="ltr" value={r.price ?? ""} onChange={(e) => update(r.key, { price: num(e.target.value) })} />
                  </FormField>
                  <FormField label={t("tasks.estimatedHours")} error={err(i, "estimatedHours")} className="md:col-span-2">
                    <Input inputMode="decimal" dir="ltr" value={r.estimatedHours ?? ""} onChange={(e) => update(r.key, { estimatedHours: num(e.target.value) })} />
                  </FormField>
                  <div className="md:col-span-12">
                    <p className="mb-1 text-sm font-medium">{t("tasks.assignees")}</p>
                    <PeopleEditor people={people} assignees={r.assignees} watchers={r.watchers} onChange={(p) => update(r.key, p)} />
                    {err(i, "assignees") && <p className="mt-1 text-xs text-destructive" role="alert">{t(err(i, "assignees")!)}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => split(r)} aria-label={`${t("delivery.split")} ${i + 1}`} title={t("delivery.split")}>
                    <Scissors />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`${t("delivery.removeTask")} ${i + 1}`} title={t("delivery.removeTask")}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>{t("common.cancel")}</Button>
        <Button onClick={save} disabled={pending || rows.length === 0}>
          {pending && <Loader2 className="animate-spin" />} {t("delivery.createProject")}
        </Button>
      </div>
    </div>
  );
}
