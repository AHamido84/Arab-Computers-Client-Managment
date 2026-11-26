import { BellMenu } from "@/components/notifications/bell-menu";
import { listNotifications } from "@/server/services/notifications";

/** Header bell: unread count + latest unread alerts in a popover. */
export async function NotificationBell({ userId, unread, canEmail }: { userId: string; unread: number; canEmail: boolean }) {
  const items = unread ? (await listNotifications(userId, "unread", 8)) : [];
  return <BellMenu unread={unread} items={items} canEmail={canEmail} />;
}
