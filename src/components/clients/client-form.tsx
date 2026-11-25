"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { useFmt } from "@/components/shared/format-provider";
import { clientSchema } from "@/lib/validation/client";
import { createClientAction, updateClientAction } from "@/server/actions/clients";
import type { LookupOption } from "@/server/services/lookups";

const NONE = "__none";

export type ClientFormValues = {
  nameAr: string;
  nameEn: string;
  statusId: string;
  industryId: string;
  preferredLang: "ar" | "en";
  address: string;
  city: string;
  website: string;
  taxNumber: string;
  notes: string;
  accountManagerId: string;
  contacts: { id?: string; name: string; jobTitle: string; phone: string; whatsapp: string; email: string; isPrimary: boolean }[];
};

export const emptyContact = { name: "", jobTitle: "", phone: "", whatsapp: "", email: "", isPrimary: false };

export function ClientForm({
  clientId,
  defaultValues,
  statuses,
  industries,
  managers,
}: {
  clientId?: string;
  defaultValues: ClientFormValues;
  statuses: LookupOption[];
  industries: LookupOption[];
  managers: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const form = useForm<ClientFormValues>({
    defaultValues,
    resolver: zodResolver(clientSchema, undefined, { raw: true }) as unknown as Resolver<ClientFormValues>,
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const contacts = useFieldArray({ control, name: "contacts" });
  const watchedContacts = useWatch({ control, name: "contacts" });
  const err = (name: string) => {
    const parts = name.split(".");
    let e: unknown = formState.errors;
    for (const p of parts) e = (e as Record<string, unknown> | undefined)?.[p];
    return (e as { message?: string } | undefined)?.message;
  };

  const onSubmit = handleSubmit((values) =>
    run(() => (clientId ? updateClientAction(clientId, values) : createClientAction(values)), {
      success: clientId ? "clients.updated" : "clients.created",
      onSuccess: (data) => {
        router.push(`/clients/${data.id}`);
        router.refresh();
      },
      onError: (r) => Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => setError(k as never, { message: m })),
    }),
  );

  const setPrimary = (idx: number) =>
    contacts.fields.forEach((_, i) => form.setValue(`contacts.${i}.isPrimary`, i === idx, { shouldDirty: true }));

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{t("clients.basicInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label={t("clients.nameAr")} htmlFor="nameAr" error={err("nameAr")} required>
            <Input id="nameAr" dir="rtl" {...register("nameAr")} aria-invalid={!!err("nameAr")} />
          </FormField>
          <FormField label={t("clients.nameEn")} htmlFor="nameEn" error={err("nameEn")} required>
            <Input id="nameEn" dir="ltr" {...register("nameEn")} aria-invalid={!!err("nameEn")} />
          </FormField>
          <FormField label={t("clients.status")} error={err("statusId")} required>
            <Controller
              control={control}
              name="statusId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" aria-invalid={!!err("statusId")}>
                    <SelectValue placeholder={t("common.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {f.name(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("clients.industry")}>
            <Controller
              control={control}
              name="industryId"
              render={({ field }) => (
                <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {industries.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {f.name(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("clients.manager")}>
            <Controller
              control={control}
              name="accountManagerId"
              render={({ field }) => (
                <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("clients.unassigned")}</SelectItem>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("clients.preferredLang")} hint={t("clients.preferredLangHint")}>
            <Controller
              control={control}
              name="preferredLang"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">{t("languages.ar")}</SelectItem>
                    <SelectItem value="en">{t("languages.en")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("clients.city")} htmlFor="city" error={err("city")}>
            <Input id="city" {...register("city")} />
          </FormField>
          <FormField label={t("clients.address")} htmlFor="address" error={err("address")}>
            <Input id="address" {...register("address")} />
          </FormField>
          <FormField label={t("clients.website")} htmlFor="website" error={err("website")}>
            <Input id="website" dir="ltr" {...register("website")} />
          </FormField>
          <FormField label={t("clients.taxNumber")} htmlFor="taxNumber" error={err("taxNumber")}>
            <Input id="taxNumber" dir="ltr" {...register("taxNumber")} />
          </FormField>
          <FormField label={t("clients.notes")} htmlFor="notes" error={err("notes")} className="md:col-span-2">
            <Textarea id="notes" rows={3} {...register("notes")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("clients.contacts")}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => contacts.append({ ...emptyContact, isPrimary: contacts.fields.length === 0 })}>
            <Plus /> {t("clients.addContact")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {contacts.fields.length === 0 && <p className="text-sm text-muted-foreground">{t("clients.noContacts")}</p>}
          {contacts.fields.map((c, i) => {
            const isPrimary = !!watchedContacts?.[i]?.isPrimary;
            return (
              <div key={c.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-3">
                <FormField label={t("clients.contactName")} error={err(`contacts.${i}.name`)} required>
                  <Input {...register(`contacts.${i}.name`)} aria-invalid={!!err(`contacts.${i}.name`)} />
                </FormField>
                <FormField label={t("clients.jobTitle")} error={err(`contacts.${i}.jobTitle`)}>
                  <Input {...register(`contacts.${i}.jobTitle`)} />
                </FormField>
                <FormField label={t("clients.email")} error={err(`contacts.${i}.email`)}>
                  <Input type="email" dir="ltr" {...register(`contacts.${i}.email`)} aria-invalid={!!err(`contacts.${i}.email`)} />
                </FormField>
                <FormField label={t("clients.phone")} error={err(`contacts.${i}.phone`)}>
                  <Input type="tel" dir="ltr" {...register(`contacts.${i}.phone`)} aria-invalid={!!err(`contacts.${i}.phone`)} />
                </FormField>
                <FormField label={t("clients.whatsapp")} error={err(`contacts.${i}.whatsapp`)}>
                  <Input type="tel" dir="ltr" {...register(`contacts.${i}.whatsapp`)} aria-invalid={!!err(`contacts.${i}.whatsapp`)} />
                </FormField>
                <div className="flex items-end gap-2">
                  <Button type="button" variant={isPrimary ? "secondary" : "ghost"} size="sm" onClick={() => setPrimary(i)} aria-pressed={isPrimary}>
                    <Star className={isPrimary ? "fill-current" : ""} /> {t("clients.primary")}
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => contacts.remove(i)} aria-label={t("common.delete")}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
