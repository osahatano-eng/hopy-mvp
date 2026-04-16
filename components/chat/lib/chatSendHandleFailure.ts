// /components/chat/lib/chatSendHandleFailure.ts
"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Lang } from "./chatTypes";
import { classifyError, formatErrorText } from "./chatSendShared";
import type { FailedSend } from "./useChatSend";

export type HandleChatSendFailureArgs = {
  err: unknown;
  text: string;
  conversationId: string;
  uiLangForFailed: Lang;
  clientRequestId?: string;
  setLastFailed: Dispatch<SetStateAction<FailedSend | null>>;
  setUserStateErr: (value: string | null) => void;
};

export type HandleChatSendFailureResult = {
  errorText: string;
  failedConversationId: string;
};

function resolveChatSendErrorText(err: unknown): string {
  const rawMessage = String((err as { message?: unknown } | null)?.message ?? "");
  let errText = rawMessage.trim();

  if (!/^\[[A-Za-z/]+/.test(errText)) {
    const { kind, message } = classifyError({ err });
    errText = formatErrorText(kind, message);
  }

  return errText;
}

function resolveFailedConversationId(err: unknown, conversationId: string): string {
  return String(
    (err as { __conversationId?: unknown } | null)?.__conversationId ??
      conversationId ??
      ""
  ).trim();
}

export function handleChatSendFailure(
  args: HandleChatSendFailureArgs
): HandleChatSendFailureResult {
  const {
    err,
    text,
    conversationId,
    uiLangForFailed,
    clientRequestId,
    setLastFailed,
    setUserStateErr,
  } = args;

  const errorText = resolveChatSendErrorText(err);
  const failedConversationId = resolveFailedConversationId(err, conversationId);

  setLastFailed({
    text,
    uiLang: uiLangForFailed,
    conversationId: failedConversationId,
    at: Date.now(),
    errorText,
    clientRequestId: String(clientRequestId ?? "").trim() || undefined,
  });

  setUserStateErr(errorText);

  return {
    errorText,
    failedConversationId,
  };
}

/*
このファイルの正式役割
送信失敗時の errorText 解決、failedConversationId 解決、
FailedSend payload 組み立て、setLastFailed、setUserStateErr 実行だけを担う子ファイル。
親はこの子を呼び出すだけにする。
*/

/*
【今回このファイルで修正したこと】
1. useChatSend.ts の catch に残っていた送信失敗ハンドリング本体を受ける子ファイルを新規作成しました。
2. classifyError / formatErrorText による errorText 解決をこの子へ分離しました。
3. failedConversationId 解決、FailedSend payload 組み立て、setLastFailed、setUserStateErr をこの子へ分離しました。
4. HOPY唯一の正である confirmed payload / state_changed / Compass / 1..5 の意味判定には触れていません。
*/

/* /components/chat/lib/chatSendHandleFailure.ts */