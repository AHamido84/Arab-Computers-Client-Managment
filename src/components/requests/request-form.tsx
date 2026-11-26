"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { useFmt } from "@/components/shared/format-provider";
import { TotalsSummary } from "@/components/shared/totals-summary";
import { PRIORITIES, REQUEST_STATUSES, requestSchema } from "@/lib/validation/request";
import { computeTotals, lineTotal } from "@/lib/totals";
import { CURRENCIES } from "@/lib/currencies";
import { createRequestAction, updateRequestAction } from "@/server/actions/requests";
import type { LookupOption } from "@/server/services/lookups";

const NONE = "__none";

export type RequestFormValues = {
  clientId: string;
  contractId: string;
  typeId: string;
  title: string;
  description: string;
  priority: (typeof PRIORITIES)[number];
  assigneeId: string;
  requestDate: string;
  dueDate: string;
  estimatedHours: string;
  status: (typeof REQUEST_STATUSES)[number];
  currency: string;
  discount: string;
  vatPercent: string;
  items: { item: string; description: string; qty: string; unitPrice: string }[];
};

type ClientOpt = { id: string; nameAr: string; nameEn: string; code: string };
type ContractOpt = { id: string; number: string; clientId: string };

export function RequestForm({
  requestId,
  defaultValues,
  clients,
  contracts,
  types,
  users,
}: {
  requestId?: string;
  defaultValues: RequestFormValues;
  clients: ClientOpt[];
  contracts: ContractOpt[];
  types: LookupOption[];
  users: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const { register, control, handleSubmit, setError, setValue, formState } = useForm<RequestFormValues>({
    defaultValues,
    resolver: zodResolver(requestSchema, undefined, { raw: true }) as unknown as Resolver<RequestFormValues>,
  });
  const items = useFieldArray({ control, name: "items" });
  const w = useWatch({ control });
  const totals = useMemo(() => computeTotals(w.items ?? [], w.discount, w.vatPercent), [w.items, w.discount, w.vatPercent]);
  const clientContracts = contracts.filter((c) => c.clientId === w.clientId);
  const err = (path: string) => {
    let e: unknown = formState.errors;
    for (const p of path.split(".")) e = (e as Record<string, unknown> | undefined)?.[p];
    return (e as { message?: string } | undefined)?.message;
  };

  const onSubmit = handleSubmit((values) =>
    run(() => (requestId ? updateRequestAction(requestId, values) : createRequestAction(values)), {
      success: requestId ? "requests.updated" : "requests.created",
      onSuccess: (d) => {
        router.push(`/requests/${d.id}`);
        router.refresh();
      },
      onError: (r) => Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => setError(k as never, { message: m })),
    }),
  );

  const sel = (name: "typeId" | "assigneeId" | "contractId", options: { value: string; label: string }[], noneLabel: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{noneLabel}</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{t("requests.details")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField label={t("requests.client")} error={err("clientId")} required className="md:col-span-2">
            <Controller
              control={control}
              name="clientId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    setValue("contractId", "");
                  }}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!err("clientId")}>
                    <SelectValue placeholder={t("common.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {f.name(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("requests.contract")} className="md:col-span-2">
            {sel("contractId", clientContracts.map((c) => ({ value: c.id, label: c.number })), t("requests.noContract"))}
          </FormField>
          <FormField label={t("requests.requestTitle")} htmlFor="title" error={err("title")} required className="md:col-span-2 xl:col-span-4">
            <Input id="title" {...register("title")} aria-invalid={!!err("title")} />
          </FormField>
          <FormField label={t("requests.description")} htmlFor="description" className="md:col-span-2 xl:col-span-4">
            <Textarea id="description" rows={4} {...register("description")} />
          </FormField>
          <FormField label={t("requests.type")}>{sel("typeId", types.map((x) => ({ value: x.id, label: f.name(x) })), "—")}</FormField>
          <FormField label={t("requests.priority")}>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {t(`priority.${p}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("requests.status")}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`requestStatus.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("requests.assignee")}>{sel("assigneeId", users.map((u) => ({ value: u.id, label: u.name })), t("requests.unassigned"))}</FormField>
          <FormField label={t("requests.requestDate")} htmlFor="requestDate" error={err("requestDate")} required>
            <Input id="requestDate" type="date" {...register("requestDate")} />
          </FormField>
          <FormField label={t("requests.dueDate")} htmlFor="dueDate" error={err("dueDate")}>
            <Input id="dueDate" type="date" {...register("dueDate")} aria-invalid={!!err("dueDate")} />
          </FormField>
          <FormField label={t("requests.estimatedHours")} htmlFor="estimatedHours" error={err("estimatedHours")}>
            <Input id="estimatedHours" inputMode="decimal" dir="ltr" {...register("estimatedHours")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("requests.items")}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => items.append({ item: "", description: "", qty: "1", unitPrice: "0" })}>
            <Plus /> {t("requests.addItem")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.fields.length === 0 && <p className="text-sm text-muted-foreground">{t("requests.noItems")}</p>}
          {items.fields.map((it, i) => (
            <div key={it.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-12 md:items-start">
              <FormField label={t("requests.item")} error={err(`items.${i}.item`)} className="md:col-span-3">
                <Input {...register(`items.${i}.item`)} aria-invalid={!!err(`items.${i}.item`)} />
              </FormField>
              <FormField label={t("requests.itemDescription")} className="md:col-span-4">
                <Input {...register(`items.${i}.description`)} />
              </FormField>
              <FormField label={t("requests.qty")} error={err(`items.${i}.qty`)} className="md:col-span-1">
                <Input inputMode="decimal" dir="ltr" {...register(`items.${i}.qty`)} aria-invalid={!!err(`items.${i}.qty`)} />
              </FormField>
              <FormField label={t("requests.unitPrice")} error={err(`items.${i}.unitPrice`)} className="md:col-span-2">
                <Input inputMode="decimal" dir="ltr" {...register(`items.${i}.unitPrice`)} aria-invalid={!!err(`items.${i}.unitPrice`)} />
              </FormField>
              <div className="flex items-end justify-between gap-2 md:col-span-2 md:h-full">
                <div className="grid gap-1.5">
                  <span className="text-sm font-medium">{t("requests.lineTotal")}</span>
                  <span className="num flex h-8 items-center text-sm">{f.money(lineTotal(w.items?.[i] ?? { qty: 0, unitPrice: 0 }), w.currency || "EGP")}</span>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => items.remove(i)} aria-label={t("common.delete")}>
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </div>
          ))}

          <div className="grid gap-6 pt-2 md:grid-cols-2">
            <div className="grid grid-cols-3 gap-3">
              <FormField label={t("contracts.currency")}>
                <Controller
                  control={control}
                  name="currency"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label={t("requests.discountAmount")} htmlFor="discount" error={err("discount")}>
                <Input id="discount" inputMode="decimal" dir="ltr" {...register("discount")} />
              </FormField>
              <FormField label={t("requests.vatPercent")} htmlFor="vatPercent" error={err("vatPercent")}>
                <Input id="vatPercent" inputMode="decimal" dir="ltr" {...register("vatPercent")} />
              </FormField>
            </div>
            <TotalsSummary totals={totals} currency={w.currency || "EGP"} className="rounded-lg bg-muted/50 p-4" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
