// /components/chat/lib/chatSendConfirmedAssistantMessage.ts
"use client";

import type { ChatMsg, Lang } from "./chatTypes";
import { logWarn, pickLang } from "./chatSendShared";
import { mergeAssistantStateFields } from "./chatSendState";
import { mergeAssistantCompassFields } from "./chatSendCompass";

export type ConfirmedStatePayload = {
  state_level?: number;
  current_phase?: number;
  prev_state_level?: number;
  prev_phase?: number;
  state_changed?: boolean;
};

export type ConfirmedThreadSummaryPayload = {
  thread_id?: string;
  latest_reply_id?: string;
  latest_reply_at?: string;
  latest_confirmed_state?: ConfirmedStatePayload | null;
  title?: string;
  next_title?: string;
  title_updated?: boolean;
};

export type ConfirmedCompassPayload = {
  text?: string | null;
  prompt?: string | null;
};

export type ConfirmedMeaningPayload = {
  reply?: string;
  state?: ConfirmedStatePayload | null;
  thread_summary?: ConfirmedThreadSummaryPayload | null;
  memory_candidates?: unknown;
  dashboard_signals?: unknown;
  notification_signal?: unknown;
  ui_effects?: unknown;
  compass?: ConfirmedCompassPayload | null;
};

export type ConfirmedAssistantApiResponse<TState> = {
  ok: boolean;
  reply?: string;
  text?: string;
  lang?: Lang;
  uiLang?: Lang;
  state?: TState | null;
  state_ok?: boolean;
  state_available?: boolean;
  state_updated?: boolean;
  state_error?: any | null;
  state_skipped?: boolean;
  state_skip_reason?: string | null;
  user_saved?: boolean;
  assistant_saved?: boolean;
  error?: string;
  message?: string;
  assistant_state?: any;
  assistantState?: any;
  hopy_confirmed_payload?: ConfirmedMeaningPayload | null;
  compass?:
    | {
        text?: string | null;
        prompt?: string | null;
      }
    | null;
  compassText?: string | null;
  compassPrompt?: string | null;
  compass_text?: string | null;
  compass_prompt?: string | null;
};

function mergeConfirmedMeaningFields(
  message: ChatMsg,
  confirmedPayload: ConfirmedMeaningPayload | null
): ChatMsg {
  const next = { ...(message as any) };

  if (confirmedPayload) {
    next.hopy_confirmed_payload = confirmedPayload;
  } else {
    delete next.hopy_confirmed_payload;
  }

  return next as ChatMsg;
}

function applyMessageMerge(
  message: ChatMsg,
  mergeLabel: string,
  mergeFn: () => ChatMsg,
  extraLog?: Record<string, unknown>
): ChatMsg {
  try {
    return mergeFn();
  } catch (e) {
    logWarn(
      `[chatSendConfirmedAssistantMessage] ${mergeLabel} failed`,
      {
        reason: String((e as any)?.message ?? e ?? ""),
        ...(extraLog ?? {}),
      }
    );
    return message;
  }
}

export function attachThreadIdToMessage(
  message: ChatMsg,
  threadId: string | null
): ChatMsg {
  const tid = String(threadId ?? "").trim();
  if (!tid) return message;

  return {
    ...(message as any),
    thread_id: tid,
  } as ChatMsg;
}

export function buildConfirmedAssistantMessage<TState>(args: {
  message: ChatMsg;
  payload: ConfirmedAssistantApiResponse<TState>;
  reply: string;
  requestLang: Lang;
  normalizedAssistantState: ConfirmedStatePayload | TState | null;
  confirmedPayload: ConfirmedMeaningPayload | null;
  compassText: string | null;
  compassPrompt: string | null;
  resolvedThreadId: string | null;
}): ChatMsg {
  const {
    message,
    payload,
    reply,
    requestLang,
    normalizedAssistantState,
    confirmedPayload,
    compassText,
    compassPrompt,
    resolvedThreadId,
  } = args;

  let next: ChatMsg = attachThreadIdToMessage(message, resolvedThreadId);

  next = {
    ...next,
    content: reply,
    lang: pickLang(payload, requestLang),
  };

  next = applyMessageMerge(
    next,
    "mergeAssistantStateFields",
    () =>
      mergeAssistantStateFields(
        next,
        normalizedAssistantState
          ? { ...payload, assistant_state: normalizedAssistantState }
          : payload
      )
  );

  next = applyMessageMerge(
    next,
    "mergeConfirmedMeaningFields",
    () => mergeConfirmedMeaningFields(next, confirmedPayload)
  );

  next = applyMessageMerge(
    next,
    "mergeAssistantCompassFields",
    () => mergeAssistantCompassFields(next, compassText, compassPrompt),
    {
      hasCompassText: Boolean(compassText),
      hasCompassPrompt: Boolean(compassPrompt),
      hasConfirmedPayloadCompass: Boolean(confirmedPayload?.compass),
    }
  );

  return next;
}

/*
このファイルの正式役割
assistant回答確定後の message 組み立て専用子ファイル。
thread_id 付与、reply/lang 反映、confirmed payload 反映、assistant state 反映、Compass 反映だけを担う。
送信開始、API送信、retry、title反映、UI中継は持たない。
*/

/*
【今回このファイルで修正したこと】
1. buildConfirmedAssistantMessage 内で重複していた「merge実行 + 失敗時logWarn」の処理を applyMessageMerge に統一しました。
2. このファイル内で明確に未使用と断定できるコードはなかったため、不要削除は行っていません。
3. confirmed payload / assistant state / Compass の反映順と役割は変えていません。
4. HOPY唯一の正である confirmed payload の意味判定自体は増やしていません。
*/

/* /components/chat/lib/chatSendConfirmedAssistantMessage.ts */