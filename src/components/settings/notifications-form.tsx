"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MailCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { saveNotificationSettingsAction } from "@/server/actions/settings";
import { sendTestEmailAction } from "@/server/actions/email";

type Values = { intervals: string; notifyOverdueEveryDays: string; notifyByEmail: boolean; taskReminderDays: string; weeklyCapacityHours: string; deliveryDigest: boolean; emailProvider: "RESEND" | "SMTP"; emailFrom: string; emailReplyTo: string };
type Status = { provider: string; configured: boolean; missing: readonly string[]; devOutbox: boolean };

export function NotificationsForm({ defaultValues, status }: { defaultValues: Values; status: Record<"RESEND" | "SMTP", Status> }) {
  const t = useTranslations();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const test = useServerAction();
  const { register, control, handleSubmit, setError, formState } = useForm<Values>({ defaultValues });
  const provider = useWatch({ control, name: "emailProvider" });
  const st = status[provider];

  const submit = handleSubmit((v) =>
    run(
      () =>
        saveNotificationSettingsAction({
          notifyIntervals: v.intervals.split(/[,،\s]+/).filter(Boolean),
          notifyOverdueEveryDays: v.notifyOverdueEveryDays,
          notifyByEmail: v.notifyByEmail,
          taskReminderDays: v.taskReminderDays.split(/[,،\s]+/).filter(Boolean),
          weeklyCapacityHours: v.weeklyCapacityHours,
          deliveryDigest: v.deliveryDigest,
          emailProvider: v.emailProvider,
          emailFrom: v.emailFrom,
          emailReplyTo: v.emailReplyTo,
        }),
      {
        success: "common.saved",
        onSuccess: () => router.refresh(),
        onError: (r) =>
          Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) =>
            setError((k.startsWith("notifyIntervals") ? "intervals" : k.startsWith("taskReminderDays") ? "taskReminderDays" : k) as keyof Values, { message: m }),
          ),
      },
    ),
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.reminders")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label={t("settings.intervals")} htmlFor="intervals" hint={t("settings.intervalsHint")} error={formState.errors.intervals?.message}>
            <Input id="intervals" dir="ltr" {...register("intervals")} />
          </FormField>
          <FormField label={t("settings.overdueEvery")} htmlFor="overdueEvery" error={formState.errors.notifyOverdueEveryDays?.message}>
            <Input id="overdueEvery" dir="ltr" inputMode="numeric" {...register("notifyOverdueEveryDays")} />
          </FormField>
          <Controller
            control={control}
            name="notifyByEmail"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <Switch checked={field.value} onCheckedChange={field.onChange} /> {t("settings.notifyByEmail")}
              </label>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.deliverySection")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label={t("settings.taskReminderDays")} htmlFor="taskReminderDays" hint={t("settings.taskReminderDaysHint")} error={formState.errors.taskReminderDays?.message}>
            <Input id="taskReminderDays" dir="ltr" {...register("taskReminderDays")} />
          </FormField>
          <FormField label={t("settings.weeklyCapacityHours")} htmlFor="weeklyCapacityHours" hint={t("settings.weeklyCapacityHint")} error={formState.errors.weeklyCapacityHours?.message}>
            <Input id="weeklyCapacityHours" dir="ltr" inputMode="numeric" {...register("weeklyCapacityHours")} />
          </FormField>
          <Controller
            control={control}
            name="deliveryDigest"
            render={({ field }) => (
              <label className="flex items-start gap-2 text-sm md:col-span-2">
                <Switch checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                <span>
                  {t("settings.deliveryDigest")}
                  <span className="block text-xs text-muted-foreground">{t("settings.deliveryDigestHint")}</span>
                </span>
              </label>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.emailSection")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label={t("settings.provider")}>
            <Controller
              control={control}
              name="emailProvider"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESEND">Resend</SelectItem>
                    <SelectItem value="SMTP">SMTP (Nodemailer)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("settings.providerStatus")}>
            <p className="flex h-8 items-center gap-2 text-sm">
              {st.configured ? (
                <><CheckCircle2 className="size-4 text-success" /> {t("settings.configured")}</>
              ) : (
                <><XCircle className="size-4 text-destructive" /> <span>{t("settings.notConfigured", { vars: st.missing.join(", ") })}</span></>
              )}
            </p>
          </FormField>
          <FormField label={t("settings.emailFrom")} htmlFor="emailFrom" hint={t("settings.emailFromHint")}>
            <Input id="emailFrom" dir="ltr" {...register("emailFrom")} />
          </FormField>
          <FormField label={t("settings.emailReplyTo")} htmlFor="emailReplyTo" error={formState.errors.emailReplyTo?.message}>
            <Input id="emailReplyTo" dir="ltr" {...register("emailReplyTo")} />
          </FormField>
          {st.devOutbox && (
            <Alert className="md:col-span-2">
              <AlertDescription>{t("settings.devOutbox")}</AlertDescription>
            </Alert>
          )}
          <div className="md:col-span-2">
            <Button
              type="button"
              variant="outline"
              disabled={test.pending}
              onClick={() =>
                test.run(() => sendTestEmailAction(), {
                  onSuccess: (d) => toast.success(t("settings.testSent", { email: d.email })),
                })
              }
            >
              {test.pending ? <Loader2 className="animate-spin" /> : <MailCheck />} {t("settings.sendTest")}
            </Button>
          </div>
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
