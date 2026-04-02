// /components/chat/lib/guestChatStore.ts
"use client";

import type { ChatMsg, Lang } from "./chatTypes";

export const GUEST_CHAT_STORAGE_KEY = "hopy_guest_chat";
export const FREE_CHAT_LIMIT = 8;

export type GuestChatStore = {
  messages: ChatMsg[];
  guestMessageCount: number;
  updatedAt: string;
};

export function canUseLocalStorage() {
  return false;
}

export function safeIsoNow(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
}

export function sanitizeGuestMessages(_raw: unknown, _uiLang: Lang): ChatMsg[] {
  return [];
}

export function readGuestChatStore(_uiLang: Lang): GuestChatStore {
  return {
    messages: [],
    guestMessageCount: 0,
    updatedAt: "",
  };
}

export function writeGuestChatStore(_store: GuestChatStore, _uiLang: Lang) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(GUEST_CHAT_STORAGE_KEY);
  } catch {}
}

export function clearGuestChatStore() {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(GUEST_CHAT_STORAGE_KEY);
  } catch {}
}

export function buildGuestLimitNotice(uiLang: Lang, reachedLimit: boolean): string {
  if (uiLang === "en") {
    if (reachedLimit) {
      return "You have reached the guest chat limit. Please log in to continue.";
    }
    return "Guest chats are not saved. Please log in if you want to keep your conversation history.";
  }

  if (reachedLimit) {
    return "未ログインでの会話上限に達しました。続けるにはログインしてください。";
  }
  return "未ログインでの会話は保存されません。履歴を残したい場合はログインしてください。";
}