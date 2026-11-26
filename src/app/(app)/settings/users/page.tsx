import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { UsersManager } from "@/components/settings/users-manager";
import { requirePagePermission } from "@/server/auth-guard";
import { db } from "@/lib/db";

export async function generateMetadata() {
  return { title: (await getTranslations("users"))("title") };
}

export default async function UsersPage() {
  const me = await requirePagePermission("manageUsers");
  const [t, users] = await Promise.all([
    getTranslations("users"),
    db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: { id: true, name: true, email: true, role: true, locale: true, active: true, lastLoginAt: true } }),
  ]);
  return (
    <>
      <PageHeader title={t("title")} />
      <UsersManager meId={me.id} users={users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))} />
    </>
  );
}
