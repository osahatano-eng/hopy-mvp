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

  void activeThreadId;
  void userState;
  void userStateErr;
  void normalizedInput;

  const workspaceMode = Boolean(loggedIn);
  const guestMode = !workspaceMode;
  const busy = Boolean(loading || threadBusy);

  const hasRenderedRows = renderedLength > 0;
  const hasMessageRows = messagesLength > 0;
  const hasRenderableChatContent = hasRenderedRows || hasMessageRows;

  const hasPendingWorkspaceSend =
    workspaceMode &&
    loading &&
    !lastFailed &&
    !hasRenderableChatContent;

  const hasAnyChatContent = Boolean(
    hasRenderableChatContent || lastFailed || hasPendingWorkspaceSend,
  );

  const workspaceHeroDismissed = false;

  const setWorkspaceHeroDismissed = React.useCallback(
    (_next: boolean | ((prev: boolean) => boolean)) => {},
    [],
  );

  const dismissWorkspaceHero = React.useCallback(() => {}, []);

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

  const shouldShowWorkspaceHero = false;
  const shouldShowPreparing = false;
  const showRecoverUi = false;
  const showStuckUi = false;

  const shouldShowGuestHero = React.useMemo(() => {
    if (!guestMode) return false;
    if (busy) return false;
    if (lastFailed) return false;
    return !hasRenderableChatContent;
  }, [guestMode, busy, lastFailed, hasRenderableChatContent]);

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
1. 新規チャット1通目送信直後の pending 判定から activeThreadId 依存を外しました。
2. hasPendingWorkspaceSend を loading 基準へ寄せ、送信中の本文未反映瞬間でも hasAnyChatContent を true にできるようにしました。
3. renderedLength と messagesLength を hasRenderedRows / hasMessageRows に分け、surface 判定の意味を明確にしました。
4. HOPY唯一の正である confirmed payload / state_changed / HOPY回答○ / Compass / DB保存 / DB復元の判定には触っていません。
*/

/* /components/chat/view/hooks/useChatClientViewSurface.ts */