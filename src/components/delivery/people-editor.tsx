"use client";

import { useTranslations } from "next-intl";
import { Crown, Eye, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type Person = { id: string; name: string; role?: string };
export type AssigneeValue = { userId: string; role: "LEAD" | "MEMBER" };

/**
 * Assignees (each Lead or Member — at most one Lead) and watchers.
 * Clicking an assignee's badge toggles Lead/Member.
 */
export function PeopleEditor({
  people,
  assignees,
  watchers,
  onChange,
  disabled,
  compact,
}: {
  people: Person[];
  assignees: AssigneeValue[];
  watchers: string[];
  onChange: (next: { assignees: AssigneeValue[]; watchers: string[] }) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations();
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "—";
  const free = people.filter((p) => !assignees.some((a) => a.userId === p.id) && !watchers.includes(p.id));

  const addAssignee = (id: string) =>
    onChange({ assignees: [...assignees, { userId: id, role: assignees.some((a) => a.role === "LEAD") ? "MEMBER" : "LEAD" }], watchers });
  const toggleLead = (id: string) =>
    onChange({
      assignees: assignees.map((a) => (a.userId === id ? { ...a, role: a.role === "LEAD" ? "MEMBER" : "LEAD" } : a.role === "LEAD" ? { ...a, role: "MEMBER" } : a)),
      watchers,
    });

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", compact && "gap-1")}>
      {assignees.map((a) => (
        <span key={a.userId} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", a.role === "LEAD" && "border-primary bg-primary/10")}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => toggleLead(a.userId)}
            className="inline-flex items-center gap-1"
            title={t(`assigneeRole.${a.role}`)}
            aria-label={`${name(a.userId)} — ${t(`assigneeRole.${a.role}`)}`}
          >
            {a.role === "LEAD" && <Crown className="size-3 text-primary" />}
            {name(a.userId)}
          </button>
          {!disabled && (
            <button type="button" onClick={() => onChange({ assignees: assignees.filter((x) => x.userId !== a.userId), watchers })} aria-label={`${t("common.delete")} ${name(a.userId)}`}>
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {watchers.map((w) => (
        <span key={w} className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
          <Eye className="size-3" /> {name(w)}
          {!disabled && (
            <button type="button" onClick={() => onChange({ assignees, watchers: watchers.filter((x) => x !== w) })} aria-label={`${t("common.delete")} ${name(w)}`}>
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && free.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="xs">
              <Plus /> {t("tasks.addAssignee")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>{t("tasks.assignees")}</DropdownMenuLabel>
            {free.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => addAssignee(p.id)}>
                {p.name} {p.role ? <span className="text-xs text-muted-foreground">· {t(`roles.${p.role}` as never)}</span> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuLabel>{t("tasks.watchers")}</DropdownMenuLabel>
            {free.map((p) => (
              <DropdownMenuItem key={`w-${p.id}`} onClick={() => onChange({ assignees, watchers: [...watchers, p.id] })}>
                <Eye /> {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {assignees.length === 0 && watchers.length === 0 && disabled && <span className="text-xs text-muted-foreground">{t("tasks.unassigned")}</span>}
    </div>
  );
}
