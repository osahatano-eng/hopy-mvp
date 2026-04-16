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

type Props = {
  guestMode: boolean;
  workspaceMode: boolean;
  uiLang: Lang;
  ui: UiDict;
  labels: Labels;
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

  const hasRenderedItems = rendered.length > 0;

  const shouldRenderStream =
    !shouldHoldBlankThreadStage &&
    (hasRenderedItems || showRecoverUi || showStuckUi);

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

  const shouldRenderWorkspaceBlankStage =
    workspaceMode &&
    (shouldHoldBlankThreadStage ||
      (shouldShowWorkspaceHero && !shouldRenderStream));

  const streamNode = (
    <ChatStream
      uiLang={uiLang}
      ui={ui}
      canShowMore={canShowMore}
      onShowMore={onShowMore}
      rendered={rendered}
      visibleTexts={visibleTexts}
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
      {shouldRenderWorkspaceBlankStage ? (
        <WorkspaceHero uiLang={uiLang} />
      ) : (
        streamNode
      )}

      {shouldShowJump && !shouldRenderWorkspaceBlankStage && (
        <JumpButton ariaLabel={jumpAria} onClick={onJumpToBottom} />
      )}
    </>
  );
});

export default ChatMessagePane;

/*
【このファイルの正式役割】
チャット本文エリアの最終表示切替ファイル。
受け取った props を使って、
guest 側では stream / guest intro / guest preparing / jump button を切り替え、
workspace 側では workspace hero と本文 stream のどちらを出すかを1箇所で決める。
このファイルは thread 作成責務を持たない。
message 保存責務を持たない。
title 自動生成責務を持たない。
HOPY唯一の正を再判定しない。
本文があるかどうかを最優先に見て、本文があるなら stream を優先する。
ただし、親から shouldHoldBlankThreadStage が渡された間は、
古い本文を出し続けず blank stage を優先する。
*/

/*
【今回このファイルで修正したこと】
1. shouldHoldBlankThreadStage=true のときは shouldShowWorkspaceHero に関係なく WorkspaceHero を優先するようにしました。
2. workspace 側の blank stage 判定を、旧本文描画より強い唯一の分岐に戻しました。
3. hasRenderedItems から不要な Array.isArray 保険判定を削除した状態は維持しました。
4. 本文表示切替、shouldHoldBlankThreadStage、confirmed payload、state_changed、HOPY回答○、Compass、DB保存/復元、1..5 の唯一の正には触っていません。
*/

/* /components/chat/view/ChatMessagePane.tsx */