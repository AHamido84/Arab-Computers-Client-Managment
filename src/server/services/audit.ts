import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient | typeof db;

/** Fields never written to the audit diff. */
const REDACT = new Set(["passwordHash", "updatedAt", "createdAt"]);

function clean(obj: unknown): Prisma.InputJsonValue | undefined {
  if (obj == null || typeof obj !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACT.has(k)) continue;
    out[k] = v instanceof Date ? v.toISOString() : typeof v === "object" && v !== null && "toFixed" in v ? String(v) : v;
  }
  return JSON.parse(JSON.stringify(out));
}

/** Only keep keys whose value actually changed. */
function diff(before: unknown, after: unknown) {
  const b = (clean(before) ?? {}) as Record<string, unknown>;
  const a = (clean(after) ?? {}) as Record<string, unknown>;
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) changes[k] = { from: b[k] ?? null, to: a[k] ?? null };
  }
  return changes as Prisma.InputJsonValue;
}

/**
 * Record a create/update/delete in the audit log.
 *  - CREATE: pass `after`
 *  - UPDATE: pass `before` and `after` (only changed fields are stored)
 *  - DELETE: pass `before`
 */
export async function audit(
  tx: Tx,
  args: {
    actorId?: string | null;
    action: "CREATE" | "UPDATE" | "DELETE";
    entity: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
) {
  const payload =
    args.action === "UPDATE" ? diff(args.before, args.after) : clean(args.action === "CREATE" ? args.after : args.before);
  await tx.auditLog.create({
    data: { actorId: args.actorId ?? null, action: args.action, entity: args.entity, entityId: args.entityId, diff: payload },
  });
}

/** Add an entry to a client's activity timeline. */
export async function activity(
  tx: Tx,
  args: { clientId: string; type: string; summary: string; refType?: string; refId?: string; actorId?: string | null; meta?: Prisma.InputJsonValue },
) {
  await tx.activity.create({ data: { ...args, actorId: args.actorId ?? null } });
}
