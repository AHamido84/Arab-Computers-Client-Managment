"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { useFmt } from "@/components/shared/format-provider";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { TotalsSummary } from "@/components/shared/totals-summary";
import { quotationSchema } from "@/lib/validation/quotation";
import { computeTotals, lineTotal } from "@/lib/totals";
import { CURRENCIES } from "@/lib/currencies";
import { DEFAULT_QUOTATION_TERMS } from "@/lib/templates/defaults";
import { createQuotationAction, updateQuotationAction } from "@/server/actions/quotations";
import { getQuotableRequestsAction } from "@/server/actions/lookups-read";
import type { QuotableRequest } from "@/server/services/requests";

export type QuotationItemValues = {
  requestId: string;
  title: string;
  scope: string;
  startDate: string;
  dueDate: string;
  qty: string;
  unitPrice: string;
};
export type QuotationFormValues = {
  clientId: string;
  title: string;
  lang: "ar" | "en";
  issueDate: string;
  validUntil: string;
  currency: string;
  discount: string;
  vatPercent: string;
  introText: string;
  terms: string;
  items: QuotationItemValues[];
};

type ClientOpt = { id: string; nameAr: string; nameEn: string; code: string; preferredLang: "ar" | "en" };

const emptyItem: QuotationItemValues = { requestId: "", title: "", scope: "", startDate: "", dueDate: "", qty: "1", unitPrice: "0" };

function itemsFromRequest(r: QuotableRequest): QuotationItemValues[] {
  if (!r.items.length) return [{ ...emptyItem, requestId: r.id, title: r.title, scope: r.description ?? "", dueDate: r.dueDate }];
  return r.items.map((i) => ({
    requestId: r.id,
    title: i.item,
    scope: i.description ?? r.title,
    startDate: "",
    dueDate: r.dueDate,
    qty: String(i.qty),
    unitPrice: String(i.unitPrice),
  }));
}

export function QuotationForm({
  quotationId,
  defaultValues,
  clients,
  initialRequests,
  intros,
}: {
  quotationId?: string;
  defaultValues: QuotationFormValues;
  clients: ClientOpt[];
  initialRequests: QuotableRequest[];
  /** Default introduction text per language (from the QUOTATION document template). */
  intros: { ar: string; en: string };
}) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [requests, setRequests] = useState(initialRequests);
  const [loadingReqs, startLoading] = useTransition();
  const { register, control, handleSubmit, setError, setValue, getValues, formState } = useForm<QuotationFormValues>({
    defaultValues,
    resolver: zodResolver(quotationSchema, undefined, { raw: true }) as unknown as Resolver<QuotationFormValues>,
  });
  const items = useFieldArray({ control, name: "items" });
  const w = useWatch({ control });
  const totals = useMemo(() => computeTotals(w.items ?? [], w.discount, w.vatPercent), [w.items, w.discount, w.vatPercent]);
  const selected = new Set((w.items ?? []).map((i) => i?.requestId).filter(Boolean));
  const cur = w.currency || "EGP";
  const err = (path: string) => {
    if (path === "items") return formState.errors.items?.message ?? formState.errors.items?.root?.message;
    let e: unknown = formState.errors;
    for (const p of path.split(".")) e = (e as Record<string, unknown> | undefined)?.[p];
    return (e as { message?: string } | undefined)?.message;
  };

  function onClientChange(id: string) {
    setValue("clientId", id, { shouldValidate: true });
    // Drop items tied to the previous client's requests.
    const keep = getValues("items").filter((i) => !i.requestId);
    setValue("items", keep);
    const c = clients.find((x) => x.id === id);
    if (c) setLang(c.preferredLang);
    startLoading(async () => setRequests(await getQuotableRequestsAction(id)));
  }

  /** Switch document language; replace intro/terms only if they still hold the other language's defaults. */
  function setLang(lang: "ar" | "en") {
    const prev = getValues("lang");
    setValue("lang", lang);
    if (prev === lang) return;
    if (!getValues("terms") || getValues("terms") === DEFAULT_QUOTATION_TERMS[prev]) setValue("terms", DEFAULT_QUOTATION_TERMS[lang]);
    if (!getValues("introText") || getValues("introText") === intros[prev]) setValue("introText", intros[lang]);
  }

  function toggleRequest(r: QuotableRequest, on: boolean) {
    const current = getValues("items");
    if (on) {
      const base = current.length === 1 && !current[0].title && !current[0].requestId ? [] : current;
      setValue("items", [...base, ...itemsFromRequest(r)], { shouldValidate: formState.isSubmitted });
      if (!getValues("title")) setValue("title", r.title);
    } else {
      setValue("items", current.filter((i) => i.requestId !== r.id));
    }
  }

  const onSubmit = handleSubmit((values) =>
    run(() => (quotationId ? updateQuotationAction(quotationId, values) : createQuotationAction(values)), {
      success: quotationId ? "quotations.updated" : "quotations.created",
      onSuccess: (d) => {
        router.push(`/quotations/${d.id}`);
        router.refresh();
      },
      onError: (r) => Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => setError(k as never, { message: m })),
    }),
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0" noValidate>
      <div className="space-y-6 xl:col-span-2">
        <Card>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField label={t("quotations.client")} error={err("clientId")} required className="md:col-span-2">
              <Select value={w.clientId} onValueChange={onClientChange} disabled={!!quotationId}>
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
            </FormField>
            <FormField label={t("quotations.lang")}>
              <Select value={w.lang} onValueChange={(v) => setLang(v as "ar" | "en")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">{t("languages.ar")}</SelectItem>
                  <SelectItem value="en">{t("languages.en")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
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
            <FormField label={t("quotations.quotationTitle")} htmlFor="qtitle" className="md:col-span-2">
              <Input id="qtitle" dir="auto" {...register("title")} />
            </FormField>
            <FormField label={t("quotations.issueDate")} htmlFor="issueDate" error={err("issueDate")} required>
              <Input id="issueDate" type="date" {...register("issueDate")} />
            </FormField>
            <FormField label={t("quotations.validUntil")} htmlFor="validUntil" error={err("validUntil")} required>
              <Input id="validUntil" type="date" {...register("validUntil")} aria-invalid={!!err("validUntil")} />
            </FormField>
            <FormField label={t("quotations.introText")} htmlFor="introText" className="md:col-span-2 xl:col-span-4">
              <Textarea id="introText" rows={3} dir={w.lang === "ar" ? "rtl" : "ltr"} {...register("introText")} />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("quotations.items")}</CardTitle>
              {err("items") && (
                <p className="mt-1 text-xs text-destructive" role="alert">
                  {t(err("items")!)}
                </p>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => items.append(emptyItem)}>
              <Plus /> {t("quotations.addItem")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.fields.map((it, i) => {
              const req = requests.find((r) => r.id === w.items?.[i]?.requestId);
              return (
                <div key={it.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {i + 1}
                      {req && (
                        <>
                          {" · "}
                          <span dir="ltr">{req.number}</span>
                        </>
                      )}
                    </span>
                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => items.remove(i)} aria-label={t("common.delete")}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-12">
                    <FormField label={t("quotations.itemTitle")} error={err(`items.${i}.title`)} className="md:col-span-6">
                      <Input dir="auto" {...register(`items.${i}.title`)} aria-invalid={!!err(`items.${i}.title`)} />
                    </FormField>
                    <FormField label={t("quotations.startDate")} className="md:col-span-3">
                      <Input type="date" {...register(`items.${i}.startDate`)} />
                    </FormField>
                    <FormField label={t("quotations.dueDate")} className="md:col-span-3">
                      <Input type="date" {...register(`items.${i}.dueDate`)} />
                    </FormField>
                    <FormField label={t("quotations.scope")} className="md:col-span-12">
                      <Textarea rows={2} dir="auto" {...register(`items.${i}.scope`)} />
                    </FormField>
                    <FormField label={t("quotations.qty")} error={err(`items.${i}.qty`)} className="md:col-span-3">
                      <Input inputMode="decimal" dir="ltr" {...register(`items.${i}.qty`)} />
                    </FormField>
                    <FormField label={t("quotations.unitPrice")} error={err(`items.${i}.unitPrice`)} className="md:col-span-4">
                      <Input inputMode="decimal" dir="ltr" {...register(`items.${i}.unitPrice`)} />
                    </FormField>
                    <div className="grid gap-1.5 md:col-span-5">
                      <span className="text-sm font-medium">{t("quotations.lineTotal")}</span>
                      <span className="num flex h-8 items-center text-sm font-medium">{f.money(lineTotal(w.items?.[i] ?? {}), cur)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="grid gap-6 pt-2 md:grid-cols-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField label={t("requests.discountAmount")} htmlFor="discount" error={err("discount")}>
                  <Input id="discount" inputMode="decimal" dir="ltr" {...register("discount")} />
                </FormField>
                <FormField label={t("requests.vatPercent")} htmlFor="vatPercent" error={err("vatPercent")}>
                  <Input id="vatPercent" inputMode="decimal" dir="ltr" {...register("vatPercent")} />
                </FormField>
              </div>
              <TotalsSummary totals={totals} currency={cur} className="rounded-lg bg-muted/50 p-4" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("quotations.terms")}</CardTitle>
            <CardDescription>{t("quotations.termsHint", { example: "{{valid_until}}" })}</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea rows={7} dir={w.lang === "ar" ? "rtl" : "ltr"} {...register("terms")} aria-label={t("quotations.terms")} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle>{t("quotations.fromRequests")}</CardTitle>
            <CardDescription>{t("quotations.fromRequestsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {!w.clientId ? (
              <p className="text-sm text-muted-foreground">{t("quotations.selectClientFirst")}</p>
            ) : loadingReqs ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("quotations.noRequests")}</p>
            ) : (
              <ul className="space-y-2">
                {requests.map((r) => {
                  const on = selected.has(r.id);
                  const sub = r.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
                  return (
                    <li key={r.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/40">
                        <Checkbox checked={on} onCheckedChange={(v) => toggleRequest(r, !!v)} className="mt-0.5" />
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="block font-medium">{r.title}</span>
                          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span dir="ltr">{r.number}</span>
                            <StatusBadge color={STATUS_COLOR[r.status]}>{t(`requestStatus.${r.status}`)}</StatusBadge>
                            {sub > 0 && <span className="num">{f.money(sub, cur)}</span>}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
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
      </div>
    </form>
  );
}
