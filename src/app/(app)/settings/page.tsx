import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Bell, Building, FileCode2, ListChecks, ScrollText, Users } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/server/auth-guard";

export async function generateMetadata() {
  return { title: (await getTranslations("settings"))("title") };
}

export default async function SettingsPage() {
  await requirePagePermission("manageSettings");
  const t = await getTranslations("settings");
  const items = [
    { href: "/settings/lists", icon: ListChecks, title: t("lists"), desc: t("listsDesc"), ready: true },
    { href: "/settings/company", icon: Building, title: t("company"), desc: t("companyDesc"), ready: false },
    { href: "/settings/users", icon: Users, title: t("users"), desc: t("usersDesc"), ready: false },
    { href: "/settings/templates", icon: FileCode2, title: t("templates"), desc: t("templatesDesc"), ready: false },
    { href: "/settings/notifications", icon: Bell, title: t("notificationsTitle"), desc: t("notificationsDesc"), ready: false },
    { href: "/settings/audit", icon: ScrollText, title: t("audit"), desc: t("auditDesc"), ready: false },
  ];
  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          const card = (
            <Card className={it.ready ? "transition-colors hover:border-primary/50 hover:bg-accent/30" : "opacity-60"}>
              <CardHeader>
                <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <CardTitle>{it.title}</CardTitle>
                <CardDescription>{it.ready ? it.desc : `${it.desc} — ${t("later")}`}</CardDescription>
              </CardHeader>
            </Card>
          );
          return it.ready ? (
            <Link key={it.href} href={it.href}>
              {card}
            </Link>
          ) : (
            <div key={it.href} aria-disabled>
              {card}
            </div>
          );
        })}
      </div>
    </>
  );
}
