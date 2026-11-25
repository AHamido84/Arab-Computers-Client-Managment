import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ForbiddenError } from "./auth-guard";

/**
 * Uniform result for server actions so forms can show field errors and toasts.
 * `error` and field messages are i18n keys (e.g. "validation.required") that the
 * client translates, so every message exists in Arabic and English.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Convert a thrown error into an ActionResult (and log unexpected ones). */
export function toActionError(e: unknown): ActionResult<never> {
  if (e instanceof ForbiddenError) return fail("auth.forbidden");
  if (e instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of e.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return fail("validation.invalid", fieldErrors);
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return fail("errors.duplicate");
    if (e.code === "P2003" || e.code === "P2014") return fail("errors.inUse");
    if (e.code === "P2025") return fail("errors.notFound");
  }
  if (e instanceof DomainError) return fail(e.message);
  console.error(e);
  return fail("common.error");
}

/** Business-rule violation with an i18n key as message. */
export class DomainError extends Error {}

/** Wrap an action body: validation, permission and DB errors become ActionResults. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    // Let Next.js redirect()/notFound() propagate.
    if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string" && (e as { digest: string }).digest.startsWith("NEXT_")) throw e;
    return toActionError(e);
  }
}
