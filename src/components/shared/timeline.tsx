import { getLocale, getTranslations } from "next-intl/server";
import { History } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

type Item = { id: string; type: string; summary: string; createdAt: Date; actor: { name: string } | null; meta?: unknown };

/** Vertical activity timeline (client profile). */
export async function Timeline({ items, empty }: { items: Item[]; empty: string }) {
  const [t, locale] = await Promise.all([getTranslations("activity"), getLocale() as Promise<AppLocale>]);
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="relative space-y-5 border-s ps-6">
      {items.map((a) => {
        const key = a.type.replace(".", "_");
        const meta = (a.meta ?? {}) as { labelAr?: string };
        const summary = locale === "ar" && meta.labelAr ? meta.labelAr : a.summary;
        return (
          <li key={a.id} className="relative">
            <span className="absolute -start-[31px] top-0.5 flex size-4 items-center justify-center rounded-full bg-primary ring-4 ring-background">
              <History className="size-2.5 text-primary-foreground" />
            </span>
            <p className="text-sm font-medium">
              {t.has(key) ? t(key) : a.type}
              {summary && <span className="font-normal text-muted-foreground"> — <bdi>{summary}</bdi></span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(a.createdAt, locale)}
              {a.actor ? ` · ${t("by", { name: a.actor.name })}` : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
