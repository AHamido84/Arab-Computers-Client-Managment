import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ClipboardList, Columns3, Plus, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RequestsTable } from "@/components/requests/requests-table";
import { RequestsKanban } from "@/components/requests/requests-kanban";
import { can, requireUser } from "@/server/auth-guard";
import { listRequests } from "@/server/services/requests";
import { getAssignableUsers, getClientOptions } from "@/server/services/lookups";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  return { title: (await getTranslations("requests"))("title") };
}

export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const user = await requireUser();
  const { view } = (await searchParams) as { view?: string };
  const kanban = view === "kanban";
  const [t, rows, users, clients] = await Promise.all([getTranslations(), listRequests(), getAssignableUsers(), getClientOptions()]);
  const canWrite = can(user.role, "write");
  const newButton = canWrite && (
    <Button asChild>
      <Link href="/requests/new">
        <Plus /> {t("requests.new")}
      </Link>
    </Button>
  );
  const toggle = (
    <div className="inline-flex rounded-lg border p-0.5" role="group">
      {[
        { v: "table", icon: Table2, label: t("requests.table"), on: !kanban },
        { v: "kanban", icon: Columns3, label: t("requests.kanban"), on: kanban },
      ].map((o) => (
        <Button key={o.v} asChild size="sm" variant={o.on ? "secondary" : "ghost"} className={cn(!o.on && "text-muted-foreground")}>
          <Link href={o.v === "table" ? "/requests" : "/requests?view=kanban"} aria-current={o.on ? "page" : undefined}>
            <o.icon /> {o.label}
          </Link>
        </Button>
      ))}
    </div>
  );
  return (
    <>
      <PageHeader
        title={t("requests.title")}
        actions={
          <>
            {toggle}
            {newButton}
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("common.emptyTitle")} description={t("common.emptyDescription")} action={newButton} />
      ) : kanban ? (
        <RequestsKanban key={rows.map((r) => r.id + r.status).join()} rows={rows} users={users} canWrite={canWrite} />
      ) : (
        <RequestsTable rows={rows} users={users} clients={clients} />
      )}
    </>
  );
}
