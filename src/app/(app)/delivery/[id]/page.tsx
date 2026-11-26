import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Building2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { DeleteButton } from "@/components/shared/delete-button";
import { AttachmentsPanel } from "@/components/attachments/attachments-panel";
import { toAttachmentItems } from "@/components/attachments/types";
import { TaskViews } from "@/components/delivery/task-views";
import type { ViewKey } from "@/components/delivery/view-switcher";
import { ProgressBar } from "@/components/delivery/progress-bar";
import { PROJECT_STATUS_COLOR } from "@/components/delivery/projects-table";
import { AddTaskDialog, EditProjectDialog } from "@/components/delivery/project-dialogs";
import { HandoverCard } from "@/components/delivery/handover-card";
import { can, requirePagePermission } from "@/server/auth-guard";
import { getDeliveryPeople, getProject, listTasks } from "@/server/services/delivery";
import { listAttachments } from "@/server/services/attachments";
import { deleteProjectAction } from "@/server/actions/delivery";
import { isDone, projectProgress } from "@/lib/delivery";
import { formatDate, todayUTC } from "@/lib/format";
import { CalendarCheck, CheckCircle2, ListChecks, TimerOff } from "lucide-react";
import type { AppLocale } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/delivery/[id]">) {
  const { id } = await params;
  const p = await getProject(id);
  return { title: p ? `${p.number} · ${p.title}` : "404" };
}

export default async function ProjectPage({ params, searchParams }: PageProps<"/delivery/[id]">) {
  const user = await requirePagePermission("read");
  const { id } = await params;
  const sp = await searchParams;
  const [t, locale, p, tasks, people, files] = await Promise.all([
    getTranslations(),
    getLocale() as Promise<AppLocale>,
    getProject(id),
    listTasks(user, { projectId: id }),
    getDeliveryPeople(),
    listAttachments("DELIVERY_PROJECT", id),
  ]);
  if (!p) notFound();
  const canManage = can(user.role, "manageDelivery");
  const today = todayUTC();
  const progress = projectProgress(tasks);
  const done = tasks.filter((x) => isDone(x.status)).length;
  const overdue = tasks.filter((x) => x.overdue).length;
  const late = !!p.targetDate && p.targetDate < today && !["DELIVERED", "CLIENT_ACCEPTED", "CANCELLED"].includes(p.status);
  const source = p.quotation
    ? { href: `/quotations/${p.quotation.id}`, label: t("delivery.fromQuotation", { ref: p.quotation.version > 1 ? `${p.quotation.number} v${p.quotation.version}` : p.quotation.number }) }
    : p.contract
      ? { href: `/contracts/${p.contract.id}`, label: t("delivery.fromContract", { ref: p.contract.number }) }
      : null;
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span dir="auto">{p.title}</span>
            <StatusBadge color={PROJECT_STATUS_COLOR[p.status]}>{t(`projectStatus.${p.status}`)}</StatusBadge>
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span dir="ltr">{p.number}</span>
            <Link href={`/clients/${p.client.id}`} className="inline-flex items-center gap-1 hover:underline">
              <Building2 className="size-3.5" /> {locale === "ar" ? p.client.nameAr : p.client.nameEn}
            </Link>
            {source && (
              <Link href={source.href} className="inline-flex items-center gap-1 hover:underline">
                <FileText className="size-3.5" /> <span dir="ltr">{source.label}</span>
              </Link>
            )}
          </span>
        }
        actions={
          canManage && (
            <>
              <AddTaskDialog projectId={p.id} people={people.map((x) => ({ id: x.id, name: x.name, role: x.role }))} />
              <EditProjectDialog project={{ id: p.id, title: p.title, status: p.status, startDate: iso(p.startDate), targetDate: iso(p.targetDate), notes: p.notes ?? "" }} />
              {done === 0 && <DeleteButton action={deleteProjectAction.bind(null, p.id)} redirectTo="/delivery" successKey="delivery.deleted" />}
            </>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-2 py-4">
          <CardContent className="space-y-2 px-4">
            <p className="text-sm text-muted-foreground">{t("delivery.progress")}</p>
            <ProgressBar value={progress} label={t("delivery.progress")} tone={late ? "danger" : progress === 100 ? "success" : "default"} />
            <p className="text-xs text-muted-foreground">{t("delivery.progressOf", { done, total: tasks.length })}</p>
          </CardContent>
        </Card>
        <KpiCard label={t("delivery.tasksCount")} value={tasks.length} icon={ListChecks} />
        <KpiCard label={t("delivery.overdueTasks")} value={overdue} icon={TimerOff} tone={overdue ? "danger" : "default"} />
        <KpiCard
          label={t("delivery.targetDate")}
          value={formatDate(p.targetDate, locale)}
          hint={p.startDate ? `${t("delivery.startDate")}: ${formatDate(p.startDate, locale)}` : undefined}
          icon={p.status === "DELIVERED" || p.status === "CLIENT_ACCEPTED" ? CheckCircle2 : CalendarCheck}
          tone={late ? "danger" : "accent"}
        />
      </div>

      {p.notes && <p className="mb-6 whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">{p.notes}</p>}

      <TaskViews
        rows={tasks}
        people={people}
        today={today.toISOString()}
        views={["table", "kanban", "timeline"]}
        view={(typeof sp.view === "string" ? sp.view : "table") as ViewKey}
        userId={user.id}
        canManage={canManage}
        showProject={false}
        showPrice
        project={{ startDate: p.startDate?.toISOString() ?? null, targetDate: p.targetDate?.toISOString() ?? null }}
      />

      <div className="mt-6 space-y-6">
      {p.status !== "CANCELLED" && (
        <HandoverCard
          projectId={p.id}
          canManage={canManage}
          canEmail={can(user.role, "sendEmail")}
          hasDelivered={done > 0}
          accepted={
            p.status === "CLIENT_ACCEPTED" && p.acceptedAt
              ? { at: p.acceptedAt.toISOString(), fileId: p.signedNoteId, filename: files.find((x) => x.id === p.signedNoteId)?.filename ?? null }
              : null
          }
          partialNote={
            p.status !== "CLIENT_ACCEPTED" && p.signedNoteId
              ? { fileId: p.signedNoteId, filename: files.find((x) => x.id === p.signedNoteId)?.filename ?? null }
              : null
          }
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("files.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentsPanel entityType="DELIVERY_PROJECT" entityId={p.id} items={toAttachmentItems(files)} canWrite={canManage} canDelete={canManage} revalidate={`/delivery/${p.id}`} />
        </CardContent>
      </Card>
      </div>
    </>
  );
}
