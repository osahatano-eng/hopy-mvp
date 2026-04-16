// /components/chat/lib/chatSendDuplicateGuard.ts
"use client";

import type { MutableRefObject } from "react";

export type ChatSendDuplicateSignature = {
  sig: string;
  at: number;
};

export type ShouldBlockDuplicateSendArgs = {
  text: string;
  conversationId: string | null;
  lastSigRef: MutableRefObject<ChatSendDuplicateSignature | null>;
  windowMs?: number;
};

function resolveDuplicateConversationKey(conversationId: string | null): string {
  return String(conversationId ?? "").trim() || "no_thread";
}

function buildDuplicateSignature(text: string, conversationId: string | null): string {
  const cid = resolveDuplicateConversationKey(conversationId);
  return `${cid}::${text}`;
}

export function shouldBlockDuplicateSend(
  args: ShouldBlockDuplicateSendArgs
): boolean {
  const { text, conversationId, lastSigRef, windowMs = 600 } = args;

  const sig = buildDuplicateSignature(text, conversationId);
  const now = Date.now();
  const prev = lastSigRef.current;

  lastSigRef.current = {
    sig,
    at: now,
  };

  if (!prev) return false;
  return prev.sig === sig && now - prev.at < windowMs;
}

/*
このファイルの正式役割
送信時の重複送信判定だけを担う子ファイル。
conversationId と text から署名を作り、直前署名との比較結果だけを返す。
親はこの子を呼び出すだけにする。
*/

/*
【今回このファイルで修正したこと】
1. useChatSend.ts に残っていた重複送信判定本体の受け皿となる子ファイルを新規作成しました。
2. conversationId 正規化、署名生成、直前署名との時間差比較をこの子へ分離しました。
3. HOPY唯一の正である confirmed payload / state_changed / Compass / 1..5 の意味判定には触っていません。
*/

/* /components/chat/lib/chatSendDuplicateGuard.ts */