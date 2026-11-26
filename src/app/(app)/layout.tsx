import { cookies } from "next/headers";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { requireUser } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { getSettings } from "@/server/services/settings";
import { FormatProvider } from "@/components/shared/format-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [store, settings, unread] = await Promise.all([
    cookies(),
    getSettings(),
    db.notification.count({ where: { userId: user.id, readAt: null, dismissedAt: null } }),
  ]);
  const defaultOpen = store.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar isAdmin={user.role === "ADMIN"} unread={unread} />
      <SidebarInset className="min-w-0">
        <header className="no-print sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
          <SidebarTrigger className="-ms-1" />
          <div className="flex-1" />
          <LanguageToggle />
          <ThemeToggle />
          <NotificationBell unread={unread} />
          <UserMenu name={user.name ?? ""} email={user.email ?? ""} role={user.role} />
        </header>
        <div className="flex-1 p-4 md:p-6">
          <FormatProvider digits={settings.arabicDigits} currency={settings.defaultCurrency}>
            {children}
          </FormatProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
