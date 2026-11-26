"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, CalendarClock, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerAction } from "@/components/forms/use-action";
import { useFmt } from "@/components/shared/format-provider";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { ProgressBar } from "./progress-bar";
import { TASK_STATUSES } from "@/lib/delivery";
import { updateTaskAction } from "@/server/actions/delivery";
import type { TaskRow } from "@/server/services/delivery";
import { cn } from "@/lib/utils";

/** Compact task card with a quick status change (My tasks). */
export function MyTaskCard({ task, meId }: { task: TaskRow; meId: string }) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const lead = task.assignees.find((a) => a.userId === meId)?.role === "LEAD";
  return (
    <Card className={cn("gap-2 py-4", task.overdue && "border-destructive/50")}>
      <CardContent className="space-y-2 px-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/tasks/${task.id}`} className="font-medium leading-snug hover:underline" dir="auto">
            {task.title}
          </Link>
          {lead && <Crown className="size-4 shrink-0 text-primary" aria-label={t("assigneeRole.LEAD")} />}
        </div>
        <p className="text-xs text-muted-foreground">
          <span dir="ltr">{task.project.number}</span> · <span dir="auto">{task.project.title}</span> · {f.name(task.project.client)}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge color={STATUS_COLOR[task.priority]}>{t(`priority.${task.priority}`)}</StatusBadge>
          {task.dueDate && (
            <span className={cn("inline-flex items-center gap-1", task.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
              {task.overdue ? <AlertTriangle className="size-3" /> : <CalendarClock className="size-3" />} {f.date(task.dueDate)}
            </span>
          )}
          {task.estimatedHours != null && (
            <span className="text-muted-foreground">{t("tasks.estimatedVsActual", { actual: f.number(task.loggedHours, 0), estimated: f.number(task.estimatedHours, 0) })}</span>
          )}
        </div>
        <ProgressBar value={task.progress} label={t("tasks.progress")} tone={task.overdue ? "danger" : task.progress === 100 ? "success" : "default"} />
        <Select
          value={task.status}
          disabled={pending}
          onValueChange={(v) => run(() => updateTaskAction(task.id, { status: v }), { success: "tasks.saved", onSuccess: () => router.refresh() })}
        >
          <SelectTrigger size="sm" className="w-full" aria-label={t("tasks.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`taskStatus.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
