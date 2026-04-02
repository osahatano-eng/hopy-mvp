// /components/chat/lib/chatClientUi.ts
"use client";

import type { Lang } from "./chatTypes";
import type { HopyState } from "./stateBadge";

export function readInitialUiLang(): Lang {
  if (typeof window === "undefined") return "ja";
  try {
    const saved = String(window.localStorage.getItem("hopy_lang") || "").toLowerCase();
    return saved === "en" ? "en" : "ja";
  } catch {
    return "ja";
  }
}

export function buildThinkingLabel(uiLang: Lang, userState: HopyState | null): string {
  const phase = Number((userState as any)?.current_phase ?? 0);

  if (uiLang === "en") {
    if (phase <= 0) return "Grounding thoughts...";
    if (phase === 1) return "Thinking...";
    return "Building the next step...";
  }

  if (phase <= 0) return "心を整えています...";
  if (phase === 1) return "思考を整理しています...";
  return "次の一歩を組み立てています...";
}

export function buildUi(uiLang: Lang, thinkingLabel: string) {
  const isEn = uiLang === "en";
  return {
    title: "HOPY AI",
    login: isEn ? "Continue with Google" : "Googleで続行",
    placeholder: isEn ? "Ask HOPY..." : "HOPYに相談する...",
    sending: thinkingLabel,
    enterHint: isEn ? "Enter to send / Shift+Enter for a new line" : "Enterで送信 / Shift+Enterで改行",
    jumpAria: isEn ? "Jump to latest" : "最新へ移動",
    dayStart: isEn ? "New day" : "新しい日",
    more: isEn ? "Show more" : "さらに表示",
    loginAlert: isEn ? "Please login." : "ログインしてください",
    emptyReply: isEn ? "Empty reply from API." : "APIの返答が空です。",
    memories: isEn ? "Memories" : "記憶",
    retry: isEn ? "Retry" : "再送",
    failed: isEn ? "Send failed." : "送信に失敗しました。",
    privacy: isEn ? "Your chats are stored only under your account." : "あなたの会話は、あなたのアカウントにのみ保存されます。",
    stateTitle: isEn ? "思考状態" : "思考状態",
    stateUnknownShort: isEn ? "準備中" : "起点",
    statePhase0: isEn ? "混線" : "混線",
    statePhase1: isEn ? "模索" : "模索",
    statePhase2: isEn ? "整理" : "整理",
  };
}