"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AppWindow,
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  FileSignature,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Mail,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

type NavItem = { href: string; key: string; icon: React.ComponentType; badge?: number };

export function AppSidebar({ role, unread }: { role: "ADMIN" | "ACCOUNT_MANAGER" | "VIEWER" | "TEAM_MEMBER"; unread: number }) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const locale = useLocale();

  const isAdmin = role === "ADMIN";
  const isTeam = role === "TEAM_MEMBER";
  const delivery: { label: string; items: NavItem[] } = {
    label: t("sectionDelivery"),
    items: isTeam
      ? [{ href: "/my-tasks", key: "myTasks", icon: ListTodo }]
      : [
          { href: "/delivery", key: "delivery", icon: FolderKanban },
          { href: "/tasks", key: "tasks", icon: ListChecks },
          ...(role === "VIEWER" ? [] : [{ href: "/my-tasks", key: "myTasks", icon: ListTodo }]),
        ],
  };
  const groups: { label: string; items: NavItem[] }[] = isTeam
    ? [delivery, { label: t("sectionMain"), items: [{ href: "/notifications", key: "notifications", icon: Bell, badge: unread }] }]
    : [
    {
      label: t("sectionMain"),
      items: [
        { href: "/", key: "dashboard", icon: LayoutDashboard },
        { href: "/notifications", key: "notifications", icon: Bell, badge: unread },
        { href: "/reports", key: "reports", icon: BarChart3 },
      ],
    },
    {
      label: t("sectionWork"),
      items: [
        { href: "/clients", key: "clients", icon: Building2 },
        { href: "/contracts", key: "contracts", icon: FileSignature },
        { href: "/requests", key: "requests", icon: ClipboardList },
        { href: "/quotations", key: "quotations", icon: FileText },
        { href: "/software", key: "software", icon: AppWindow },
        { href: "/emails", key: "emails", icon: Mail },
      ],
    },
    delivery,
  ];
  if (isAdmin) {
    groups.push({ label: t("sectionAdmin"), items: [{ href: "/settings", key: "settings", icon: Settings }] });
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <Sidebar side={locale === "ar" ? "right" : "left"} collapsible="icon" dir={locale === "ar" ? "rtl" : "ltr"}>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 rounded-md px-1 py-1.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white">
            <Image src="/brand/favicon.png" alt="" width={28} height={28} />
          </span>
          <span className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold text-white">{tApp("name")}</span>
            <span className="truncate text-xs text-sidebar-foreground/85">{tApp("product")}</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="text-sidebar-foreground/85">{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={t(item.key)}>
                        <Link href={item.href}>
                          <Icon />
                          <span>{t(item.key)}</span>
                        </Link>
                      </SidebarMenuButton>
                      {!!item.badge && (
                        <SidebarMenuBadge className="bg-sidebar-primary text-sidebar-primary-foreground">
                          {item.badge > 99 ? "99+" : item.badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="text-xs text-sidebar-foreground/80 group-data-[collapsible=icon]:hidden">
        arab-computers.com
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
