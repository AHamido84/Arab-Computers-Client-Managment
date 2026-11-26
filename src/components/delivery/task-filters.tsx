"use client";

/**
 * Shared filters for every task view (table, Kanban, calendar, workload).
 * Stored in the URL so they survive switching views and can be bookmarked.
 */
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFmt } from "@/components/shared/format-provider";
import { TASK_STATUSES } from "@/lib/delivery";
import { dueBucket } from "./tasks-table";
import type { TaskRow } from "@/server/services/delivery";

export const FILTER_KEYS = ["q", "client", "project", "assignee", "status", "due"] as const;
type Key = (typeof FILTER_KEYS)[number];
const ALL = "__all";

export function useTaskFilters(rows: TaskRow[], today: Date) {
  const sp = useSearchParams();
  const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) ?? ""])) as Record<Key, string>;
  const filtered = useMemo(() => {
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (f.client && r.project.client.id !== f.client) return false;
      if (f.project && r.project.id !== f.project) return false;
      if (f.assignee && !r.assignees.some((a) => a.userId === f.assignee)) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.due && dueBucket(r, today) !== f.due) return false;
      if (words.length) {
        const hay = [r.title, r.project.number, r.project.title, r.project.client.nameAr, r.project.client.nameEn, ...r.assignees.map((a) => a.name)].join(" ").toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }, [rows, f.q, f.client, f.project, f.assignee, f.status, f.due, today]);
  return { filters: f, filtered };
}

export function TaskFilterBar({
  rows,
  people,
  showProject = true,
  hideStatus = false,
}: {
  rows: TaskRow[];
  people: { id: string; name: string }[];
  showProject?: boolean;
  hideStatus?: boolean;
}) {
  const t = useTranslations();
  const fmt = useFmt();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (k: Key, v: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v && v !== ALL) q.set(k, v);
    else q.delete(k);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const active = FILTER_KEYS.some((k) => sp.get(k));
  const projects = [...new Map(rows.map((r) => [r.project.id, r.project])).values()];
  const clients = [...new Map(rows.map((r) => [r.project.client.id, r.project.client])).values()];

  const sel = (k: Key, label: string, options: { value: string; label: string }[]) => (
    <Select value={sp.get(k) || ALL} onValueChange={(v) => set(k, v)}>
      <SelectTrigger size="sm" className="min-w-36" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: {t("common.all")}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center" role="search" aria-label={t("views.filters")}>
      <div className="relative w-full lg:max-w-64">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={sp.get("q") ?? ""}
          key={sp.get("q") ?? ""}
          onKeyDown={(e) => e.key === "Enter" && set("q", (e.target as HTMLInputElement).value)}
          onBlur={(e) => e.target.value !== (sp.get("q") ?? "") && set("q", e.target.value)}
          placeholder={t("table.search")}
          aria-label={t("table.search")}
          className="ps-8"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {sel("due", t("tasks.dueDate"), [
          { value: "overdue", label: t("tasks.overdue") },
          { value: "week", label: t("tasks.dueThisWeek") },
          { value: "later", label: t("tasks.later") },
        ])}
        {!hideStatus && sel("status", t("tasks.status"), TASK_STATUSES.map((s) => ({ value: s, label: t(`taskStatus.${s}`) })))}
        {sel("assignee", t("tasks.assignees"), people.map((p) => ({ value: p.id, label: p.name })))}
        {showProject && sel("client", t("tasks.client"), clients.map((c) => ({ value: c.id, label: fmt.name(c) })))}
        {showProject && sel("project", t("tasks.project"), projects.map((p) => ({ value: p.id, label: `${p.number} · ${p.title}` })))}
        {active && (
          <Button variant="ghost" size="sm" onClick={() => router.replace(`${pathname}?${(() => { const q = new URLSearchParams(sp.toString()); FILTER_KEYS.forEach((k) => q.delete(k)); return q.toString(); })()}`, { scroll: false })}>
            <X /> {t("views.clear")}
          </Button>
        )}
      </div>
    </div>
  );
}
