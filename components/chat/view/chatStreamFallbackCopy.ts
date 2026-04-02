// /components/chat/view/chatStreamFallbackCopy.ts
"use client";

import type { Lang } from "../lib/chatTypes";

export type ChatStreamFallbackCopy = {
  title: string;
  lead: string;
  mini: string;
  reason: string;
};

export function getChatStreamFallbackCopy(args: {
  uiLang: Lang;
  shouldShowPreparing: boolean;
  shouldShowRecover: boolean;
  shouldShowStuck: boolean;
  userStateErr: string | null;
}): ChatStreamFallbackCopy {
  const {
    uiLang,
    shouldShowPreparing,
    shouldShowRecover,
    shouldShowStuck,
    userStateErr,
  } = args;

  const isEn = uiLang === "en";
  const title = isEn ? "Open a chat." : "チャットを開く。";

  if (shouldShowRecover) {
    const reason = String(userStateErr ?? "").trim();

    return {
      title,
      lead: isEn
        ? "Choose a chat from the top-left ≡ menu. Your workspace is still here."
        : "左上の ≡ メニューからチャットを選んでください。ワークスペースはそのまま残っています。",
      mini: isEn
        ? "Your chat list is already in the ≡ menu."
        : "チャット一覧はすでに ≡ メニューに表示されています。",
      reason: reason ? (isEn ? `Reason: ${reason}` : `理由: ${reason}`) : "",
    };
  }

  if (shouldShowStuck) {
    return {
      title,
      lead: isEn
        ? "Choose a chat from the top-left ≡ menu, or start a new one."
        : "左上の ≡ メニューからチャットを選ぶか、新しいチャットを始めてください。",
      mini: isEn
        ? "You do not need to wait on this screen."
        : "この画面で待ち続ける必要はありません。",
      reason: "",
    };
  }

  if (shouldShowPreparing) {
    return {
      title,
      lead: isEn
        ? "Choose a chat from the top-left ≡ menu, or start a new one."
        : "左上の ≡ メニューからチャットを選ぶか、新しいチャットを始めてください。",
      mini: isEn
        ? "You can continue as soon as you choose one."
        : "選べばそのまま続けられます。",
      reason: "",
    };
  }

  return {
    title,
    lead: isEn
      ? "Choose a chat from the top-left ≡ menu, or start a new one."
      : "左上の ≡ メニューからチャットを選ぶか、新しいチャットを始めてください。",
    mini: isEn ? "Your chat list is in the ≡ menu." : "チャット一覧は ≡ メニューにあります。",
    reason: "",
  };
}