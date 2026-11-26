import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { can, requireUser } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { getSettings } from "@/server/services/settings";
import { FormatProvider } from "@/components/shared/format-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const t = await getTranslations();
  const [store, settings, unread] = await Promise.all([
    cookies(),
    getSettings(),
    db.notification.count({ where: { userId: user.id, readAt: null, dismissedAt: null } }),
  ]);
  const defaultOpen = store.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <a href="#main-content" className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
        {t("common.skipToContent")}
      </a>
      <AppSidebar role={user.role} unread={unread} />
      <SidebarInset className="min-w-0">
        <header className="no-print sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
          <SidebarTrigger className="-ms-1" />
          <div className="flex-1" />
          <LanguageToggle />
          <ThemeToggle />
          <NotificationBell userId={user.id} unread={unread} canEmail={can(user.role, "sendEmail")} />
          <UserMenu name={user.name ?? ""} email={user.email ?? ""} role={user.role} />
        </header>
        <div id="main-content" tabIndex={-1} className="flex-1 p-4 outline-none md:p-6">
          <FormatProvider digits={settings.arabicDigits} currency={settings.defaultCurrency}>
            {children}
          </FormatProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
