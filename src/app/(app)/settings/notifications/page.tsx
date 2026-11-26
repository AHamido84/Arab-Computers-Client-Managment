import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { requirePagePermission } from "@/server/auth-guard";
import { getSettings } from "@/server/services/settings";
import { devOutboxEnabled } from "@/server/services/email";

export async function generateMetadata() {
  return { title: (await getTranslations("settings"))("notificationsTitle") };
}

export default async function NotificationSettingsPage() {
  await requirePagePermission("manageSettings");
  const [t, s] = await Promise.all([getTranslations("settings"), getSettings()]);
  const statusFor = (provider: "RESEND" | "SMTP", vars: string[]) => {
    const missing = vars.filter((v) => !process.env[v]);
    return { provider, configured: missing.length === 0, missing, devOutbox: missing.length > 0 && devOutboxEnabled() };
  };
  return (
    <>
      <PageHeader title={t("notificationsTitle")} description={t("notificationsDesc")} />
      <NotificationsForm
        status={{ RESEND: statusFor("RESEND", ["RESEND_API_KEY"]), SMTP: statusFor("SMTP", ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"]) }}
        defaultValues={{
          intervals: s.notifyIntervals.join(", "),
          notifyOverdueEveryDays: String(s.notifyOverdueEveryDays),
          notifyByEmail: s.notifyByEmail,
          emailProvider: s.emailProvider,
          emailFrom: s.emailFrom ?? "",
          emailReplyTo: s.emailReplyTo ?? "",
        }}
      />
    </>
  );
}
