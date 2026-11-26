"use client";

/**
 * Handover: delivery note PDF (AR/EN), email it to the client (reviewed
 * before sending), and upload the client-signed note to mark the project
 * Client Accepted.
 */
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BadgeCheck, FileDown, Loader2, Mail, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFmt } from "@/components/shared/format-provider";
import { acceptProjectAction } from "@/server/actions/delivery";

const MAX = 4 * 1024 * 1024;

export function HandoverCard({
  projectId,
  canManage,
  canEmail,
  hasDelivered,
  accepted,
  partialNote,
}: {
  projectId: string;
  canManage: boolean;
  canEmail: boolean;
  hasDelivered: boolean;
  accepted: { at: string; fileId: string | null; filename: string | null } | null;
  /** Signed note received while some tasks are still open. */
  partialNote?: { fileId: string; filename: string | null } | null;
}) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX) return toast.error(t("files.tooLarge"));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("entityType", "DELIVERY_PROJECT");
      fd.set("entityId", projectId);
      fd.set("label", t("handover.signedLabel"));
      const res = await fetch("/api/files", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(t.has(body.error) ? t(body.error) : t("common.error"));
      const r = await acceptProjectAction(projectId, body.id);
      if (!r.ok) return toast.error(t.has(r.error) ? t(r.error) : t("common.error"));
      toast.success(t(r.data.full ? "handover.accepted" : "handover.partial"));
      router.refresh();
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("handover.title")}</CardTitle>
        <CardDescription>{t("handover.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["ar", "en"] as const).map((l) => (
            <Button key={l} asChild variant="outline" size="sm">
              <a href={`/api/pdf/delivery/${projectId}?lang=${l}`} target="_blank" rel="noreferrer">
                <FileDown /> {t(l === "ar" ? "handover.pdfAr" : "handover.pdfEn")}
              </a>
            </Button>
          ))}
          {canEmail && (
            <Button asChild size="sm" variant={accepted ? "outline" : "default"}>
              <Link href={`/emails/compose?kind=delivery&id=${projectId}`}>
                <Mail /> {t("handover.email")}
              </Link>
            </Button>
          )}
        </div>
        {!hasDelivered && !accepted && <p className="text-xs text-muted-foreground">{t("handover.draftHint")}</p>}

        {!accepted && partialNote && (
          <p className="text-sm">
            {t("handover.partialNote")}{" "}
            <a href={`/api/files/${partialNote.fileId}`} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
              {partialNote.filename ?? t("handover.signedLabel")}
            </a>
          </p>
        )}
        {accepted ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
            <BadgeCheck className="size-5 text-success" />
            <span className="font-medium">{t("handover.acceptedOn", { date: f.date(accepted.at) })}</span>
            {accepted.fileId && (
              <a href={`/api/files/${accepted.fileId}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {accepted.filename ?? t("handover.signedLabel")}
              </a>
            )}
          </div>
        ) : (
          canManage && (
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <p className="text-sm font-medium">{t("handover.uploadTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("handover.uploadHint")}</p>
              <input
                ref={input}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                className="sr-only"
                id="signed-note"
                aria-label={t("handover.upload")}
                tabIndex={-1}
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                disabled={busy || !hasDelivered}
              />
              <Button size="sm" variant="secondary" disabled={busy || !hasDelivered} onClick={() => input.current?.click()}>
                {busy ? <Loader2 className="animate-spin" /> : <Upload />} {t("handover.upload")}
              </Button>
              {!hasDelivered && <p className="text-xs text-muted-foreground">{t("delivery.nothingDelivered")}</p>}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
