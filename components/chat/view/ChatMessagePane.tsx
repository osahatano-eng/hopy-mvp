// /components/chat/view/ChatMessagePane.tsx
"use client";

import React from "react";
import { ChatStream } from "./ChatStream";
import type { ChatStreamFutureChainPlan } from "./chatStreamFutureChainItem";
import GuestIntroHost from "./GuestIntroHost";
import JumpButton from "./JumpButton";
import PreparingHero from "./PreparingHero";
import WorkspaceHero from "./WorkspaceHero";
import type { ChatMsg, Lang } from "../lib/chatTypes";

type RenderItem =
  | { kind: "divider"; key: string; label: string }
  | { kind: "msg"; key: string; msg: ChatMsg; msgKey: string };

type UiDict = {
  title: string;
  login: string;
  placeholder: string;
  sending: string;
  enterHint: string;
  jumpAria: string;
  dayStart: string;
  more: string;
  loginAlert: string;
  emptyReply: string;
  memories: string;
  retry: string;
  failed: string;
  privacy: string;
  stateTitle: string;
  stateUnknownShort: string;
  statePhase0: string;
  statePhase1: string;
  statePhase2: string;
};

type Labels = {
  reloadLabel: string;
  resetLabel: string;
  preparingLabel: string;
  stuckLabel: string;
  recoverTitle: string;
};

type Props = {
  guestMode: boolean;
  workspaceMode: boolean;
  uiLang: Lang;
  ui: UiDict;
  labels: Labels;
  topInset: string;
  rendered: RenderItem[];
  visibleTexts: Map<string, string>;
  futureChainPlan?: ChatStreamFutureChainPlan | null;
  futureChainDisplay?: unknown | null;
  canShowMore: boolean;
  onShowMore: () => void;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
  userStateErr: string | null;
  shouldShowGuestHero: boolean;
  shouldShowWorkspaceHero: boolean;
  shouldHoldBlankThreadStage: boolean;
  shouldShowPreparing: boolean;
  showRecoverUi: boolean;
  showStuckUi: boolean;
  onReload: () => void;
  onResetAndReload: () => void;
  shouldShowJump: boolean;
  jumpAria: string;
  onJumpToBottom: () => void;
};

export const ChatMessagePane = React.memo(function ChatMessagePane(props: Props) {
  const {
    guestMode,
    workspaceMode,
    uiLang,
    ui,
    labels,
    rendered,
    visibleTexts,
    futureChainPlan = null,
    futureChainDisplay = null,
    canShowMore,
    onShowMore,
    scrollerRef,
    bottomRef,
    loading,
    userStateErr,
    shouldShowGuestHero,
    shouldShowWorkspaceHero,
    shouldShowPreparing,
    showRecoverUi,
    showStuckUi,
    onReload,
    onResetAndReload,
    shouldShowJump,
    jumpAria,
    onJumpToBottom,
    topInset,
  } = props;

  const hasRenderedItems = rendered.length > 0;
  const shouldRenderStream = hasRenderedItems || showRecoverUi || showStuckUi;

  const shouldShowGuestPreparingHero =
    guestMode &&
    shouldShowPreparing &&
    !hasRenderedItems &&
    !showRecoverUi &&
    !showStuckUi;

  const shouldShowGuestIntroMotion =
    guestMode &&
    shouldShowGuestHero &&
    !hasRenderedItems &&
    !showRecoverUi &&
    !showStuckUi &&
    !shouldShowGuestPreparingHero;

  const shouldRenderWorkspaceHero =
    workspaceMode && shouldShowWorkspaceHero && !shouldRenderStream;

  const streamNode = (
    <ChatStream
      uiLang={uiLang}
      ui={ui}
      canShowMore={canShowMore}
      onShowMore={onShowMore}
      rendered={rendered}
      visibleTexts={visibleTexts}
      futureChainPlan={futureChainPlan}
      futureChainDisplay={futureChainDisplay}
      shouldShowPreparing={shouldShowPreparing && hasRenderedItems}
      preparingLabel={labels.preparingLabel}
      shouldShowRecover={showRecoverUi}
      recoverTitle={labels.recoverTitle}
      userStateErr={userStateErr}
      reloadLabel={labels.reloadLabel}
      resetLabel={labels.resetLabel}
      onReload={onReload}
      onResetAndReload={onResetAndReload}
      shouldShowStuck={showStuckUi}
      stuckLabel={labels.stuckLabel}
      loading={loading}
      bottomRef={bottomRef}
      scrollerRef={scrollerRef}
      topInset={topInset}
    />
  );

  if (guestMode) {
    return (
      <>
        {shouldShowGuestIntroMotion ? (
          <GuestIntroHost uiLang={uiLang === "en" ? "en" : "ja"} />
        ) : shouldShowGuestPreparingHero ? (
          <PreparingHero
            uiLang={uiLang === "en" ? "en" : "ja"}
            fallbackLabel={labels.preparingLabel}
          />
        ) : (
          streamNode
        )}

        {shouldShowJump &&
          !shouldShowGuestIntroMotion &&
          !shouldShowGuestPreparingHero && (
            <JumpButton ariaLabel={jumpAria} onClick={onJumpToBottom} />
          )}
      </>
    );
  }

  return (
    <>
      {shouldRenderWorkspaceHero ? (
        <WorkspaceHero uiLang={uiLang} />
      ) : (
        streamNode
      )}

      {shouldShowJump && !shouldRenderWorkspaceHero && (
        <JumpButton ariaLabel={jumpAria} onClick={onJumpToBottom} />
      )}
    </>
  );
});

export default ChatMessagePane;

/*
【このファイルの正式役割】
チャット本文エリアの最終表示切替ファイル。
受け取った props を使って、guest / workspace の本文表示切替と ChatStream への中継だけを担当する。
Future Chain の意味生成や plan 判定は担当せず、
受け取った futureChainPlan / futureChainDisplay を下流へ渡すだけを担当する。

【今回このファイルで修正したこと】
futureChainDisplay を props として受け取れるようにした。
受け取った futureChainDisplay を ChatStream へ渡す中継を追加した。
このファイルでは state_changed、state_level、Compass、HOPY回答○、DB保存、
recipient_support検索、delivery_event保存、Future Chainページには触れていない。

/components/chat/view/ChatMessagePane.tsx
*/