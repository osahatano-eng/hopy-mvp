// /components/chat/view/ChatMessagePane.tsx
"use client";

import React from "react";
import { ChatStream } from "./ChatStream";
import GuestIntroHost from "./GuestIntroHost";
import JumpButton from "./JumpButton";
import PreparingHero from "./PreparingHero";
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

  void shouldShowWorkspaceHero;

  const renderedMessageCount = React.useMemo(() => {
    if (!Array.isArray(rendered) || rendered.length === 0) return 0;

    return rendered.reduce((count, item) => {
      const kind = String((item as any)?.kind ?? "").trim();
      if (kind === "msg") return count + 1;
      if ((item as any)?.msg) return count + 1;
      return count;
    }, 0);
  }, [rendered]);

  const hasRenderedContent = renderedMessageCount > 0;
  const resolvedShouldShowPreparing =
    shouldShowPreparing && !showRecoverUi && !showStuckUi;

  const streamLoading = hasRenderedContent ? loading : false;

  const shouldShowGuestPreparingHero =
    guestMode &&
    resolvedShouldShowPreparing &&
    !hasRenderedContent &&
    !streamLoading;

  const shouldShowGuestIntroMotion =
    guestMode &&
    shouldShowGuestHero &&
    !shouldShowGuestPreparingHero;

  const shouldRenderGuestStream =
    hasRenderedContent ||
    showRecoverUi ||
    showStuckUi ||
    (resolvedShouldShowPreparing && hasRenderedContent) ||
    (!resolvedShouldShowPreparing && streamLoading);

  const shouldRenderWorkspaceBlankStage =
    workspaceMode &&
    shouldHoldBlankThreadStage &&
    !showRecoverUi &&
    !showStuckUi &&
    !resolvedShouldShowPreparing &&
    !hasRenderedContent &&
    !streamLoading;

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
      loading={streamLoading}
      bottomRef={bottomRef}
      scrollerRef={scrollerRef}
      topInset={topInset}
    />
  );

  const blankThreadStageNode = (
    <ChatStream
      uiLang={uiLang}
      ui={ui}
      canShowMore={false}
      onShowMore={onShowMore}
      rendered={[]}
      visibleTexts={visibleTexts}
      shouldShowPreparing={false}
      preparingLabel={labels.preparingLabel}
      shouldShowRecover={false}
      recoverTitle={labels.recoverTitle}
      userStateErr={userStateErr}
      reloadLabel={labels.reloadLabel}
      resetLabel={labels.resetLabel}
      onReload={onReload}
      onResetAndReload={onResetAndReload}
      shouldShowStuck={false}
      stuckLabel={labels.stuckLabel}
      loading={false}
      bottomRef={bottomRef}
      scrollerRef={scrollerRef}
      topInset={topInset}
    />
  );

  if (guestMode) {
    return (
      <>
        {shouldRenderGuestStream ? (
          streamNode
        ) : shouldShowGuestPreparingHero ? (
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
          !shouldShowGuestIntroMotion &&
          !shouldShowGuestPreparingHero && (
            <JumpButton ariaLabel={jumpAria} onClick={onJumpToBottom} />
          )}
      </>
    );
  }

  return (
    <>
      {shouldRenderWorkspaceBlankStage ? blankThreadStageNode : streamNode}

      {shouldShowJump && !shouldRenderWorkspaceBlankStage && (
        <JumpButton ariaLabel={jumpAria} onClick={onJumpToBottom} />
      )}
    </>
  );
});

export default ChatMessagePane;

/*
【このファイルの正式役割】
チャット本文エリアの表示切替ファイル。
guest 側では stream / guest intro / guest preparing / jump button を切り替える。
workspace 側では blank thread stage と本文 stream のどちらを出すかを切り替える。
*/

/*
【今回このファイルで修正したこと】
1. rendered.length ではなく、実際に msg を持つ描画項目数だけを renderedMessageCount として判定するように修正しました。
2. 待機用の描画データだけでは hasRenderedContent=true にならないようにし、workspace 側で blank stage / stream の判定がぶれないように修正しました。
3. streamLoading と shouldShowPreparing も同じ基準へそろえ、本文がないのに本文あり扱いで待機表示へ落ちる経路を止めました。
4. guest 側の intro / preparing / stream 切替ロジックの意味は変えていません。
5. HOPY唯一の正である state_changed / HOPY回答○ / Compass / DB保存 / DB復元の意味判定には触っていません。
*/

/* /components/chat/view/ChatMessagePane.tsx */