// /components/chat/view/hooks/useChatClientViewMessagePaneProps.ts
"use client";

import React from "react";

const EMPTY_RENDERED: any[] = [];
const EMPTY_VISIBLE_TEXTS = new Map<any, any>();

type FutureChainPlan = "free" | "plus" | "pro";

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
  futureChainDisplay?: any | null;
  futureChainPlan?: FutureChainPlan | null;
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
    futureChainDisplay = null,
    futureChainPlan = null,
  } = args;

  const topInset = React.useMemo(() => {
    const chatHeaderInset = "calc(48px + env(safe-area-inset-top))";
    return isMobile ? chatHeaderInset : "0px";
  }, [isMobile]);

  const paneRendered = Array.isArray(rendered) ? rendered : EMPTY_RENDERED;
  const paneVisibleTexts =
    visibleTexts instanceof Map ? visibleTexts : EMPTY_VISIBLE_TEXTS;

  const hasRenderedItems = paneRendered.length > 0;
  const holdingBlankThreadStage =
    Boolean(shouldHoldBlankThreadStage) && !hasRenderedItems;

  const paneCanShowMore = holdingBlankThreadStage ? false : canShowMore;
  const paneShouldShowGuestHero = holdingBlankThreadStage
    ? false
    : shouldShowGuestHero;
  const paneShouldShowWorkspaceHero = shouldShowWorkspaceHero;
  const paneShouldShowPreparing = shouldShowPreparing;

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
      shouldShowGuestHero: paneShouldShowGuestHero,
      shouldShowWorkspaceHero: paneShouldShowWorkspaceHero,
      shouldHoldBlankThreadStage: holdingBlankThreadStage,
      shouldShowPreparing: paneShouldShowPreparing,
      showRecoverUi,
      showStuckUi,
      shouldShowJump,
      jumpAria,
      onJumpToBottom,
      onReload,
      onResetAndReload,
      futureChainDisplay,
      futureChainPlan,
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
      paneShouldShowGuestHero,
      paneShouldShowWorkspaceHero,
      holdingBlankThreadStage,
      paneShouldShowPreparing,
      showRecoverUi,
      showStuckUi,
      shouldShowJump,
      jumpAria,
      onJumpToBottom,
      onReload,
      onResetAndReload,
      futureChainDisplay,
      futureChainPlan,
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
1. futureChainDisplay を親から受け取れる入口として追加しました。
2. futureChainPlan を親から受け取れる入口として追加しました。
3. 受け取った futureChainDisplay / futureChainPlan を messagePaneProps にそのまま渡すようにしました。
4. このファイル内では plan を生成していません。
5. このファイル内では free / plus / pro を判定していません。
6. このファイル内では handoffMessageSnapshot を生成・加工していません。
7. 本文採用、confirmed payload、state_changed、HOPY回答○、Compass、DB保存/復元、1..5 の唯一の正には触っていません。
*/

/*
【このファイルの正式役割】
ChatClientView の中にあった ChatMessagePane 向け props 組み立て本体を切り出し、
本文表示用の受け渡し値を 1 つにまとめて返す責務だけを持つ。
親から受け取った futureChainDisplay / futureChainPlan は、
意味を変えずに ChatMessagePane へ渡す。

【今回このファイルで修正したこと】
ChatClientView から ChatMessagePane へ Future Chain 表示payloadとplanを渡すための通路を追加した。
このファイルでは Future Chain の表示可否、保存可否、plan判定、handoffMessageSnapshot生成、
state_changed、state_level、Compass、HOPY回答○、DB保存、recipient_support検索は再判定していない。

/components/chat/view/hooks/useChatClientViewMessagePaneProps.ts
*/