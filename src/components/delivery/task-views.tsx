"use client";

/** View switcher + shared filters + the selected task view. */
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { TasksTable } from "./tasks-table";
import { TasksKanban } from "./tasks-kanban";
import { TasksCalendar } from "./tasks-calendar";
import { WorkloadView } from "./workload-view";
import { ProjectTimeline } from "./project-timeline";
import { TaskFilterBar, useTaskFilters } from "./task-filters";
import { ViewSwitcher, type ViewKey } from "./view-switcher";
import type { TaskRow } from "@/server/services/delivery";

export function TaskViews({
  rows,
  people,
  today,
  views,
  view,
  userId,
  canManage,
  showProject = true,
  showPrice = false,
  capacity = 40,
  project,
}: {
  rows: TaskRow[];
  people: { id: string; name: string }[];
  today: string;
  views: ViewKey[];
  view: ViewKey;
  userId: string;
  canManage: boolean;
  showProject?: boolean;
  showPrice?: boolean;
  capacity?: number;
  project?: { startDate: string | null; targetDate: string | null };
}) {
  const t = useTranslations("views");
  const now = useMemo(() => new Date(today), [today]);
  const { filtered } = useTaskFilters(rows, now);
  const current = views.includes(view) ? view : views[0];
  return (
    <div className="space-y-3 [&>*]:min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewSwitcher views={views} current={current} />
        <p className="text-xs text-muted-foreground" aria-live="polite">{t("showing", { count: filtered.length })}</p>
      </div>
      <TaskFilterBar rows={rows} people={people} showProject={showProject} hideStatus={current === "kanban"} />
      {current === "table" && <TasksTable rows={filtered} showProject={showProject} showPrice={showPrice} people={people} today={today} withFilters={false} />}
      {current === "kanban" && <TasksKanban rows={filtered} userId={userId} canManage={canManage} showProject={showProject} />}
      {current === "calendar" && <TasksCalendar rows={filtered} today={today} />}
      {current === "workload" && <WorkloadView rows={filtered} people={people} today={today} capacity={capacity} />}
      {current === "timeline" && <ProjectTimeline rows={filtered} today={today} projectStart={project?.startDate} projectTarget={project?.targetDate} />}
    </div>
  );
}
