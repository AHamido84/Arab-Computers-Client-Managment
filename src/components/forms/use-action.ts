"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Run a server action with pending state and translated toasts.
 * Returns the result so callers can map `fieldErrors` onto their form.
 */
export function useServerAction() {
  const t = useTranslations();
  const [pending, start] = useTransition();

  const run = <T,>(
    fn: () => Promise<Result<T>>,
    opts: { success?: string; onSuccess?: (data: T) => void; onError?: (r: Extract<Result<T>, { ok: false }>) => void } = {},
  ) =>
    new Promise<Result<T>>((resolve) =>
      start(async () => {
        const r = await fn();
        if (r.ok) {
          if (opts.success) toast.success(t(opts.success));
          opts.onSuccess?.(r.data);
        } else {
          // For validation failures, show the first specific field message instead of a generic one.
          const first = r.error === "validation.invalid" ? Object.values(r.fieldErrors ?? {})[0] : undefined;
          const key = first && t.has(first) ? first : r.error;
          toast.error(t.has(key) ? t(key) : t("common.error"));
          opts.onError?.(r);
        }
        resolve(r);
      }),
    );

  return { pending, run };
}
