import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Building2, FolderKanban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { DeleteButton } from "@/components/shared/delete-button";
import { AttachmentsPanel } from "@/components/attachments/attachments-panel";
import { toAttachmentItems } from "@/components/attachments/types";
import { TaskWorkspace, type TaskDTO } from "@/components/delivery/task-workspace";
import { TASK_STATUS_COLOR } from "@/components/delivery/tasks-table";
import { can, requireUser } from "@/server/auth-guard";
import { getDeliveryPeople, getTaskDetail, taskAccess } from "@/server/services/delivery";
import { listAttachments } from "@/server/services/attachments";
import { deleteTaskAction } from "@/server/actions/delivery";
import { isTaskOverdue } from "@/lib/delivery";
import { todayUTC } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/tasks/[id]">) {
  const { id } = await params;
  const task = await getTaskDetail(id);
  return { title: task?.title ?? "404" };
}

export default async function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const acc = await taskAccess(id, user);
  if (!acc) notFound();
  if (!acc.canView) redirect("/my-tasks");
  const [t, locale, task, people, files] = await Promise.all([getTranslations(), getLocale(), getTaskDetail(id), getDeliveryPeople(), listAttachments("DELIVERY_TASK", id)]);
  if (!task) notFound();
  const today = todayUTC();
  const iso = (d: Date | null) => d?.toISOString() ?? null;
  const dto: TaskDTO = {
    id: task.id,
    title: task.title,
    scope: task.scope,
    status: task.status,
    priority: task.priority,
    progress: task.progress,
    price: acc.showPrice && task.price != null ? Number(task.price) : null,
    currency: task.currency,
    estimatedHours: task.estimatedHours != null ? Number(task.estimatedHours) : null,
    startDate: iso(task.startDate),
    dueDate: iso(task.dueDate),
    originalDueDate: iso(task.originalDueDate),
    delayReason: task.delayReason,
    overdue: isTaskOverdue(task, today),
    assignees: task.assignees.map((a) => ({ userId: a.userId, role: a.role })),
    watchers: task.watchers.map((w) => w.userId),
    checklist: task.checklist.map((c) => ({ id: c.id, title: c.title, done: c.done })),
    comments: task.comments.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt.toISOString(), author: c.author, mentions: c.mentions })),
    timeLogs: task.timeLogs.map((l) => ({ id: l.id, date: l.date.toISOString(), hours: Number(l.hours), note: l.note, user: l.user })),
    dueChanges: task.dueDateChanges.map((c) => ({ id: c.id, oldDate: iso(c.oldDate), newDate: iso(c.newDate), reason: c.reason, createdAt: c.createdAt.toISOString(), by: c.changedBy?.name ?? null })),
  };
  const showBusiness = can(user.role, "read");
  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span dir="auto">{task.title}</span>
            <StatusBadge color={TASK_STATUS_COLOR[task.status]}>{t(`taskStatus.${task.status}`)}</StatusBadge>
            <StatusBadge color={STATUS_COLOR[task.priority]}>{t(`priority.${task.priority}`)}</StatusBadge>
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {showBusiness ? (
              <Link href={`/delivery/${task.project.id}`} className="inline-flex items-center gap-1 hover:underline">
                <FolderKanban className="size-3.5" /> <span dir="ltr">{task.project.number}</span> · <span dir="auto">{task.project.title}</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1">
                <FolderKanban className="size-3.5" /> <span dir="ltr">{task.project.number}</span> · <span dir="auto">{task.project.title}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3.5" /> {locale === "ar" ? task.project.client.nameAr : task.project.client.nameEn}
            </span>
            {showBusiness && task.request && (
              <Link href={`/requests/${task.request.id}`} className="hover:underline" dir="ltr">
                {task.request.number}
              </Link>
            )}
          </span>
        }
        actions={acc.canManage && <DeleteButton action={deleteTaskAction.bind(null, task.id)} redirectTo={`/delivery/${task.project.id}`} successKey="tasks.deleted" />}
      />
      {!acc.canWork && acc.canComment && <p className="mb-4 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{t("tasks.watcherOnly")}</p>}
      <TaskWorkspace
        task={dto}
        people={people.map((p) => ({ id: p.id, name: p.name, role: p.role }))}
        perms={{ canWork: acc.canWork, canComment: acc.canComment, canChangeDue: acc.canChangeDue, canManage: acc.canManage, showPrice: acc.showPrice }}
        meId={user.id}
        today={today.toISOString()}
      />
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("tasks.filesTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentsPanel entityType="DELIVERY_TASK" entityId={task.id} items={toAttachmentItems(files)} canWrite={acc.canWork} canDelete={acc.canWork} revalidate={`/tasks/${task.id}`} />
        </CardContent>
      </Card>
    </>
  );
}
