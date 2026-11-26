"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ImageUp, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { companySettingsSchema } from "@/lib/validation/settings";
import { formatDocNumber } from "@/lib/numbering";
import { CURRENCIES } from "@/lib/currencies";
import { removeLogoAction, saveCompanySettingsAction } from "@/server/actions/settings";

export type CompanyValues = {
  companyNameAr: string; companyNameEn: string; addressAr: string; addressEn: string; phone: string; email: string; website: string;
  taxNumber: string; commercialRegister: string; letterheadFooterAr: string; letterheadFooterEn: string; defaultCurrency: string;
  vatPercent: string; defaultAmcPercent: string; defaultAmcYears: string; quotationValidityDays: string; arabicDigits: "LATIN" | "ARABIC_INDIC";
  contractNumberFormat: string; requestNumberFormat: string; quotationNumberFormat: string; clientCodeFormat: string;
};

export function CompanyForm({ defaultValues, hasCustomLogo }: { defaultValues: CompanyValues; hasCustomLogo: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [logoV, setLogoV] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { register, control, handleSubmit, setError, formState } = useForm<CompanyValues>({
    defaultValues,
    resolver: zodResolver(companySettingsSchema, undefined, { raw: true }) as unknown as Resolver<CompanyValues>,
  });
  const err = (k: keyof CompanyValues) => formState.errors[k]?.message;
  const w = useWatch({ control });

  async function uploadLogo(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/settings/logo", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) return toast.error(t.has(body.error) ? t(body.error) : t("common.error"));
    toast.success(t("common.saved"));
    setLogoV(Date.now());
    router.refresh();
  }

  const text = (k: keyof CompanyValues, label: string, opts: { dir?: "rtl" | "ltr"; required?: boolean; span?: boolean } = {}) => (
    <FormField label={label} htmlFor={k} error={err(k)} required={opts.required} className={opts.span ? "md:col-span-2" : undefined}>
      <Input id={k} dir={opts.dir} {...register(k)} aria-invalid={!!err(k)} />
    </FormField>
  );
  const example = (k: keyof CompanyValues) => {
    try {
      return t("settings.example", { value: formatDocNumber(String(w[k] ?? ""), 7) });
    } catch {
      return "";
    }
  };

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={handleSubmit((v) =>
        run(() => saveCompanySettingsAction(v), {
          success: "common.saved",
          onSuccess: () => router.refresh(),
          onError: (r) => Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => setError(k as keyof CompanyValues, { message: m })),
        }),
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.companyInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {text("companyNameAr", t("settings.companyNameAr"), { dir: "rtl", required: true })}
          {text("companyNameEn", t("settings.companyNameEn"), { dir: "ltr", required: true })}
          {text("addressAr", t("settings.addressAr"), { dir: "rtl" })}
          {text("addressEn", t("settings.addressEn"), { dir: "ltr" })}
          {text("phone", t("settings.phone"), { dir: "ltr" })}
          {text("email", t("settings.email"), { dir: "ltr" })}
          {text("website", t("settings.website"), { dir: "ltr" })}
          {text("taxNumber", t("settings.taxNumber"), { dir: "ltr" })}
          {text("commercialRegister", t("settings.commercialRegister"), { dir: "ltr" })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.letterhead")}</CardTitle>
          <CardDescription>{t("settings.logoHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-protected logo */}
            <img src={`/api/settings/logo?v=${logoV}`} alt={t("settings.logo")} className="h-12 w-auto rounded border bg-white p-1.5" />
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />} {t("settings.uploadLogo")}
            </Button>
            {hasCustomLogo && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => run(() => removeLogoAction(), { success: "common.saved", onSuccess: () => { setLogoV(Date.now()); router.refresh(); } })}
              >
                <RotateCcw /> {t("settings.resetLogo")}
              </Button>
            )}
          </div>
          {text("letterheadFooterAr", t("settings.footerAr"), { dir: "rtl" })}
          {text("letterheadFooterEn", t("settings.footerEn"), { dir: "ltr" })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.defaults")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <FormField label={t("settings.defaultCurrency")}>
            <Controller control={control} name="defaultCurrency" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </FormField>
          {text("vatPercent", t("settings.vatPercent"), { dir: "ltr" })}
          {text("defaultAmcPercent", t("settings.defaultAmcPercent"), { dir: "ltr" })}
          {text("defaultAmcYears", t("settings.defaultAmcYears"), { dir: "ltr" })}
          {text("quotationValidityDays", t("settings.quotationValidityDays"), { dir: "ltr" })}
          <FormField label={t("settings.arabicDigits")} hint={t("settings.digitsHint")}>
            <Controller control={control} name="arabicDigits" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LATIN">{t("settings.digitsLatin")}</SelectItem>
                  <SelectItem value="ARABIC_INDIC">{t("settings.digitsIndic")}</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.numbering")}</CardTitle>
          <CardDescription>{t("settings.numberingHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {(
            [
              ["contractNumberFormat", "contractFormat"],
              ["requestNumberFormat", "requestFormat"],
              ["quotationNumberFormat", "quotationFormat"],
              ["clientCodeFormat", "clientFormat"],
            ] as const
          ).map(([k, label]) => (
            <FormField key={k} label={t(`settings.${label}`)} htmlFor={k} error={err(k)} hint={example(k)}>
              <Input id={k} dir="ltr" className="font-mono" {...register(k)} aria-invalid={!!err(k)} />
            </FormField>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} {t("common.saveChanges")}
        </Button>
      </div>
    </form>
  );
}
