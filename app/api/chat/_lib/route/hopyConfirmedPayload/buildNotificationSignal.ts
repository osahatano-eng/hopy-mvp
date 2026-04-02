// /app/api/chat/_lib/route/hopyConfirmedPayload/buildNotificationSignal.ts

import type { NotificationState } from "../../state/notification";

export type HopyNotificationSignal = {
  increment: boolean;
  reason: string | null;
  unread_count_update_target: boolean;
  unread_count: number;
};

type BuildNotificationSignalParams = {
  notification: NotificationState;
};

function normalizeUnreadCount(value: unknown): number {
  const safe =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : 0;

  return safe > 0 ? safe : 0;
}

function normalizeReason(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export function buildNotificationSignal(
  params: BuildNotificationSignalParams,
): HopyNotificationSignal {
  const { notification } = params;

  const unreadCount = normalizeUnreadCount(notification.unread_count);
  const reason = normalizeReason(notification.last_reason);
  const increment = unreadCount > 0;

  return {
    increment,
    reason,
    unread_count_update_target: increment,
    unread_count: unreadCount,
  };
}