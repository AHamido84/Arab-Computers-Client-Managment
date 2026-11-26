/**
 * Line-item totals shared by requests, quotations, PDFs and reports.
 *   subtotal = Σ qty × unitPrice
 *   taxable  = max(0, subtotal − discount)      (discount is an absolute amount)
 *   vat      = taxable × vatPercent / 100
 *   total    = taxable + vat
 * Each figure is rounded to 2 decimals.
 */
import { round2 } from "./amc/engine";

type Dec = number | string | { toString(): string } | null | undefined;
const n = (v: Dec) => (v == null || v === "" ? 0 : Number(typeof v === "number" ? v : v.toString().replace(/,/g, ""))) || 0;

export type LineLike = { qty?: Dec; unitPrice?: Dec };

export function lineTotal(l: LineLike) {
  return round2(n(l.qty) * n(l.unitPrice));
}

export function computeTotals(items: LineLike[], discount: Dec = 0, vatPercent: Dec = 0) {
  const subtotal = round2(items.reduce((s, l) => s + lineTotal(l), 0));
  const disc = round2(Math.min(Math.max(n(discount), 0), subtotal));
  const taxable = round2(subtotal - disc);
  const vat = round2((taxable * n(vatPercent)) / 100);
  return { subtotal, discount: disc, taxable, vatPercent: n(vatPercent), vat, total: round2(taxable + vat) };
}
export type Totals = ReturnType<typeof computeTotals>;
