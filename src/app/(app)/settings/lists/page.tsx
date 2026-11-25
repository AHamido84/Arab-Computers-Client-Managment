import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { LookupsEditor } from "@/components/settings/lookups-editor";
import { requirePagePermission } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { lookupKinds } from "@/lib/validation/lookup";

export default async function ListsPage() {
  await requirePagePermission("manageSettings");
  const [t, rows] = await Promise.all([
    getTranslations("settings"),
    db.lookupValue.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { labelEn: "asc" }] }),
  ]);
  const data = Object.fromEntries(
    lookupKinds.map((k) => [
      k,
      rows
        .filter((r) => r.kind === k)
        .map((r) => ({ id: r.id, key: r.key, labelAr: r.labelAr, labelEn: r.labelEn, color: r.color, active: r.active, isSystem: r.isSystem })),
    ]),
  ) as Record<(typeof lookupKinds)[number], LookupRow[]>;
  return (
    <>
      <PageHeader title={t("lists")} description={t("listsDesc")} />
      <LookupsEditor data={data} />
    </>
  );
}
export type LookupRow = { id: string; key: string; labelAr: string; labelEn: string; color: string | null; active: boolean; isSystem: boolean };
