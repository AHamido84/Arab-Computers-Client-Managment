import "server-only";
import type { NotificationKind } from "@/generated/prisma/enums";

/**
 * Task event notifications (assigned, delivered, due date changed, mention).
 * Phase D1 stub — in-app + email delivery is implemented in phase D3.
 */
export async function notifyTaskEvent(
  _kind: Extract<NotificationKind, "TASK_ASSIGNED" | "TASK_DELIVERED" | "TASK_DUE_CHANGED" | "TASK_MENTION">,
  _taskId: string,
  _opts: { actorId?: string; userIds?: string[] } = {},
) {
  void _kind;
  void _taskId;
  void _opts;
}
