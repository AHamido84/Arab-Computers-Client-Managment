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
          toast.error(t.has(r.error) ? t(r.error) : t("common.error"));
          opts.onError?.(r);
        }
        resolve(r);
      }),
    );

  return { pending, run };
}
