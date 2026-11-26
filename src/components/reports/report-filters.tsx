"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFmt } from "@/components/shared/format-provider";
import type { ReportFilters, ReportType } from "@/server/services/reports";

const STATUS: Record<ReportType, { ns: string; values: string[] } | null> = {
  amc: { ns: "amcStatus", values: ["PENDING", "OVERDUE", "PAID"] },
  requests: { ns: "requestStatus", values: ["NEW", "UNDER_STUDY", "QUOTED", "APPROVED", "IN_PROGRESS", "DELIVERED", "CLOSED", "REJECTED"] },
  quotations: { ns: "quotationStatus", values: ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] },
  delivery: null,
  statement: null,
};
const ALL = "__all";

export function ReportFiltersBar({
  type,
  value,
  clients,
  users,
}: {
  type: ReportType;
  value: ReportFilters;
  clients: { id: string; nameAr: string; nameEn: string }[];
  users: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const f = useFmt();
  const router = useRouter();
  const [v, setV] = useState<ReportFilters>(value);
  const set = (k: keyof ReportFilters, val: string) => setV((cur) => ({ ...cur, [k]: val === ALL ? undefined : val }));
  const apply = (next = v) => {
    const q = new URLSearchParams({ type });
    Object.entries(next).forEach(([k, val]) => val && q.set(k, val));
    router.push(`/reports?${q}`);
  };
  const status = STATUS[type];
  const isStatement = type === "statement";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
      {!isStatement && (
        <>
          <div className="grid gap-1">
            <Label htmlFor="rf-from" className="text-xs">{t("reports.from")}</Label>
            <Input id="rf-from" type="date" value={v.from ?? ""} onChange={(e) => set("from", e.target.value)} className="w-40" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="rf-to" className="text-xs">{t("reports.to")}</Label>
            <Input id="rf-to" type="date" value={v.to ?? ""} onChange={(e) => set("to", e.target.value)} className="w-40" />
          </div>
        </>
      )}
      <div className="grid gap-1">
        <Label className="text-xs">{t("reports.client")}</Label>
        <Select value={v.clientId ?? ALL} onValueChange={(val) => (isStatement ? apply({ clientId: val === ALL ? undefined : val }) : set("clientId", val))}>
          <SelectTrigger className="w-56" aria-label={t("reports.client")}>
            <SelectValue placeholder={t("reports.chooseClient")} />
          </SelectTrigger>
          <SelectContent>
            {!isStatement && <SelectItem value={ALL}>{t("reports.allClients")}</SelectItem>}
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {f.name(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {status && (
        <div className="grid gap-1">
          <Label className="text-xs">{t("reports.status")}</Label>
          <Select value={v.status ?? ALL} onValueChange={(val) => set("status", val)}>
            <SelectTrigger className="w-44" aria-label={t("reports.status")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("reports.allStatuses")}</SelectItem>
              {status.values.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`${status.ns}.${s}` as never)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {(type === "amc" || type === "requests" || type === "delivery") && (
        <div className="grid gap-1">
          <Label className="text-xs">{type === "amc" ? t("reports.manager") : t("reports.assignee")}</Label>
          <Select value={v.userId ?? ALL} onValueChange={(val) => set("userId", val)}>
            <SelectTrigger className="w-44" aria-label={type === "amc" ? t("reports.manager") : t("reports.assignee")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("common.all")}</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {!isStatement && (
        <div className="flex gap-2">
          <Button onClick={() => apply()}>
            <Filter /> {t("reports.apply")}
          </Button>
          <Button variant="ghost" onClick={() => router.push(`/reports?type=${type}`)}>
            <RotateCcw /> {t("reports.reset")}
          </Button>
        </div>
      )}
    </div>
  );
}
