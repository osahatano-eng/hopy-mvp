// /components/chat/view/hooks/useChatClientViewSurface.ts
"use client";

import React from "react";
import type { FailedSend } from "../../lib/useChatSend";
import type { UiDict } from "../chatClientViewTypes";

export function useChatClientViewSurface(args: {
  uiLang: "ja" | "en";
  ui: UiDict;
  loggedIn: boolean;
  messagesLength: number;
  renderedLength: number;
  activeThreadId: string | null;
  lastFailed: FailedSend | null;
  loading: boolean;
}) {
  const {
    uiLang,
    ui,
    loggedIn,
    messagesLength,
    renderedLength,
    activeThreadId,
    lastFailed,
    loading,
  } = args;

  const workspaceMode = Boolean(loggedIn);
  const guestMode = !workspaceMode;

  const busy = Boolean(loading);

  const hasRenderedRows = renderedLength > 0;
  const hasMessageRows = messagesLength > 0;
  const hasRenderableChatContent = hasRenderedRows || hasMessageRows;

  const hasSelectedWorkspaceThread =
    typeof activeThreadId === "string" && activeThreadId.trim().length > 0;

  const uiForComposer = React.useMemo<UiDict>(() => {
    return {
      ...ui,
      placeholder: ui.placeholder,
      enterHint: "",
      privacy: "",
    };
  }, [ui]);

  const labels = React.useMemo(() => {
    const reloadLabel = uiLang === "en" ? "Reload" : "再読み込み";
    const resetLabel =
      uiLang === "en"
        ? "Reset local data & reload"
        : "ローカルデータをリセットして再読み込み";
    const preparingLabel =
      uiLang === "en"
        ? "Preparing your workspace…"
        : "ワークスペースを準備中…";
    const stuckLabel =
      uiLang === "en"
        ? "Loading is stuck. Please reload."
        : "読み込みが止まりました。再読み込みしてください。";
    const recoverTitle =
      uiLang === "en"
        ? "Workspace could not be loaded."
        : "ワークスペースを読み込めませんでした。";
    return {
      reloadLabel,
      resetLabel,
      preparingLabel,
      stuckLabel,
      recoverTitle,
    };
  }, [uiLang]);

  const shouldShowWorkspaceHero = React.useMemo(() => {
    if (!workspaceMode) return false;
    if (busy) return false;
    if (lastFailed) return false;
    if (!hasSelectedWorkspaceThread) return true;
    return !hasRenderableChatContent;
  }, [
    workspaceMode,
    busy,
    lastFailed,
    hasSelectedWorkspaceThread,
    hasRenderableChatContent,
  ]);

  const shouldShowGuestHero = React.useMemo(() => {
    if (!guestMode) return false;
    if (busy) return false;
    if (lastFailed) return false;
    return !hasRenderableChatContent;
  }, [guestMode, busy, lastFailed, hasRenderableChatContent]);

  return {
    workspaceMode,
    guestMode,
    busy,
    uiForComposer,
    labels,
    shouldShowWorkspaceHero,
    shouldShowGuestHero,
  };
}

/*
このファイルの正式役割:
ChatClientView 用の表示補助値だけを整理して返す surface hook。
確定済みの入力状態・表示状態・文言を UI 用に整える責務を持ち、
HOPY の状態や Compass や hold 条件を再判定する場所ではない。
*/

/*
【今回このファイルで修正したこと】
1. 固定値だった workspaceHeroDismissed を削除しました。
2. 空 callback だった setWorkspaceHeroDismissed / dismissWorkspaceHero を削除しました。
3. 固定 false だった shouldShowPreparing / showRecoverUi / showStuckUi を削除しました。
4. shouldShowWorkspaceHero から、削除した workspaceHeroDismissed 依存だけを外しました。
5. confirmed payload / state_changed / HOPY回答○ / Compass / DB保存 / DB復元の判定には触っていません。
*/

/* /components/chat/view/hooks/useChatClientViewSurface.ts */