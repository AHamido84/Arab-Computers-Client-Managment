import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { defaultAmcStartDate, deriveAmcStatus, generateAmcSchedule, type AmcYearOverride } from "@/lib/amc/engine";
import { todayUTC } from "@/lib/format";

/**
 * Re-generate a contract's AMC schedule from its configuration while keeping:
 *  - per-year overrides (increase % / amount) stored on existing lines,
 *  - PAID lines untouched (locked amount and due date).
 * Unpaid lines beyond `amcYears` are removed. Call after any change to the
 * contract's AMC settings or to a line's overrides / payment status.
 */
export async function syncAmcSchedule(tx: Prisma.TransactionClient, contractId: string) {
  const contract = await tx.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: { amcLines: true },
  });
  const today = todayUTC();
  const byYear = new Map(contract.amcLines.map((l) => [l.yearIndex, l]));

  if (!contract.amcEnabled) {
    await tx.amcScheduleLine.deleteMany({ where: { contractId, status: { not: "PAID" } } });
    return;
  }

  const overrides: Record<number, AmcYearOverride> = {};
  const locked: Record<number, number> = {};
  for (const l of contract.amcLines) {
    if (l.status === "PAID") locked[l.yearIndex] = Number(l.amount);
    overrides[l.yearIndex] = {
      increasePercent: l.increasePercentOverride != null ? Number(l.increasePercentOverride) : null,
      amount: l.amountOverride != null ? Number(l.amountOverride) : null,
    };
  }

  const lines = generateAmcSchedule({
    contractValue: Number(contract.value),
    amcPercent: Number(contract.amcPercent),
    increasePercent: Number(contract.amcIncreasePercent),
    method: contract.amcMethod,
    startDate: contract.amcStartDate ?? defaultAmcStartDate(contract.contractDate),
    years: contract.amcYears,
    overrides,
    locked,
  });

  for (const line of lines) {
    const existing = byYear.get(line.yearIndex);
    if (existing?.status === "PAID") continue; // locked
    const status = deriveAmcStatus({ dueDate: line.dueDate }, today);
    if (existing) {
      await tx.amcScheduleLine.update({
        where: { id: existing.id },
        data: { amount: line.amount, dueDate: line.dueDate, status },
      });
    } else {
      await tx.amcScheduleLine.create({
        data: { contractId, yearIndex: line.yearIndex, dueDate: line.dueDate, amount: line.amount, status },
      });
    }
  }
  await tx.amcScheduleLine.deleteMany({
    where: { contractId, yearIndex: { gt: contract.amcYears }, status: { not: "PAID" } },
  });
}
