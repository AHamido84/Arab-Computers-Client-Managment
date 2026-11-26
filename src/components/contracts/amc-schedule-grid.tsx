"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Banknote, FileText, Loader2, Lock, Mail, MoreHorizontal, RotateCcw, SlidersHorizontal, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { useFmt } from "@/components/shared/format-provider";
import { amcLineOverrideSchema, amcPaymentSchema } from "@/lib/validation/contract";
import { toDateInput } from "@/lib/validation/common";
import { markAmcPaidAction, resetAmcOverridesAction, unmarkAmcPaidAction, updateAmcLineAction } from "@/server/actions/contracts";
import type { AmcLineDTO } from "@/server/services/contracts";
import { cn } from "@/lib/utils";

type Props = {
  contractId: string;
  lines: AmcLineDTO[];
  currency: string;
  defaultIncrease: number;
  canWrite: boolean;
  canEmail: boolean;
  docLang: "ar" | "en";
  today: string;
};

export function AmcScheduleGrid({ contractId, lines, currency, defaultIncrease, canWrite, canEmail, docLang, today }: Props) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const { run } = useServerAction();
  const [adjust, setAdjust] = useState<AmcLineDTO | null>(null);
  const [pay, setPay] = useState<AmcLineDTO | null>(null);

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const collected = lines.filter((l) => l.status === "PAID").reduce((s, l) => s + (l.paidAmount ?? l.amount), 0);
  const outstanding = lines.filter((l) => l.status !== "PAID").reduce((s, l) => s + l.amount, 0);
  const hasOverrides = lines.some((l) => l.status !== "PAID" && (l.amountOverride != null || l.increasePercentOverride != null));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md bg-success/10 px-2 py-1 text-success">
          {t("amc.collected")}: <span className="num font-medium">{f.money(collected, currency)}</span>
        </span>
        <span className="rounded-md bg-muted px-2 py-1">
          {t("amc.outstanding")}: <span className="num font-medium">{f.money(outstanding, currency)}</span>
        </span>
        <span className="flex-1" />
      {canWrite && hasOverrides && (
        <div>
          <ConfirmDialog
            destructive={false}
            title={t("amc.resetOverrides")}
            description={t("amc.resetConfirm")}
            confirmLabel={t("amc.resetOverrides")}
            trigger={
              <Button variant="outline" size="sm">
                <RotateCcw /> {t("amc.resetOverrides")}
              </Button>
            }
            onConfirm={() =>
              run(() => resetAmcOverridesAction(contractId), { success: "amc.saved", onSuccess: () => router.refresh() }).then(() => undefined)
            }
          />
        </div>
      )}
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t("amc.year")}</TableHead>
              <TableHead>{t("amc.dueDate")}</TableHead>
              <TableHead className="text-end">{t("amc.increase")}</TableHead>
              <TableHead className="text-end">{t("amc.amount")}</TableHead>
              <TableHead>{t("amc.status")}</TableHead>
              <TableHead>{t("amc.paid")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l) => {
              const inc = l.increasePercentOverride ?? (l.yearIndex === 1 ? 0 : defaultIncrease);
              const overridden = l.amountOverride != null || l.increasePercentOverride != null;
              const paid = l.status === "PAID";
              const overdue = l.status === "OVERDUE";
              return (
                <TableRow key={l.id} className={cn(overdue && "bg-destructive/5", paid && "text-muted-foreground")}>
                  <TableCell className="font-medium">{f.number(l.yearIndex)}</TableCell>
                  <TableCell className={cn(overdue && "font-medium text-destructive")}>{f.date(l.dueDate)}</TableCell>
                  <TableCell className={cn("num text-end", l.increasePercentOverride != null && "font-semibold text-primary")}>
                    {f.number(inc, 0)}%
                  </TableCell>
                  <TableCell className="num text-end">
                    <span className="inline-flex items-center gap-1.5">
                      {paid && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Lock className="size-3.5" aria-label={t("amc.locked")} />
                          </TooltipTrigger>
                          <TooltipContent>{t("amc.locked")}</TooltipContent>
                        </Tooltip>
                      )}
                      {overridden && !paid && <StatusBadge color="violet">{t("amc.overridden")}</StatusBadge>}
                      <span className={cn("font-medium", !paid && "text-foreground")}>{f.money(l.amount, currency)}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge color={STATUS_COLOR[l.status]}>{t(`amcStatus.${l.status}`)}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {paid ? (
                      <div className="leading-tight">
                        <div>{f.date(l.paidAt)}</div>
                        {l.invoiceRef && <div dir="ltr" className="text-muted-foreground">{l.invoiceRef}</div>}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  {(
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={t("common.actions")}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a href={`/api/pdf/amc/${l.id}?lang=${docLang}`} target="_blank" rel="noreferrer">
                              <FileText /> {t("documents.amcNotice")}
                            </a>
                          </DropdownMenuItem>
                          {canEmail && !paid && (
                            <DropdownMenuItem asChild>
                              <Link href={`/emails/compose?kind=amc&id=${l.id}`}>
                                <Mail /> {t("documents.emailAmc")}
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {canWrite && !paid && (
                            <>
                              <DropdownMenuItem onClick={() => setPay(l)}>
                                <Banknote /> {t("amc.markPaid")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAdjust(l)}>
                                <SlidersHorizontal /> {t("amc.adjust")}
                              </DropdownMenuItem>
                            </>
                          )}
                          {canWrite && paid && (
                            <ConfirmDialog
                              destructive
                              title={t("amc.unmarkPaid")}
                              description={t("amc.unmarkConfirm")}
                              confirmLabel={t("amc.unmarkPaid")}
                              trigger={
                                <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                                  <Undo2 /> {t("amc.unmarkPaid")}
                                </DropdownMenuItem>
                              }
                              onConfirm={() =>
                                run(() => unmarkAmcPaidAction(l.id), { success: "amc.saved", onSuccess: () => router.refresh() }).then(() => undefined)
                              }
                            />
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>{t("amc.total")}</TableCell>
              <TableCell className="num text-end">{f.money(total, currency)}</TableCell>
              <TableCell colSpan={3} />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <AdjustDialog line={adjust} onClose={() => setAdjust(null)} currency={currency} />
      <PayDialog line={pay} onClose={() => setPay(null)} today={today} />
    </div>
  );
}

type AdjustValues = { increasePercentOverride: string; amountOverride: string; notes: string };

function AdjustDialog({ line, onClose, currency }: { line: AmcLineDTO | null; onClose: () => void; currency: string }) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const form = useForm<AdjustValues>({
    resolver: zodResolver(amcLineOverrideSchema, undefined, { raw: true }) as unknown as Resolver<AdjustValues>,
    values: line
      ? {
          increasePercentOverride: line.increasePercentOverride?.toString() ?? "",
          amountOverride: line.amountOverride?.toString() ?? "",
          notes: line.notes ?? "",
        }
      : undefined,
  });
  const e = form.formState.errors;
  return (
    <Dialog open={!!line} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          onSubmit={form.handleSubmit((v) =>
            run(() => updateAmcLineAction(line!.id, v), {
              success: "amc.saved",
              onSuccess: () => {
                onClose();
                router.refresh();
              },
              onError: (r) => Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof AdjustValues, { message: m })),
            }),
          )}
          className="space-y-4"
          noValidate
        >
          <DialogHeader>
            <DialogTitle>{t("amc.adjustTitle", { year: line?.yearIndex ?? "" })}</DialogTitle>
            <DialogDescription>{t("amc.adjustHint")}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {t("amc.amount")}: <span className="num font-semibold">{f.money(line?.amount, currency)}</span>
          </p>
          <FormField label={t("amc.increaseOverride")} htmlFor="ovInc" error={e.increasePercentOverride?.message} hint={t("amc.leaveEmpty")}>
            <Input id="ovInc" inputMode="decimal" dir="ltr" {...form.register("increasePercentOverride")} />
          </FormField>
          <FormField label={`${t("amc.amountOverride")} (${currency})`} htmlFor="ovAmt" error={e.amountOverride?.message} hint={t("amc.leaveEmpty")}>
            <Input id="ovAmt" inputMode="decimal" dir="ltr" {...form.register("amountOverride")} />
          </FormField>
          <FormField label={t("common.notes")} htmlFor="ovNotes">
            <Textarea id="ovNotes" rows={2} {...form.register("notes")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type PayValues = { paidAt: string; paidAmount: string; invoiceRef: string };

function PayDialog({ line, onClose, today }: { line: AmcLineDTO | null; onClose: () => void; today: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const form = useForm<PayValues>({
    resolver: zodResolver(amcPaymentSchema, undefined, { raw: true }) as unknown as Resolver<PayValues>,
    values: line ? { paidAt: toDateInput(today), paidAmount: String(line.amount), invoiceRef: "" } : undefined,
  });
  const e = form.formState.errors;
  return (
    <Dialog open={!!line} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          onSubmit={form.handleSubmit((v) =>
            run(() => markAmcPaidAction(line!.id, v), {
              success: "amc.paidSaved",
              onSuccess: () => {
                onClose();
                router.refresh();
              },
              onError: (r) => Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof PayValues, { message: m })),
            }),
          )}
          className="space-y-4"
          noValidate
        >
          <DialogHeader>
            <DialogTitle>{t("amc.markPaidTitle", { year: line?.yearIndex ?? "" })}</DialogTitle>
          </DialogHeader>
          <FormField label={t("amc.paidAt")} htmlFor="paidAt" error={e.paidAt?.message} required>
            <Input id="paidAt" type="date" {...form.register("paidAt")} />
          </FormField>
          <FormField label={t("amc.paidAmount")} htmlFor="paidAmount" error={e.paidAmount?.message} required>
            <Input id="paidAmount" inputMode="decimal" dir="ltr" {...form.register("paidAmount")} />
          </FormField>
          <FormField label={t("amc.invoiceRef")} htmlFor="invoiceRef" error={e.invoiceRef?.message}>
            <Input id="invoiceRef" dir="ltr" {...form.register("invoiceRef")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} {t("amc.markPaid")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
