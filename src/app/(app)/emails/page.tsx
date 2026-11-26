import { getTranslations } from "next-intl/server";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { EmailsTable, type EmailRow } from "@/components/email/emails-table";
import { requirePagePermission } from "@/server/auth-guard";
import { db } from "@/lib/db";

export async function generateMetadata() {
  return { title: (await getTranslations("email"))("logTitle") };
}

export default async function EmailsPage() {
  await requirePagePermission("read");
  const [t, logs] = await Promise.all([
    getTranslations("email"),
    db.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: { client: { select: { id: true, nameAr: true, nameEn: true } }, sentBy: { select: { name: true } } },
    }),
  ]);
  const rows: EmailRow[] = logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    client: l.client,
    to: l.to,
    cc: l.cc,
    subject: l.subject,
    status: l.status,
    error: l.error,
    provider: l.provider,
    attachmentName: l.attachmentName,
    hasAttachment: !!l.attachmentUrl,
    relatedType: l.relatedType,
    relatedId: l.relatedId,
    sentBy: l.sentBy?.name ?? null,
  }));
  return (
    <>
      <PageHeader title={t("logTitle")} />
      {rows.length === 0 ? <EmptyState icon={Mail} title={t("empty")} /> : <EmailsTable rows={rows} />}
    </>
  );
}
