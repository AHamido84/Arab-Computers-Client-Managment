"use client";

/**
 * 12-month AMC revenue: one measure (money) on one axis, stacked by state
 * (collected vs still expected). Colors = validated --chart-1/--chart-2.
 * Hover tooltip per bar; legend always shown; a visually-hidden table
 * mirrors the data for screen readers.
 */
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFmt } from "@/components/shared/format-provider";

type Row = { month: string; collected: number; expected: number };

export function AmcChart({ data, currency }: { data: Row[]; currency: string }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  const rtl = f.locale === "ar";
  const monthLabel = (iso: string) =>
    new Intl.DateTimeFormat(f.locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(iso));
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  const compact = (v: number) => new Intl.NumberFormat(f.locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(v);

  return (
    <div>
      <div className="h-72" dir="ltr" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart accessibilityLayer={false} data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis dataKey="label" reversed={rtl} tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <YAxis
              orientation={rtl ? "right" : "left"}
              tickFormatter={compact}
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", direction: rtl ? "rtl" : "ltr" }}
              labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
              itemStyle={{ color: "var(--foreground)" }}
              formatter={(v, name) => [f.money(Number(v), currency), name === "collected" ? t("paid") : t("expected")]}
            />
            <Legend
              verticalAlign="top"
              align={rtl ? "right" : "left"}
              iconType="circle"
              height={28}
              formatter={(v) => <span style={{ color: "var(--foreground)" }}>{v === "collected" ? t("paid") : t("expected")}</span>}
            />
            {/* 2px surface gap between stacked segments; rounded data end on the top segment */}
            <Bar dataKey="collected" stackId="a" fill="var(--chart-1)" stroke="var(--card)" strokeWidth={2} />
            <Bar dataKey="expected" stackId="a" fill="var(--chart-2)" stroke="var(--card)" strokeWidth={2} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t("amcByMonth")}</caption>
        <thead>
          <tr>
            <td />
            <th scope="col">{t("paid")}</th>
            <th scope="col">{t("expected")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}>
              <th scope="row">{r.label}</th>
              <td>{f.money(r.collected, currency)}</td>
              <td>{f.money(r.expected, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
