"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, CopyPlus, Send, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerAction } from "@/components/forms/use-action";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { canTransition, type QuotationStatus } from "@/lib/validation/quotation";
import { newQuotationVersionAction, setQuotationStatusAction } from "@/server/actions/quotations";

/** Status workflow buttons + "new version" for a quotation. */
export function QuotationActions({ id, status, canManageDelivery = false }: { id: string; status: QuotationStatus; canManageDelivery?: boolean }) {
  const t = useTranslations("quotations");
  const router = useRouter();
  const { pending, run } = useServerAction();
  const go = (to: QuotationStatus) =>
    run(() => setQuotationStatusAction(id, to), {
      success: "quotations.statusUpdated",
      // Accepted → straight to the delivery confirmation screen.
      onSuccess: () => (to === "ACCEPTED" && canManageDelivery ? router.push(`/delivery/new?quotationId=${id}`) : router.refresh()),
    });

  return (
    <>
      {canTransition(status, "SENT") && (
        <Button variant={status === "DRAFT" ? "default" : "outline"} disabled={pending} onClick={() => go("SENT")}>
          {status === "DRAFT" ? <Send /> : <Undo2 />} {status === "DRAFT" ? t("markSent") : t("reopen")}
        </Button>
      )}
      {canTransition(status, "ACCEPTED") && (
        <Button className="bg-success text-white hover:bg-success/90" disabled={pending} onClick={() => go("ACCEPTED")}>
          <Check /> {t("markAccepted")}
        </Button>
      )}
      {canTransition(status, "REJECTED") && (
        <Button variant="outline" className="text-destructive" disabled={pending} onClick={() => go("REJECTED")}>
          <X /> {t("markRejected")}
        </Button>
      )}
      {canTransition(status, "DRAFT") && (
        <Button variant="ghost" disabled={pending} onClick={() => go("DRAFT")}>
          <Undo2 /> {t("backToDraft")}
        </Button>
      )}
      {status !== "DRAFT" && (
        <ConfirmDialog
          destructive={false}
          title={t("newVersion")}
          description={t("lockedNotice")}
          confirmLabel={t("newVersion")}
          trigger={
            <Button variant="outline" disabled={pending}>
              <CopyPlus /> {t("newVersion")}
            </Button>
          }
          onConfirm={() =>
            run(() => newQuotationVersionAction(id), {
              success: "quotations.versionCreated",
              onSuccess: (d) => {
                router.push(`/quotations/${d.id}/edit`);
                router.refresh();
              },
            }).then(() => undefined)
          }
        />
      )}
    </>
  );
}
