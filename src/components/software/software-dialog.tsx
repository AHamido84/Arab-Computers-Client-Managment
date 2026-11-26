"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { saveSoftwareAction } from "@/server/actions/software";

export type SoftwareValue = { id?: string; nameAr: string; nameEn: string; description: string; active: boolean };
const blank: SoftwareValue = { nameAr: "", nameEn: "", description: "", active: true };

/** Add (no `software`) or edit software. `compact` renders an icon-only edit trigger. */
export function SoftwareDialog({ software, compact }: { software?: SoftwareValue; compact?: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [open, setOpen] = useState(false);
  const initial = software ?? blank;
  const [v, setV] = useState<SoftwareValue>(initial);
  const [err, setErr] = useState<Record<string, string>>({});
  const editing = !!software?.id;
  const save = () =>
    run(() => saveSoftwareAction(software?.id ?? null, v), {
      success: editing ? "software.updated" : "software.created",
      onSuccess: () => {
        setOpen(false);
        router.refresh();
      },
      onError: (r) => setErr(r.fieldErrors ?? {}),
    });
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(initial); setErr({}); } }}>
      <DialogTrigger asChild>
        {editing ? (
          compact ? (
            <Button variant="ghost" size="icon-sm" aria-label={`${t("common.edit")}: ${software!.nameEn}`}><Pencil /></Button>
          ) : (
            <Button variant="outline"><Pencil /> {t("common.edit")}</Button>
          )
        ) : (
          <Button><Plus /> {t("software.add")}</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t("software.edit") : t("software.add")}</DialogTitle>
          <DialogDescription>{t("software.dialogHint")}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <FormField label={t("software.nameAr")} htmlFor="sw-ar" error={err.nameAr} required>
            <Input id="sw-ar" dir="rtl" lang="ar" value={v.nameAr} onChange={(e) => setV({ ...v, nameAr: e.target.value })} />
          </FormField>
          <FormField label={t("software.nameEn")} htmlFor="sw-en" error={err.nameEn} required>
            <Input id="sw-en" dir="ltr" lang="en" value={v.nameEn} onChange={(e) => setV({ ...v, nameEn: e.target.value })} />
          </FormField>
          <FormField label={t("software.description")} htmlFor="sw-desc" error={err.description}>
            <Textarea id="sw-desc" dir="auto" rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </FormField>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <span>
              <span className="font-medium">{t("software.active")}</span>
              <span className="block text-xs text-muted-foreground">{t("software.activeHint")}</span>
            </span>
            <Switch checked={v.active} onCheckedChange={(active) => setV({ ...v, active })} />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} {t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
