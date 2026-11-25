/**
 * AMC (Annual Maintenance Contract) schedule engine.
 *
 * Pure and framework-free, so it can run on the server, in the browser (for
 * live previews in the contract form) and in unit tests.
 *
 * Rules
 * ─────
 *  base AMC        = contractValue × amcPercent / 100
 *  Year 1          = base (an increase override on year 1 is applied to base)
 *  COMPOUND        amount[y] = amount[y-1] × (1 + inc[y] / 100)
 *                  → builds on the *effective* previous amount, so an amount
 *                    override (or a paid/locked amount) carries forward.
 *  SIMPLE          amount[y] = base × (1 + Σ inc[1..y] / 100)
 *                  → increases always apply to the base; an amount override
 *                    affects only that single year.
 *  inc[y]          = per-year override if set, otherwise the contract's
 *                    increasePercent (year 1 defaults to 0).
 *  Locked years    (already PAID) keep their stored amount and are never
 *                  recalculated; they behave like an amount override.
 *  Due date[y]     = amcStartDate + (y-1) years (Feb 29 clamps to Feb 28).
 *
 * All amounts are rounded to 2 decimals per year (as they would be invoiced).
 */

export type AmcMethod = "COMPOUND" | "SIMPLE";

export interface AmcYearOverride {
  /** Override the increase % applied in this year. */
  increasePercent?: number | null;
  /** Force this year's amount. */
  amount?: number | null;
}

export interface AmcInput {
  contractValue: number;
  amcPercent: number;
  increasePercent: number;
  method: AmcMethod;
  /** Due date of year 1. */
  startDate: Date;
  years: number;
  /** Keyed by 1-based year index. */
  overrides?: Record<number, AmcYearOverride | undefined>;
  /** Paid years: 1-based year index → amount that must not change. */
  locked?: Record<number, number | undefined>;
}

export interface AmcLine {
  yearIndex: number;
  dueDate: Date;
  /** Effective increase % used for this year (0 for year 1 unless overridden). */
  increasePercent: number;
  /** Amount produced by the formula before amount overrides/locks. */
  computedAmount: number;
  /** Final amount for the year. */
  amount: number;
  source: "formula" | "override" | "locked";
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Add whole years in UTC; Feb 29 → Feb 28 in non-leap years. */
export function addYearsUTC(date: Date, years: number): Date {
  const y = date.getUTCFullYear() + years;
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, lastDay)));
}

/** Default AMC start = one year after the contract date. */
export function defaultAmcStartDate(contractDate: Date): Date {
  return addYearsUTC(contractDate, 1);
}

export function baseAmc(contractValue: number, amcPercent: number): number {
  return round2((contractValue * amcPercent) / 100);
}

export function generateAmcSchedule(input: AmcInput): AmcLine[] {
  const { contractValue, amcPercent, increasePercent, method, startDate, years } = input;
  if (!Number.isFinite(years) || years < 1) return [];
  const overrides = input.overrides ?? {};
  const locked = input.locked ?? {};

  const base = baseAmc(contractValue, amcPercent);
  const lines: AmcLine[] = [];
  let previous = base; // effective amount of previous year (compound)
  let cumulativePct = 0; // Σ increases (simple)

  for (let y = 1; y <= years; y++) {
    const ov = overrides[y];
    const inc =
      ov?.increasePercent != null ? ov.increasePercent : y === 1 ? 0 : increasePercent;

    let computed: number;
    if (method === "COMPOUND") {
      computed = round2((y === 1 ? base : previous) * (1 + inc / 100));
    } else {
      cumulativePct += inc;
      computed = round2(base * (1 + cumulativePct / 100));
    }

    let amount = computed;
    let source: AmcLine["source"] = "formula";
    const lockedAmount = locked[y];
    if (lockedAmount != null) {
      amount = round2(lockedAmount);
      source = "locked";
    } else if (ov?.amount != null) {
      amount = round2(ov.amount);
      source = "override";
    }

    lines.push({
      yearIndex: y,
      dueDate: addYearsUTC(startDate, y - 1),
      increasePercent: inc,
      computedAmount: computed,
      amount,
      source,
    });
    previous = amount;
  }
  return lines;
}

export type AmcStatus = "PENDING" | "PAID" | "OVERDUE";

/** Derive the display/persisted status of a line relative to `today` (UTC date). */
export function deriveAmcStatus(
  line: { dueDate: Date; paidAt?: Date | null; status?: AmcStatus },
  today: Date,
): AmcStatus {
  if (line.paidAt || line.status === "PAID") return "PAID";
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return line.dueDate.getTime() < t ? "OVERDUE" : "PENDING";
}

export function totalAmc(lines: Pick<AmcLine, "amount">[]): number {
  return round2(lines.reduce((s, l) => s + l.amount, 0));
}
