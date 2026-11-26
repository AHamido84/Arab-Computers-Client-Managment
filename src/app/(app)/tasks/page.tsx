import { getTranslations } from "next-intl/server";
import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TasksTable } from "@/components/delivery/tasks-table";
import { requirePagePermission } from "@/server/auth-guard";
import { getDeliveryPeople, listTasks } from "@/server/services/delivery";
import { todayUTC } from "@/lib/format";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("tasks") };
}

export default async function TasksPage() {
  const user = await requirePagePermission("read");
  const [t, rows, people] = await Promise.all([getTranslations(), listTasks(user), getDeliveryPeople()]);
  return (
    <>
      <PageHeader title={t("nav.tasks")} />
      {rows.length === 0 ? (
        <EmptyState icon={ListChecks} title={t("tasks.empty")} />
      ) : (
        <TasksTable rows={rows} showPrice people={people} today={todayUTC().toISOString()} />
      )}
    </>
  );
}
