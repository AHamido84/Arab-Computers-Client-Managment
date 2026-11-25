"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";

type Result = { ok: true } | { ok: false; error: string };

/** Delete with confirmation, translated error toast and redirect on success. */
export function DeleteButton({
  action,
  redirectTo,
  successKey,
  label,
}: {
  action: () => Promise<Result | { ok: boolean; error?: string }>;
  redirectTo: string;
  successKey: string;
  label?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="text-destructive">
          <Trash2 /> {label ?? t("common.delete")}
        </Button>
      }
      onConfirm={async () => {
        const r = await action();
        if (!r.ok) {
          const key = (r as { error?: string }).error ?? "common.error";
          toast.error(t.has(key) ? t(key) : t("common.error"));
          return;
        }
        toast.success(t(successKey));
        router.push(redirectTo);
        router.refresh();
      }}
    />
  );
}
