import { getTranslations } from "next-intl/server";
import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TaskViews } from "@/components/delivery/task-views";
import type { ViewKey } from "@/components/delivery/view-switcher";
import { getSettings } from "@/server/services/settings";
import { can } from "@/server/auth-guard";
import { requirePagePermission } from "@/server/auth-guard";
import { getDeliveryPeople, listTasks } from "@/server/services/delivery";
import { todayUTC } from "@/lib/format";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("tasks") };
}

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const user = await requirePagePermission("read");
  const [t, rows, people, settings, sp] = await Promise.all([getTranslations(), listTasks(user), getDeliveryPeople(), getSettings(), searchParams]);
  return (
    <>
      <PageHeader title={t("nav.tasks")} />
      {rows.length === 0 ? (
        <EmptyState icon={ListChecks} title={t("tasks.empty")} />
      ) : (
        <TaskViews
          rows={rows}
          people={people}
          today={todayUTC().toISOString()}
          views={["table", "kanban", "calendar", "workload"]}
          view={(typeof sp.view === "string" ? sp.view : "table") as ViewKey}
          userId={user.id}
          canManage={can(user.role, "manageDelivery")}
          showPrice
          capacity={settings.weeklyCapacityHours}
        />
      )}
    </>
  );
}
