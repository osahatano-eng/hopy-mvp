// /components/chat/ui/leftRailLabels.ts
import type { Lang } from "../lib/chatTypes";

export type LeftRailLabels = {
  brand: string;
  growth: string;
  memories: string;
  threads: string;
  newChat: string;
  newChatSection: string;
  chatSection: string;
  rename: string;
  delete: string;
  deleteConfirm: string;
  noThreads: string;
  expand: string;
  closeAria: string;
  railAria: string;
  recover: string;
  recoverTitle: string;
  invalidThreadId: string;
  untitled: string;
  newChatDisabled: string;
  activeActions: string;
  activeChat: string;
  activeChatState: string;
  menu: string;
  more: string;
};

export function buildLeftRailLabels(uiLang: Lang): LeftRailLabels {
  return {
    brand: "HOPY",
    growth: uiLang === "en" ? "Dashboard (Coming soon)" : "DASHBOARD（準備中）",
    memories: uiLang === "en" ? "Memories" : "メモリーズ",
    threads: uiLang === "en" ? "Threads" : "スレッド",
    newChat: uiLang === "en" ? "New Chat" : "新しいチャット",
    newChatSection: uiLang === "en" ? "New Chat" : "新しいチャット",
    chatSection: uiLang === "en" ? "Threads" : "スレッド",
    rename: uiLang === "en" ? "Rename" : "名前変更",
    delete: uiLang === "en" ? "Delete" : "削除",
    deleteConfirm:
      uiLang === "en" ? "Delete this chat? This cannot be undone." : "このチャットを削除しますか？この操作は取り消せません。",
    noThreads: uiLang === "en" ? "No threads" : "スレッドがありません",
    expand: uiLang === "en" ? "Expand" : "拡張",
    closeAria: uiLang === "en" ? "Close panel" : "パネルを閉じる",
    railAria: uiLang === "en" ? "Side panel" : "サイドパネル",
    recover: uiLang === "en" ? "Reset local data & reload" : "ローカルデータをリセットして再読み込み",
    recoverTitle: uiLang === "en" ? "Workspace error detected." : "ワークスペースでエラーが発生しています。",
    invalidThreadId: uiLang === "en" ? "Invalid thread id" : "スレッドIDが不正です",
    untitled: uiLang === "en" ? "Untitled" : "無題",
    newChatDisabled: uiLang === "en" ? "Send a message first" : "先にメッセージを送信してください",
    activeActions: uiLang === "en" ? "Chat actions" : "チャット操作",
    activeChat: uiLang === "en" ? "Current Chat" : "現在のチャット",
    activeChatState: uiLang === "en" ? "Current Chat" : "現在のチャット",
    menu: uiLang === "en" ? "Menu" : "メニュー",
    more: uiLang === "en" ? "More" : "その他",
  };
}

/*
このファイルの正式役割
LeftRail 内で使う表示文言を UI 言語ごとに返すラベル定義ファイル。
状態の唯一の正は作らず、New Chat / Current Chat / Threads / Memories などの表示名だけを統一する。
*/

/*
【今回このファイルで修正したこと】
1. memories を正式定義どおり、英語は Memories、日本語は メモリーズ に修正しました。
2. threads を正式定義どおり、英語は Threads、日本語は スレッド に修正しました。
3. newChat と newChatSection を正式定義どおり、英語は New Chat、日本語は 新しいチャット に修正しました。
4. chatSection を英語は Threads、日本語は スレッド に修正しました。
5. noThreads を英語は No threads、日本語は スレッドがありません に修正しました。
6. activeChat と activeChatState を Current Chat / 現在のチャット に揃えました。
7. menu の日本語を メニュー に修正しました。
8. 状態の再判定、state_changed の再計算、0..4 前提への変換は一切追加していません。
*/