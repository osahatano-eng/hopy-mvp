// /components/chat/view/hooks/useChatClientViewSurface.ts
"use client";

import React from "react";
import type { HopyState } from "../../lib/stateBadge";
import type { FailedSend } from "../../lib/useChatSend";
import type { UiDict } from "../chatClientViewTypes";

export function useChatClientViewSurface(args: {
  uiLang: "ja" | "en";
  ui: UiDict;
  loggedIn: boolean;
  messagesLength: number;
  renderedLength: number;
  activeThreadId: string | null;
  userState: HopyState | null;
  userStateErr: string | null;
  lastFailed: FailedSend | null;
  normalizedInput: string;
  loading: boolean;
  threadBusy: boolean;
}) {
  const {
    uiLang,
    ui,
    loggedIn,
    messagesLength,
    renderedLength,
    activeThreadId,
    userState,
    userStateErr,
    lastFailed,
    normalizedInput,
    loading,
    threadBusy,
  } = args;

  void userState;
  void userStateErr;

  const workspaceMode = Boolean(loggedIn);
  const guestMode = !workspaceMode;
  const busy = Boolean(loading || threadBusy);

  const activeThreadIdSafe = String(activeThreadId ?? "").trim();
  const hasActiveThreadSelection = activeThreadIdSafe.length > 0;

  const hasDraftInput = normalizedInput.trim().length > 0;
  const hasRenderableChatContent = renderedLength > 0 || messagesLength > 0;
  const hasAnyChatContent = hasRenderableChatContent;

  const autoWorkspaceHeroDismissed = Boolean(
    busy || hasAnyChatContent || hasDraftInput || lastFailed || hasActiveThreadSelection,
  );

  const [manualWorkspaceHeroDismissed, setManualWorkspaceHeroDismissed] =
    React.useState(false);

  React.useEffect(() => {
    if (autoWorkspaceHeroDismissed) {
      setManualWorkspaceHeroDismissed(false);
    }
  }, [autoWorkspaceHeroDismissed]);

  const workspaceHeroDismissed =
    autoWorkspaceHeroDismissed || manualWorkspaceHeroDismissed;

  const setWorkspaceHeroDismissed = React.useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setManualWorkspaceHeroDismissed((prev) =>
        typeof next === "function" ? next(prev) : next,
      );
    },
    [],
  );

  const dismissWorkspaceHero = React.useCallback(() => {
    setManualWorkspaceHeroDismissed(true);
  }, []);

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

  const guestCopy = React.useMemo(() => {
    return {
      heroTitle: "HOPY",
      heroSub:
        uiLang === "en"
          ? "A quiet companion for clear thinking."
          : "思考を澄ませる、静かな伴走者。",
      cta:
        uiLang === "en"
          ? "Log in to start a new saved chat"
          : "ログインして保存できる新しいチャットを始める",
    };
  }, [uiLang]);

  const shouldShowWorkspaceHero = React.useMemo(() => {
    if (!workspaceMode) return false;
    if (workspaceHeroDismissed) return false;
    if (hasActiveThreadSelection) return false;
    return !busy && !hasAnyChatContent;
  }, [
    workspaceMode,
    workspaceHeroDismissed,
    hasActiveThreadSelection,
    busy,
    hasAnyChatContent,
  ]);

  const shouldShowGuestHero = React.useMemo(() => {
    if (!guestMode) return false;
    return !busy && !hasAnyChatContent;
  }, [guestMode, busy, hasAnyChatContent]);

  const shouldShowPreparing = React.useMemo(() => {
    if (!workspaceMode) return false;
    if (shouldShowWorkspaceHero) return false;
    if (hasActiveThreadSelection) return false;
    return busy && !hasAnyChatContent;
  }, [
    workspaceMode,
    shouldShowWorkspaceHero,
    hasActiveThreadSelection,
    busy,
    hasAnyChatContent,
  ]);

  const shouldShowStuck = React.useMemo(() => {
    if (!workspaceMode) return false;
    if (!busy) return false;
    return !hasAnyChatContent && !hasActiveThreadSelection;
  }, [workspaceMode, busy, hasAnyChatContent, hasActiveThreadSelection]);

  const shouldShowRecover = React.useMemo(() => {
    if (!workspaceMode) return false;
    if (busy) return false;
    if (hasActiveThreadSelection) return false;
    return !hasAnyChatContent && Boolean(lastFailed);
  }, [
    workspaceMode,
    busy,
    hasActiveThreadSelection,
    hasAnyChatContent,
    lastFailed,
  ]);

  const [showRecoverUi, setShowRecoverUi] = React.useState(false);
  const [showStuckUi, setShowStuckUi] = React.useState(false);

  React.useEffect(() => {
    if (!shouldShowRecover) {
      setShowRecoverUi(false);
      return;
    }
    const t = window.setTimeout(() => setShowRecoverUi(true), 900);
    return () => window.clearTimeout(t);
  }, [shouldShowRecover]);

  React.useEffect(() => {
    if (!shouldShowStuck) {
      setShowStuckUi(false);
      return;
    }
    const t = window.setTimeout(() => setShowStuckUi(true), 1800);
    return () => window.clearTimeout(t);
  }, [shouldShowStuck]);

  const overlayUserState = null;

  return {
    workspaceMode,
    guestMode,
    busy,
    workspaceHeroDismissed,
    setWorkspaceHeroDismissed,
    dismissWorkspaceHero,
    uiForComposer,
    labels,
    guestCopy,
    hasAnyChatContent,
    shouldShowWorkspaceHero,
    shouldShowGuestHero,
    shouldShowPreparing,
    showRecoverUi,
    showStuckUi,
    overlayUserState,
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
1. activeThreadId の有無を hasActiveThreadSelection として明示し、選択中スレッドがある間は待機画面系を出さないように修正しました。
2. shouldShowWorkspaceHero / shouldShowPreparing / shouldShowStuck / shouldShowRecover の表示条件に activeThreadId 条件を統一して入れました。
3. autoWorkspaceHeroDismissed にも activeThreadId 条件を追加し、スレッド選択中に待機画面へ戻らないようにしました。
4. HOPY唯一の正である state_changed、HOPY回答○、Compass、DB保存、DB復元の判定には触っていません。
*/

/* /components/chat/view/hooks/useChatClientViewSurface.ts */