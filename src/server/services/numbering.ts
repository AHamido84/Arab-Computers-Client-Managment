import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { counterScope, formatDocNumber } from "@/lib/numbering";
import { getSettings } from "./settings";

export type NumberKind = "contract" | "request" | "quotation" | "client";

const FORMAT_FIELD = {
  contract: "contractNumberFormat",
  request: "requestNumberFormat",
  quotation: "quotationNumberFormat",
  client: "clientCodeFormat",
} as const;

/**
 * Allocate the next document number inside a transaction. The atomic upsert
 * on Counter guarantees uniqueness under concurrency (no gaps unless the
 * surrounding transaction rolls back, in which case the increment rolls back too).
 */
export async function nextNumber(tx: Prisma.TransactionClient, kind: NumberKind, at = new Date()) {
  const settings = await getSettings();
  const format = settings[FORMAT_FIELD[kind]];
  const scope = counterScope(kind, format, at);
  const c = await tx.counter.upsert({ where: { scope }, create: { scope, value: 1 }, update: { value: { increment: 1 } } });
  return formatDocNumber(format, c.value, at);
}
