"use client";

/**
 * Task Kanban. Cards move between status columns by drag & drop (or the card
 * menu for keyboard/touch). Only tasks the user can work on are draggable.
 */
import Link from "next/link";
import { createContext, useContext, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { AlertTriangle, CalendarClock, Crown, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { useFmt } from "@/components/shared/format-provider";
import { ProgressBar } from "./progress-bar";
import { TASK_STATUS_COLOR } from "./tasks-table";
import { TASK_STATUSES, isDone } from "@/lib/delivery";
import { updateTaskAction } from "@/server/actions/delivery";
import type { TaskRow } from "@/server/services/delivery";
import { cn } from "@/lib/utils";

type Status = (typeof TASK_STATUSES)[number];
const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const DragGuard = createContext<{ current: boolean }>({ current: false });

export function TasksKanban({ rows, userId, canManage, showProject = true }: { rows: TaskRow[]; userId: string; canManage: boolean; showProject?: boolean }) {
  const t = useTranslations();
  // Optimistic status overrides on top of the (filtered) server rows.
  const [moved, setMoved] = useState<Record<string, Status>>({});
  const items = useMemo(
    () => rows.map((r) => (moved[r.id] && moved[r.id] !== r.status ? { ...r, status: moved[r.id], overdue: r.overdue && !isDone(moved[r.id]), progress: isDone(moved[r.id]) ? 100 : r.progress } : r)),
    [rows, moved],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const justDragged = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const canWork = (r: TaskRow) => canManage || r.assignees.some((a) => a.userId === userId);

  async function move(id: string, status: Status) {
    const cur = items.find((r) => r.id === id);
    if (!cur || cur.status === status || !canWork(cur)) return;
    const before = moved[id];
    setMoved((m) => ({ ...m, [id]: status }));
    const res = await updateTaskAction(id, { status });
    if (!res.ok) {
      setMoved((m) => {
        const next = { ...m };
        if (before) next[id] = before;
        else delete next[id];
        return next;
      });
      toast.error(t.has(res.error) ? t(res.error) : t("common.error"));
    } else toast.success(`${cur.title} → ${t(`taskStatus.${status}`)}`);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 250);
    if (e.over) move(String(e.active.id), e.over.id as Status);
  }
  const active = items.find((r) => r.id === activeId);

  return (
    <div className="space-y-2">
      {items.some(canWork) && <p className="text-xs text-muted-foreground">{t("views.dragHint")}</p>}
      <DragGuard.Provider value={justDragged}>
        <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {TASK_STATUSES.map((s) => {
              const col = items
                .filter((r) => r.status === s)
                .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
              return (
                <Column key={s} status={s} count={col.length} label={t(`taskStatus.${s}`)}>
                  {col.map((r) => (
                    <KanbanCard key={r.id} r={r} draggable={canWork(r)} showProject={showProject} onMove={move} />
                  ))}
                </Column>
              );
            })}
          </div>
          <DragOverlay>{active ? <CardBody r={active} showProject={showProject} overlay /> : null}</DragOverlay>
        </DndContext>
      </DragGuard.Provider>
    </div>
  );
}

function KanbanCard({ r, draggable, showProject, onMove }: { r: TaskRow; draggable: boolean; showProject: boolean; onMove: (id: string, s: Status) => void }) {
  const t = useTranslations();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: r.id, disabled: !draggable, attributes: { role: "group", roleDescription: t("requests.draggableCard") } });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("touch-manipulation", isDragging && "opacity-30")}>
      <CardBody
        r={r}
        showProject={showProject}
        grab={draggable}
        menu={
          draggable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label={t("requests.changeStatus")} onPointerDown={(e) => e.stopPropagation()}>
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t("requests.changeStatus")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={r.status} onValueChange={(v) => onMove(r.id, v as Status)}>
                  {TASK_STATUSES.map((s) => (
                    <DropdownMenuRadioItem key={s} value={s}>
                      {t(`taskStatus.${s}`)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />
    </div>
  );
}

function CardBody({ r, overlay, menu, grab, showProject }: { r: TaskRow; overlay?: boolean; menu?: React.ReactNode; grab?: boolean; showProject: boolean }) {
  const t = useTranslations();
  const guard = useContext(DragGuard);
  const f = useFmt();
  const lead = r.assignees.find((a) => a.role === "LEAD");
  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border bg-card p-3 text-sm shadow-xs",
        r.overdue && "border-destructive/50 bg-destructive/5",
        overlay && "rotate-2 shadow-lg",
        grab && !overlay && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/tasks/${r.id}`} dir="auto" className="font-medium leading-snug hover:underline" onClick={(e) => guard.current && e.preventDefault()}>
          {r.title}
        </Link>
        {menu}
      </div>
      {showProject && (
        <div className="text-xs text-muted-foreground">
          <span dir="ltr">{r.project.number}</span> · {f.name(r.project.client)}
        </div>
      )}
      <ProgressBar value={r.progress} label={t("tasks.progress")}/>
      <div className="flex flex-wrap items-center gap-1.5">
        {r.priority !== "MEDIUM" && <StatusBadge color={STATUS_COLOR[r.priority]}>{t(`priority.${r.priority}`)}</StatusBadge>}
        {r.dueDate && (
          <span className={cn("inline-flex items-center gap-1 text-xs", r.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
            {r.overdue ? <AlertTriangle className="size-3" /> : <CalendarClock className="size-3" />}
            {f.date(r.dueDate)}
          </span>
        )}
      </div>
      {r.assignees.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {lead && (
            <span className="inline-flex items-center gap-1 text-foreground">
              <Crown className="size-3 text-primary" aria-label={t("assigneeRole.LEAD")} /> {lead.name}
            </span>
          )}
          {r.assignees.filter((a) => a.role !== "LEAD").map((a) => (
            <span key={a.userId}>{a.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function Column({ status, label, count, children }: { status: Status; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} aria-label={label} className={cn("flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors", isOver && "border-primary bg-accent/50")}>
      <header className="flex items-center justify-between border-b px-3 py-2">
        <StatusBadge color={TASK_STATUS_COLOR[status]}>{label}</StatusBadge>
        <span className="text-xs text-muted-foreground">{count}</span>
      </header>
      <div className="flex min-h-40 flex-col gap-2 p-2">{children}</div>
    </section>
  );
}
