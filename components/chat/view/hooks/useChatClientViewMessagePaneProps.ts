// /components/chat/view/hooks/useChatClientViewMessagePaneProps.ts
"use client";

import React from "react";

const EMPTY_RENDERED: any[] = [];
const EMPTY_VISIBLE_TEXTS = new Map<any, any>();

type UseChatClientViewMessagePanePropsArgs = {
  guestMode: boolean;
  workspaceMode: boolean;
  uiLang: "ja" | "en";
  ui: any;
  labels: any;
  rendered: any[];
  visibleTexts: Map<any, any>;
  canShowMore: boolean;
  onShowMore: () => void;
  scrollerRef: React.RefObject<HTMLElement | null>;
  bottomRef: React.RefObject<HTMLElement | null>;
  paneLoading: boolean;
  userStateErr: string | null;
  shouldShowGuestHero: boolean;
  shouldShowWorkspaceHero: boolean;
  shouldHoldBlankThreadStage: boolean;
  shouldShowPreparing: boolean;
  showRecoverUi: boolean;
  showStuckUi: boolean;
  shouldShowJump: boolean;
  onJumpToBottom: () => void;
  jumpAria: string;
  onReload: () => void;
  onResetAndReload: () => void;
  isMobile: boolean;
};

export function useChatClientViewMessagePaneProps(
  args: UseChatClientViewMessagePanePropsArgs,
) {
  const {
    guestMode,
    workspaceMode,
    uiLang,
    ui,
    labels,
    rendered,
    visibleTexts,
    canShowMore,
    onShowMore,
    scrollerRef,
    bottomRef,
    paneLoading,
    userStateErr,
    shouldShowGuestHero,
    shouldShowWorkspaceHero,
    shouldHoldBlankThreadStage,
    shouldShowPreparing,
    showRecoverUi,
    showStuckUi,
    shouldShowJump,
    onJumpToBottom,
    jumpAria,
    onReload,
    onResetAndReload,
    isMobile,
  } = args;

  const topInset = React.useMemo(() => {
    const chatHeaderInset = "calc(48px + env(safe-area-inset-top))";
    return isMobile ? chatHeaderInset : "0px";
  }, [isMobile]);

  const paneRendered = shouldHoldBlankThreadStage ? EMPTY_RENDERED : rendered;
  const paneVisibleTexts = shouldHoldBlankThreadStage
    ? EMPTY_VISIBLE_TEXTS
    : visibleTexts;
  const paneCanShowMore = shouldHoldBlankThreadStage ? false : canShowMore;

  const messagePaneProps = React.useMemo(
    () => ({
      guestMode,
      workspaceMode,
      uiLang,
      ui,
      labels,
      topInset,
      rendered: paneRendered,
      visibleTexts: paneVisibleTexts,
      canShowMore: paneCanShowMore,
      onShowMore,
      scrollerRef,
      bottomRef,
      loading: paneLoading,
      userStateErr,
      shouldShowGuestHero,
      shouldShowWorkspaceHero,
      shouldHoldBlankThreadStage,
      shouldShowPreparing,
      showRecoverUi,
      showStuckUi,
      shouldShowJump,
      jumpAria,
      onJumpToBottom,
      onReload,
      onResetAndReload,
    }),
    [
      guestMode,
      workspaceMode,
      uiLang,
      ui,
      labels,
      topInset,
      paneRendered,
      paneVisibleTexts,
      paneCanShowMore,
      onShowMore,
      scrollerRef,
      bottomRef,
      paneLoading,
      userStateErr,
      shouldShowGuestHero,
      shouldShowWorkspaceHero,
      shouldHoldBlankThreadStage,
      shouldShowPreparing,
      showRecoverUi,
      showStuckUi,
      shouldShowJump,
      jumpAria,
      onJumpToBottom,
      onReload,
      onResetAndReload,
    ],
  );

  return {
    messagePaneProps,
  };
}

/*
このファイルの正式役割:
ChatClientView の中にあった ChatMessagePane 向け props 組み立て本体を切り出し、
本文表示用の受け渡し値を 1 つにまとめて返す責務だけを持つ。
このファイルは、状態や Compass を再判定する場所ではなく、
本文採用の唯一の正を作る場所でもなく、
親から受け取った値をそのまま ChatMessagePane 向け props に整えて返すだけを担当する。
*/

/*
【今回このファイルで修正したこと】
1. shouldHoldBlankThreadStage=true のときは rendered を空配列へ切り替えるようにしました。
2. shouldHoldBlankThreadStage=true のときは visibleTexts を空 Map へ切り替えるようにしました。
3. shouldHoldBlankThreadStage=true のときは canShowMore を false に固定しました。
4. 本文採用、confirmed payload、state_changed、HOPY回答○、Compass、1..5 の唯一の正には触っていません。
*/

/* /components/chat/view/hooks/useChatClientViewMessagePaneProps.ts */