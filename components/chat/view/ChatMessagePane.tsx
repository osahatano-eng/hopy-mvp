// /components/chat/view/ChatMessagePane.tsx
"use client";

import React from "react";
import { ChatStream } from "./ChatStream";
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

type GuestCopy = {
  heroTitle: string;
  heroSub: string;
  cta: string;
};

type Props = {
  guestMode: boolean;
  workspaceMode: boolean;
  uiLang: Lang;
  ui: UiDict;
  labels: Labels;
  guestCopy: GuestCopy;
  topInset: string;
  rendered: RenderItem[];
  visibleTexts: Map<string, string>;
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
  login: () => Promise<void> | void;
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
    canShowMore,
    onShowMore,
    scrollerRef,
    bottomRef,
    loading,
    userStateErr,
    shouldShowGuestHero,
    shouldShowWorkspaceHero,
    shouldHoldBlankThreadStage,
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

  const hasRenderedContent = rendered.length > 0;
  const resolvedShouldShowPreparing =
    shouldShowPreparing && !showRecoverUi && !showStuckUi;

  const shouldHoldBlankFallbackUi =
    shouldHoldBlankThreadStage &&
    !hasRenderedContent &&
    !loading &&
    !resolvedShouldShowPreparing &&
    !showRecoverUi &&
    !showStuckUi;

  const shouldShowPreparingHero =
    resolvedShouldShowPreparing && !hasRenderedContent && !shouldHoldBlankFallbackUi;

  const shouldShowGuestIntroMotion =
    guestMode && shouldShowGuestHero && !shouldHoldBlankFallbackUi;

  const shouldShowWorkspaceWaitingHero =
    workspaceMode &&
    !hasRenderedContent &&
    !loading &&
    !resolvedShouldShowPreparing &&
    !showRecoverUi &&
    !showStuckUi &&
    !shouldHoldBlankFallbackUi &&
    shouldShowWorkspaceHero;

  const shouldRenderStream =
    !shouldHoldBlankFallbackUi &&
    (hasRenderedContent ||
      showRecoverUi ||
      showStuckUi ||
      (resolvedShouldShowPreparing && hasRenderedContent) ||
      (!resolvedShouldShowPreparing && loading));

  const streamNode = (
    <ChatStream
      uiLang={uiLang}
      ui={ui}
      canShowMore={canShowMore}
      onShowMore={onShowMore}
      rendered={rendered}
      visibleTexts={visibleTexts}
      shouldShowPreparing={resolvedShouldShowPreparing && hasRenderedContent}
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
        {shouldHoldBlankFallbackUi ? null : shouldRenderStream ? (
          streamNode
        ) : shouldShowPreparingHero ? (
          <PreparingHero
            uiLang={uiLang === "en" ? "en" : "ja"}
            fallbackLabel={labels.preparingLabel}
          />
        ) : shouldShowGuestIntroMotion ? (
          <GuestIntroHost uiLang={uiLang === "en" ? "en" : "ja"} />
        ) : (
          streamNode
        )}

        {shouldShowJump &&
          !shouldHoldBlankFallbackUi &&
          !shouldShowGuestIntroMotion &&
          !shouldShowPreparingHero && (
            <JumpButton ariaLabel={jumpAria} onClick={onJumpToBottom} />
          )}
      </>
    );
  }

  return (
    <>
      {shouldHoldBlankFallbackUi ? null : shouldRenderStream ? (
        streamNode
      ) : shouldShowPreparingHero ? (
        <PreparingHero uiLang={uiLang} fallbackLabel={labels.preparingLabel} />
      ) : shouldShowWorkspaceWaitingHero ? (
        <WorkspaceHero uiLang={uiLang} />
      ) : (
        streamNode
      )}

      {shouldShowJump &&
        !shouldHoldBlankFallbackUi &&
        !shouldShowWorkspaceWaitingHero &&
        !shouldShowPreparingHero && (
          <JumpButton ariaLabel={jumpAria} onClick={onJumpToBottom} />
        )}
    </>
  );
});

export default ChatMessagePane;

/*
【このファイルの正式役割】
チャット本文エリアの表示切替ファイル。
stream / preparing / guest intro / workspace hero / jump button の
どれを表示するかを、受け取った表示条件だけで切り替える。
*/

/*
【今回このファイルで修正したこと】
- workspaceHeroLocked の独自 state と effect を削除しました。
- 描画層での待機画面の記憶責務を消し、受け取った shouldShowWorkspaceHero をそのまま使う形に戻しました。
- HOPY唯一の正である state_changed / HOPY回答○ / Compass / DB保存 / DB復元の意味判定には触っていません。
*/

/* /components/chat/view/ChatMessagePane.tsx */