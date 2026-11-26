"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerAction } from "@/components/forms/use-action";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/validation/request";
import { setRequestStatusAction } from "@/server/actions/requests";

export function RequestStatusChanger({ id, status }: { id: string; status: RequestStatus }) {
  const t = useTranslations();
  const router = useRouter();
  const { pending, run } = useServerAction();
  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(v) => run(() => setRequestStatusAction(id, v as RequestStatus), { success: "requests.moved", onSuccess: () => router.refresh() })}
    >
      <SelectTrigger className="min-w-40" aria-label={t("requests.changeStatus")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {REQUEST_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {t(`requestStatus.${s}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
