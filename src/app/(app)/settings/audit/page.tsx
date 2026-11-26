import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { AuditTable } from "@/components/settings/audit-table";
import { requirePagePermission } from "@/server/auth-guard";
import { db } from "@/lib/db";

const LIMIT = 2000;

export async function generateMetadata() {
  return { title: (await getTranslations("audit"))("title") };
}

export default async function AuditPage() {
  await requirePagePermission("manageSettings");
  const [t, rows] = await Promise.all([
    getTranslations("audit"),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: LIMIT, include: { actor: { select: { name: true } } } }),
  ]);
  return (
    <>
      <PageHeader title={t("title")} description={t("limitNote", { count: LIMIT })} />
      <AuditTable rows={rows.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), actor: r.actor?.name ?? null, action: r.action, entity: r.entity, entityId: r.entityId, diff: r.diff }))} />
    </>
  );
}
