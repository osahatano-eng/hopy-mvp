// /components/chat/lib/chatSendRetryPreparation.ts
"use client";

import type { Dispatch, SetStateAction } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMsg, Lang } from "./chatTypes";
import {
  classifyError,
  formatErrorText,
  genClientRequestId,
  isTemporaryGuestThreadId,
  normalizeForSend,
  safePersistActiveThreadId,
} from "./chatSendShared";
import { resolveAuthContextForSend } from "./chatSendAuth";

export type RetryPreparationFailedSend = {
  text: string;
  uiLang: Lang;
  conversationId: string;
  at: number;
  errorText: string;
  clientRequestId?: string;
};

export type PrepareRetrySendResult =
  | {
      ok: true;
      text: string;
      uiLangForFailed: Lang;
      conversationId: string | null;
      clientRequestId: string;
    }
  | {
      ok: false;
    };

export async function prepareRetrySend(args: {
  supabase: SupabaseClient;
  lastFailed: RetryPreparationFailedSend;
  loadMessages: (
    supabase: SupabaseClient,
    threadId: string
  ) => Promise<ChatMsg[]>;
  setUserStateErr: (s: string | null) => void;
  setLastFailed: Dispatch<SetStateAction<RetryPreparationFailedSend | null>>;
}): Promise<PrepareRetrySendResult> {
  const { supabase, lastFailed, loadMessages, setUserStateErr, setLastFailed } =
    args;

  const text = normalizeForSend(String(lastFailed.text ?? ""));
  if (!text) {
    return { ok: false };
  }

  const clientRequestId =
    String(lastFailed.clientRequestId ?? "").trim() || genClientRequestId();

  const auth = await resolveAuthContextForSend(supabase);

  let conversationId = auth.isLoggedIn
    ? String(lastFailed.conversationId ?? "").trim() || null
    : null;

  if (
    auth.isLoggedIn &&
    conversationId &&
    isTemporaryGuestThreadId(conversationId)
  ) {
    conversationId = null;
  }

  if (auth.isLoggedIn && conversationId) {
    safePersistActiveThreadId(conversationId);

    try {
      await loadMessages(supabase, conversationId);
    } catch (e: any) {
      const { kind, message } = classifyError({ err: e });
      const errText = formatErrorText(kind, message);

      setUserStateErr(errText);
      setLastFailed((prev) =>
        prev
          ? {
              ...prev,
              at: Date.now(),
              errorText: errText,
              clientRequestId,
            }
          : prev
      );

      return { ok: false };
    }
  }

  return {
    ok: true,
    text,
    uiLangForFailed: lastFailed.uiLang,
    conversationId,
    clientRequestId,
  };
}

/*
このファイルの正式役割
retry送信前準備専用の子ファイル。
認証確認、conversationId 補正、temporary guest thread 除外、事前 loadMessages、失敗時の lastFailed 更新だけを担う。
sendCore 実行、assistant message 組み立て、送信後スレッド反映、state / Compass の意味判定は持たない。
*/

/*
【今回このファイルで修正したこと】
1. auth_context_timeout を発生させていた AUTH_CONTEXT_TIMEOUT_MS を削除しました。
2. resolveAuthContextForRetryWithTimeout を削除し、retry 前準備の認証解決を resolveAuthContextForSend(...) 1本に戻しました。
3. これにより、このファイル内の人工的な timeout guard で retry 本線が止まる余計なコードを削除しました。
4. conversationId 補正、temporary guest thread 除外、事前 loadMessages、lastFailed 更新、confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階の唯一の正には触っていません。
*/

/* /components/chat/lib/chatSendRetryPreparation.ts */