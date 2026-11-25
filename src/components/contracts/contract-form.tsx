"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { useFmt } from "@/components/shared/format-provider";
import { contractSchema } from "@/lib/validation/contract";
import { baseAmc, defaultAmcStartDate, generateAmcSchedule, totalAmc } from "@/lib/amc/engine";
import { CURRENCIES } from "@/lib/currencies";
import { cn } from "@/lib/utils";
import { createContractAction, updateContractAction } from "@/server/actions/contracts";
import type { LookupOption } from "@/server/services/lookups";

export type ContractFormValues = {
  clientId: string;
  title: string;
  productIds: string[];
  contractDate: string;
  startDate: string;
  endDate: string;
  value: string;
  currency: string;
  paymentTerms: string;
  status: "DRAFT" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  notes: string;
  amcEnabled: boolean;
  amcPercent: string;
  amcIncreasePercent: string;
  amcMethod: "COMPOUND" | "SIMPLE";
  amcStartDate: string;
  amcYears: string;
};

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
const toNum = (s: string) => (s === "" ? NaN : Number(String(s).replace(/,/g, "")));

export function ContractForm({
  contractId,
  defaultValues,
  clients,
  products,
  paymentTerms,
}: {
  contractId?: string;
  defaultValues: ContractFormValues;
  clients: { id: string; nameAr: string; nameEn: string; code: string }[];
  products: LookupOption[];
  paymentTerms: LookupOption[];
}) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const { register, control, handleSubmit, setError, setValue, formState } = useForm<ContractFormValues>({
    defaultValues,
    resolver: zodResolver(contractSchema, undefined, { raw: true }) as unknown as Resolver<ContractFormValues>,
  });
  const err = (k: keyof ContractFormValues) => formState.errors[k]?.message;
  const w = useWatch({ control });

  // Live AMC preview (no overrides; saved overrides/paid years are applied server-side).
  const preview = useMemo(() => {
    const value = toNum(w.value ?? "");
    const pct = toNum(w.amcPercent ?? "");
    const inc = toNum(w.amcIncreasePercent ?? "");
    const years = Math.min(30, Math.trunc(toNum(w.amcYears ?? "")));
    if (!w.amcEnabled || !isDate(w.contractDate ?? "") || [value, pct, inc, years].some((n) => !Number.isFinite(n)) || years < 1) return null;
    const contractDate = new Date(`${w.contractDate}T00:00:00Z`);
    const start = isDate(w.amcStartDate ?? "") ? new Date(`${w.amcStartDate}T00:00:00Z`) : defaultAmcStartDate(contractDate);
    const lines = generateAmcSchedule({ contractValue: value, amcPercent: pct, increasePercent: inc, method: w.amcMethod ?? "COMPOUND", startDate: start, years });
    return { lines, base: baseAmc(value, pct), total: totalAmc(lines), defaultStart: defaultAmcStartDate(contractDate) };
  }, [w]);

  const onSubmit = handleSubmit((values) =>
    run(() => (contractId ? updateContractAction(contractId, values) : createContractAction(values)), {
      success: contractId ? "contracts.updated" : "contracts.created",
      onSuccess: (d) => {
        router.push(`/contracts/${d.id}`);
        router.refresh();
      },
      onError: (r) => Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => setError(k as keyof ContractFormValues, { message: m })),
    }),
  );
  const cur = w.currency || "EGP";

  return (
    <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-5 [&>*]:min-w-0" noValidate>
      <div className="space-y-6 xl:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("contracts.details")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField label={t("contracts.client")} error={err("clientId")} required className="md:col-span-2">
              <Controller
                control={control}
                name="clientId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" aria-invalid={!!err("clientId")}>
                      <SelectValue placeholder={t("common.select")} />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {f.name(c)} <span className="text-muted-foreground" dir="ltr">({c.code})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label={t("contracts.products")} error={formState.errors.productIds?.message} required className="md:col-span-2">
              <Controller
                control={control}
                name="productIds"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2" role="group" aria-label={t("contracts.products")}>
                    {products.map((p) => {
                      const on = field.value.includes(p.id);
                      return (
                        <Button
                          key={p.id}
                          type="button"
                          size="sm"
                          variant={on ? "default" : "outline"}
                          aria-pressed={on}
                          onClick={() => field.onChange(on ? field.value.filter((x) => x !== p.id) : [...field.value, p.id])}
                        >
                          {on && <Check />} {f.name(p)}
                        </Button>
                      );
                    })}
                  </div>
                )}
              />
            </FormField>
            <FormField label={t("contracts.contractTitle")} htmlFor="title" className="md:col-span-2">
              <Input id="title" {...register("title")} />
            </FormField>
            <FormField label={t("contracts.contractDate")} htmlFor="contractDate" error={err("contractDate")} required>
              <Input id="contractDate" type="date" {...register("contractDate")} aria-invalid={!!err("contractDate")} />
            </FormField>
            <FormField label={t("contracts.startDate")} htmlFor="startDate" error={err("startDate")} required>
              <Input id="startDate" type="date" {...register("startDate")} aria-invalid={!!err("startDate")} />
            </FormField>
            <FormField label={t("contracts.endDate")} htmlFor="endDate" error={err("endDate")}>
              <Input id="endDate" type="date" {...register("endDate")} aria-invalid={!!err("endDate")} />
            </FormField>
            <FormField label={t("contracts.status")}>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["DRAFT", "ACTIVE", "EXPIRED", "CANCELLED"] as const).map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`contractStatus.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label={t("contracts.value")} htmlFor="value" error={err("value")} required>
              <Input id="value" inputMode="decimal" dir="ltr" {...register("value")} aria-invalid={!!err("value")} />
            </FormField>
            <FormField label={t("contracts.currency")} error={err("currency")}>
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
            <FormField label={t("contracts.paymentTerms")} htmlFor="paymentTerms" className="md:col-span-2">
              <Input id="paymentTerms" list="payment-terms" {...register("paymentTerms")} />
              <datalist id="payment-terms">
                {paymentTerms.flatMap((p) => [p.labelAr, p.labelEn]).map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </FormField>
            <FormField label={t("contracts.notes")} htmlFor="notes" className="md:col-span-2">
              <Textarea id="notes" rows={3} {...register("notes")} />
            </FormField>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 xl:col-span-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>{t("contracts.amcSection")}</CardTitle>
            <Controller
              control={control}
              name="amcEnabled"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={t("contracts.amcEnabled")} />
                  <span className="hidden sm:inline">{t("contracts.amcEnabled")}</span>
                </label>
              )}
            />
          </CardHeader>
          <CardContent className={cn("grid gap-4 sm:grid-cols-2", !w.amcEnabled && "pointer-events-none opacity-50")}>
            <FormField label={t("contracts.amcPercent")} htmlFor="amcPercent" error={err("amcPercent")}>
              <Input id="amcPercent" inputMode="decimal" dir="ltr" {...register("amcPercent")} aria-invalid={!!err("amcPercent")} />
            </FormField>
            <FormField label={t("contracts.amcIncrease")} htmlFor="amcIncreasePercent" error={err("amcIncreasePercent")}>
              <Input id="amcIncreasePercent" inputMode="decimal" dir="ltr" {...register("amcIncreasePercent")} aria-invalid={!!err("amcIncreasePercent")} />
            </FormField>
            <FormField label={t("contracts.amcMethod")} className="sm:col-span-2">
              <Controller
                control={control}
                name="amcMethod"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPOUND">{t("amcMethod.COMPOUND")}</SelectItem>
                      <SelectItem value="SIMPLE">{t("amcMethod.SIMPLE")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField
              label={t("contracts.amcStartDate")}
              htmlFor="amcStartDate"
              error={err("amcStartDate")}
              hint={preview ? t("contracts.amcStartHint", { date: f.date(preview.defaultStart) }) : undefined}
            >
              <div className="flex gap-1">
                <Input id="amcStartDate" type="date" {...register("amcStartDate")} />
                {w.amcStartDate && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setValue("amcStartDate", "")}>
                    {t("common.clear")}
                  </Button>
                )}
              </div>
            </FormField>
            <FormField label={t("contracts.amcYears")} htmlFor="amcYears" error={err("amcYears")}>
              <Input id="amcYears" type="number" min={1} max={30} dir="ltr" {...register("amcYears")} aria-invalid={!!err("amcYears")} />
            </FormField>
          </CardContent>
        </Card>

        {w.amcEnabled && (
          <Card>
            <CardHeader>
              <CardTitle>{t("contracts.preview")}</CardTitle>
              <CardDescription>{contractId ? t("contracts.previewHint") : null}</CardDescription>
            </CardHeader>
            <CardContent>
              {preview ? (
                <>
                  <p className="mb-3 text-sm">
                    {t("contracts.baseAmc")}: <span className="num font-semibold">{f.money(preview.base, cur)}</span>
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("amc.year")}</TableHead>
                        <TableHead>{t("amc.dueDate")}</TableHead>
                        <TableHead className="text-end">{t("amc.increase")}</TableHead>
                        <TableHead className="text-end">{t("amc.amount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.lines.map((l) => (
                        <TableRow key={l.yearIndex}>
                          <TableCell>{f.number(l.yearIndex)}</TableCell>
                          <TableCell>{f.date(l.dueDate)}</TableCell>
                          <TableCell className="num text-end">{f.number(l.increasePercent, 0)}%</TableCell>
                          <TableCell className="num text-end">{f.money(l.amount, cur)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3}>{t("amc.total")}</TableCell>
                        <TableCell className="num text-end">{f.money(preview.total, cur)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>
        )}

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
