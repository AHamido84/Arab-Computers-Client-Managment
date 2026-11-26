"use client";

/**
 * Kanban board for requests. Drag a card to another column to change its
 * status (optimistic update, reverted on error). Each card also has a
 * status menu so the board works with keyboard and touch.
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
import { AlertTriangle, CalendarClock, MoreVertical, Search, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { useFmt } from "@/components/shared/format-provider";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/validation/request";
import { setRequestStatusAction } from "@/server/actions/requests";
import type { RequestRow } from "@/server/services/requests";
import { cn } from "@/lib/utils";

const PRIORITY_RANK = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

/** True for a moment after a drag ends, so the click that follows a drop doesn't open the card. */
const DragGuard = createContext<{ current: boolean }>({ current: false });

export function RequestsKanban({ rows, users, canWrite }: { rows: RequestRow[]; users: { id: string; name: string }[]; canWrite: boolean }) {
  const t = useTranslations();
  const [items, setItems] = useState(rows);
  const [q, setQ] = useState("");
  const [assignee, setAssignee] = useState("__all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const justDragged = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const visible = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((r) => {
      if (assignee !== "__all" && (r.assignee?.id ?? "") !== assignee) return false;
      if (overdueOnly && !r.overdue) return false;
      const hay = [r.number, r.title, r.client.nameAr, r.client.nameEn].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [items, q, assignee, overdueOnly]);

  async function move(id: string, status: RequestStatus) {
    const prev = items;
    const current = prev.find((r) => r.id === id);
    if (!current || current.status === status) return;
    setItems((list) => list.map((r) => (r.id === id ? { ...r, status, overdue: r.overdue && !["DELIVERED", "CLOSED", "REJECTED"].includes(status) } : r)));
    const res = await setRequestStatusAction(id, status);
    if (!res.ok) {
      setItems(prev);
      toast.error(t.has(res.error) ? t(res.error) : t("common.error"));
    } else {
      toast.success(`${current.number} → ${t(`requestStatus.${status}`)}`);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 250);
    if (e.over) move(String(e.active.id), e.over.id as RequestStatus);
  }

  const active = items.find((r) => r.id === activeId);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("table.search")} className="ps-8" aria-label={t("table.search")} />
        </div>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger size="sm" className="min-w-40" aria-label={t("requests.assignee")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">
              {t("requests.assignee")}: {t("common.all")}
            </SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={overdueOnly} onCheckedChange={setOverdueOnly} /> {t("requests.overdueOnly")}
        </label>
        {canWrite && <p className="text-xs text-muted-foreground sm:ms-auto">{t("requests.dragHint")}</p>}
      </div>

      <DragGuard.Provider value={justDragged}>
      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {REQUEST_STATUSES.map((s) => {
            const col = visible
              .filter((r) => r.status === s)
              .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
            return (
              <Column key={s} status={s} count={col.length} label={t(`requestStatus.${s}`)}>
                {col.map((r) => (
                  <KanbanCard key={r.id} r={r} canWrite={canWrite} onMove={move} />
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay>{active ? <CardBody r={active} overlay /> : null}</DragOverlay>
      </DndContext>
      </DragGuard.Provider>
    </div>
  );
}

function KanbanCard({ r, canWrite, onMove }: { r: RequestRow; canWrite: boolean; onMove: (id: string, s: RequestStatus) => void }) {
  const t = useTranslations();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: r.id, disabled: !canWrite, attributes: { role: "group", roleDescription: t("requests.draggableCard") } });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("touch-manipulation", isDragging && "opacity-30")}>
      <CardBody
        r={r}
        menu={
          canWrite && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label={t("requests.changeStatus")} onPointerDown={(e) => e.stopPropagation()}>
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t("requests.changeStatus")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={r.status} onValueChange={(v) => onMove(r.id, v as RequestStatus)}>
                  {REQUEST_STATUSES.map((s) => (
                    <DropdownMenuRadioItem key={s} value={s}>
                      {t(`requestStatus.${s}`)}
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

function CardBody({ r, overlay, menu }: { r: RequestRow; overlay?: boolean; menu?: React.ReactNode }) {
  const t = useTranslations();
  const guard = useContext(DragGuard);
  const f = useFmt();
  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border bg-card p-3 text-sm shadow-xs",
        r.overdue && "border-destructive/50 bg-destructive/5",
        overlay && "rotate-2 shadow-lg",
        !overlay && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/requests/${r.id}`}
          className="font-medium leading-snug hover:underline"
          onClick={(e) => {
            if (guard.current) e.preventDefault();
          }}
        >
          {r.title}
        </Link>
        {menu}
      </div>
      <div className="text-xs text-muted-foreground">
        <span dir="ltr">{r.number}</span> · {f.name(r.client)}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge color={STATUS_COLOR[r.priority]}>{t(`priority.${r.priority}`)}</StatusBadge>
        {r.dueDate && (
          <span className={cn("inline-flex items-center gap-1 text-xs", r.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
            {r.overdue ? <AlertTriangle className="size-3" /> : <CalendarClock className="size-3" />}
            {f.date(r.dueDate)}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3" /> {r.assignee?.name ?? t("requests.unassigned")}
        </span>
        {r.total > 0 && <span className="num font-medium text-foreground">{f.money(r.total, r.currency)}</span>}
      </div>
    </div>
  );
}

function Column({ status, label, count, children }: { status: RequestStatus; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn("flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors", isOver && "border-primary bg-accent/50")}
    >
      <header className="flex items-center justify-between border-b px-3 py-2">
        <StatusBadge color={STATUS_COLOR[status]}>{label}</StatusBadge>
        <span className="text-xs text-muted-foreground">{count}</span>
      </header>
      <div className="flex min-h-40 flex-col gap-2 p-2">{children}</div>
    </section>
  );
}
