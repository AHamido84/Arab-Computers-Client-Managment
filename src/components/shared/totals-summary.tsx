"use client";

import { useTranslations } from "next-intl";
import { useFmt } from "./format-provider";
import type { Totals } from "@/lib/totals";
import { cn } from "@/lib/utils";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-6", strong && "border-t pt-2 text-base font-semibold")}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}

/** Subtotal / discount / VAT / grand total block. */
export function TotalsSummary({ totals, currency, className }: { totals: Totals; currency: string; className?: string }) {
  const t = useTranslations("common");
  const f = useFmt();
  return (
    <div className={cn("space-y-1.5 text-sm", className)}>
      <Row label={t("subtotal")} value={f.money(totals.subtotal, currency)} />
      {totals.discount > 0 && <Row label={t("discount")} value={f.money(-totals.discount, currency)} />}
      <Row label={`${t("vat")} (${f.number(totals.vatPercent, 0)}%)`} value={f.money(totals.vat, currency)} />
      <Row label={t("grandTotal")} value={f.money(totals.total, currency)} strong />
    </div>
  );
}
