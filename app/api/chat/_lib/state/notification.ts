// /app/api/chat/_lib/state/notification.ts

import { clampInt, envInt } from "../env";

/**
 * ---- build signature ----
 * レスポンス等で「反映されているか」を見たい時の印
 */
export const NOTIF_SIG = "notif_sig_2026-02-19_a1";

/**
 * ---- knobs (stability-first) ----
 * バッジが暴走してノイズ化しないための上限
 */
const BADGE_MAX = envInt("NOTIFICATION_BADGE_MAX", 99);

export type NotificationState = {
  /**
   * 未処理アクション数（message数ではない）
   */
  unread_count: number;

  /**
   * いつ更新されたか（ISO）
   */
  updated_at: string;

  /**
   * 最後の増加理由（観測用）
   */
  last_reason?: string;
};

export function createInitialNotificationState(): NotificationState {
  return {
    unread_count: 0,
    updated_at: new Date().toISOString(),
  };
}

export function incrementNotification(params: {
  state: NotificationState;
  amount?: number;
  reason?: string;
}): NotificationState {
  const amount = params.amount ?? 1;
  const next = clampInt(params.state.unread_count + amount, 0, BADGE_MAX);

  return {
    unread_count: next,
    updated_at: new Date().toISOString(),
    last_reason: params.reason,
  };
}

export function clearNotifications(params: {
  state: NotificationState;
  reason?: string;
}): NotificationState {
  return {
    unread_count: 0,
    updated_at: new Date().toISOString(),
    last_reason: params.reason,
  };
}
