import { getTranslations } from "next-intl/server";
import { ListTodo } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { MyTaskCard } from "@/components/delivery/my-task-card";
import { dueBucket } from "@/components/delivery/tasks-table";
import { requirePagePermission } from "@/server/auth-guard";
import { listTasks } from "@/server/services/delivery";
import { isDone } from "@/lib/delivery";
import { todayUTC } from "@/lib/format";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("myTasks") };
}

/** Tasks assigned to the signed-in user, grouped by urgency. */
export default async function MyTasksPage() {
  const user = await requirePagePermission("tasks");
  const [t, rows] = await Promise.all([getTranslations(), listTasks(user, { mine: true })]);
  const today = todayUTC();
  const open = rows.filter((r) => !isDone(r.status));
  const groups = [
    { key: "overdue", title: t("tasks.overdue"), items: open.filter((r) => dueBucket(r, today) === "overdue") },
    { key: "week", title: t("tasks.dueThisWeek"), items: open.filter((r) => dueBucket(r, today) === "week") },
    { key: "later", title: t("tasks.later"), items: open.filter((r) => dueBucket(r, today) === "later") },
    { key: "none", title: t("tasks.noDate"), items: open.filter((r) => dueBucket(r, today) === "none") },
    { key: "done", title: t("tasks.done"), items: rows.filter((r) => isDone(r.status)).slice(0, 12) },
  ].filter((g) => g.items.length);
  return (
    <>
      <PageHeader title={t("tasks.myTitle")} />
      {open.length === 0 && <EmptyState icon={ListTodo} title={t("tasks.myEmpty")} className="mb-6" />}
      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`grp-${g.key}`}>
            <h2 id={`grp-${g.key}`} className={`mb-3 text-sm font-semibold ${g.key === "overdue" ? "text-destructive" : "text-muted-foreground"}`}>
              {g.title} ({g.items.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((task) => (
                <MyTaskCard key={task.id} task={task} meId={user.id} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
