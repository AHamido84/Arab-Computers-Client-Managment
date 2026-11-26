"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useFmt } from "@/components/shared/format-provider";
import { deleteAttachmentAction } from "@/server/actions/attachments";

import type { AttachmentItem } from "./types";

const MAX = 4 * 1024 * 1024;

function humanSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentsPanel({
  entityType,
  entityId,
  items,
  canWrite,
  canDelete,
  revalidate,
  defaultLabel,
}: {
  entityType: "CLIENT" | "CONTRACT" | "REQUEST" | "QUOTATION" | "DELIVERY_PROJECT" | "DELIVERY_TASK";
  entityId: string;
  items: AttachmentItem[];
  canWrite: boolean;
  canDelete: boolean;
  revalidate: string;
  defaultLabel?: string;
}) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState(defaultLabel ?? "");
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX) return toast.error(t("files.tooLarge"));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("entityType", entityType);
      fd.set("entityId", entityId);
      if (label) fd.set("label", label);
      const res = await fetch("/api/files", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(t.has(body.error) ? t(body.error) : t("common.error"));
        return;
      }
      toast.success(t("files.uploaded"));
      setLabel(defaultLabel ?? "");
      router.refresh();
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <div
          className="flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) upload(file);
          }}
        >
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("files.label")} className="sm:max-w-60" aria-label={t("files.label")} />
          <input ref={input} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />}
            {busy ? t("files.uploading") : t("files.upload")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("files.hint")}</p>
        </div>
      )}
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Paperclip className="size-4" /> {t("files.empty")}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {items.map((a) => {
            const Icon = a.contentType.startsWith("image/") ? ImageIcon : FileText;
            return (
              <li key={a.id} className="flex items-center gap-3 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <a href={`/api/files/${a.id}`} target="_blank" rel="noreferrer" className="block truncate font-medium hover:underline" dir="auto">
                    {a.label || a.filename}
                  </a>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.label ? `${a.filename} · ` : ""}
                    {humanSize(a.size)} · {f.dateTime(a.createdAt)}
                    {a.uploadedBy ? ` · ${t("files.uploadedBy", { name: a.uploadedBy })}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" asChild>
                  <a href={`/api/files/${a.id}?download=1`} aria-label={t("common.download")}>
                    <Download />
                  </a>
                </Button>
                {canDelete && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={t("common.delete")}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    }
                    onConfirm={async () => {
                      const r = await deleteAttachmentAction(a.id, revalidate);
                      if (!r.ok) toast.error(t.has(r.error) ? t(r.error) : t("common.error"));
                      else router.refresh();
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
