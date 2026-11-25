"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { BADGE_COLORS, StatusBadge } from "@/components/shared/status-badge";
import { lookupKinds, lookupSchema } from "@/lib/validation/lookup";
import { deleteLookupAction, moveLookupAction, saveLookupAction } from "@/server/actions/lookups";
import type { LookupRow } from "@/app/(app)/settings/lists/page";

type Kind = (typeof lookupKinds)[number];
type Values = { kind: Kind; key: string; labelAr: string; labelEn: string; color: string; active: boolean };

export function LookupsEditor({ data }: { data: Record<Kind, LookupRow[]> }) {
  const t = useTranslations();
  const router = useRouter();
  const { run } = useServerAction();
  const [editing, setEditing] = useState<{ kind: Kind; row: LookupRow | null } | null>(null);

  return (
    <>
      <Tabs defaultValue="CLIENT_STATUS" className="gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            {lookupKinds.map((k) => (
              <TabsTrigger key={k} value={k}>
                {t(`lookups.${k}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {lookupKinds.map((k) => (
          <TabsContent key={k} value={k}>
            <Card className="py-0">
              <CardContent className="p-0">
                <div className="flex justify-end p-3">
                  <Button size="sm" onClick={() => setEditing({ kind: k, row: null })}>
                    <Plus /> {t("lookups.add")}
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20" />
                      <TableHead>{t("lookups.labelAr")}</TableHead>
                      <TableHead>{t("lookups.labelEn")}</TableHead>
                      <TableHead>{t("lookups.key")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data[k].map((r, i) => (
                      <TableRow key={r.id} className={r.active ? "" : "opacity-60"}>
                        <TableCell>
                          <div className="flex">
                            <Button variant="ghost" size="icon-xs" disabled={i === 0} aria-label={t("lookups.moveUp")}
                              onClick={() => run(() => moveLookupAction(r.id, -1), { onSuccess: () => router.refresh() })}>
                              <ArrowUp />
                            </Button>
                            <Button variant="ghost" size="icon-xs" disabled={i === data[k].length - 1} aria-label={t("lookups.moveDown")}
                              onClick={() => run(() => moveLookupAction(r.id, 1), { onSuccess: () => router.refresh() })}>
                              <ArrowDown />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell dir="rtl">
                          {r.color ? <StatusBadge color={r.color}>{r.labelAr}</StatusBadge> : r.labelAr}
                        </TableCell>
                        <TableCell dir="ltr">{r.labelEn}</TableCell>
                        <TableCell dir="ltr" className="font-mono text-xs text-muted-foreground">
                          {r.key} {r.isSystem && <span className="ms-1 rounded bg-muted px-1">{t("lookups.system")}</span>}
                        </TableCell>
                        <TableCell>{r.active ? t("lookups.active") : t("lookups.inactive")}</TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} onClick={() => setEditing({ kind: k, row: r })}>
                              <Pencil />
                            </Button>
                            {!r.isSystem && (
                              <ConfirmDialog
                                trigger={
                                  <Button variant="ghost" size="icon-sm" aria-label={t("common.delete")}>
                                    <Trash2 className="text-destructive" />
                                  </Button>
                                }
                                onConfirm={() =>
                                  run(() => deleteLookupAction(r.id), { success: "common.deleted", onSuccess: () => router.refresh() }).then(() => undefined)
                                }
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      <LookupDialog state={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function LookupDialog({ state, onClose }: { state: { kind: Kind; row: LookupRow | null } | null; onClose: () => void }) {
  const t = useTranslations();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const form = useForm<Values>({
    resolver: zodResolver(lookupSchema, undefined, { raw: true }) as unknown as Resolver<Values>,
    values: state
      ? {
          kind: state.kind,
          key: state.row?.key ?? "",
          labelAr: state.row?.labelAr ?? "",
          labelEn: state.row?.labelEn ?? "",
          color: state.row?.color ?? "",
          active: state.row?.active ?? true,
        }
      : undefined,
  });
  const e = form.formState.errors;
  const sys = !!state?.row?.isSystem;
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((v) =>
            run(() => saveLookupAction(state?.row?.id ?? null, v), {
              success: "common.saved",
              onSuccess: () => {
                onClose();
                router.refresh();
              },
              onError: (r) => Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof Values, { message: m })),
            }),
          )}
        >
          <DialogHeader>
            <DialogTitle>{state?.row ? t("lookups.editValue") : t("lookups.add")} — {state ? t(`lookups.${state.kind}`) : ""}</DialogTitle>
          </DialogHeader>
          <FormField label={t("lookups.labelAr")} htmlFor="lAr" error={e.labelAr?.message} required>
            <Input id="lAr" dir="rtl" {...form.register("labelAr")} />
          </FormField>
          <FormField label={t("lookups.labelEn")} htmlFor="lEn" error={e.labelEn?.message} required>
            <Input id="lEn" dir="ltr" {...form.register("labelEn")} />
          </FormField>
          <FormField label={t("lookups.key")} htmlFor="lKey" error={e.key?.message} required>
            <Input id="lKey" dir="ltr" className="font-mono uppercase" disabled={sys} {...form.register("key")} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("lookups.color")}>
              <Controller
                control={form.control}
                name="color"
                render={({ field }) => (
                  <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {BADGE_COLORS.map((c) => (
                        <SelectItem key={c} value={c}>
                          <StatusBadge color={c}>{c}</StatusBadge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label={t("lookups.active")}>
              <Controller
                control={form.control}
                name="active"
                render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} disabled={sys} aria-label={t("lookups.active")} />}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
