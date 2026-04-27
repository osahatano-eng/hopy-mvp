// /components/chat/ChatClientView.tsx
"use client";

import React from "react";
import styles from "./ChatClient.module.css";

import { useComposerOffset } from "./view/useComposerOffset";
import { useVisualViewportVars } from "./view/hooks/useVisualViewportVars";

import { ChatLayout } from "./view/ChatLayout";
import { ChatOverlays } from "./view/ChatOverlays";
import { ChatMessagePane } from "./view/ChatMessagePane";
import { ChatComposerSection } from "./view/ChatComposerSection";

import type { ChatClientViewProps } from "./view/chatClientViewTypes";
import { useChatViewportController } from "./view/hooks/useChatViewportController";
import { useChatClientViewSurface } from "./view/hooks/useChatClientViewSurface";
import { useChatClientViewThreadActions } from "./view/hooks/useChatClientViewThreadActions";
import { useChatClientViewMessagePaneProps } from "./view/hooks/useChatClientViewMessagePaneProps";
import { useChatClientViewComposerSectionProps } from "./view/hooks/useChatClientViewComposerSectionProps";

type FutureChainPlan = "free" | "plus" | "pro";

type FutureChainDisplayForView = {
  plan?: unknown;
} & Record<string, unknown>;

type ChatClientViewExtendedProps = ChatClientViewProps & {
  futureChainDisplay?: FutureChainDisplayForView | null;
  railOpen: boolean;
  onOpenRail: () => void;
  onCloseRail: () => void;
  onRailSwipeOpenTouchStart: (e: React.TouchEvent<HTMLElement>) => void;
  onRailSwipeOpenTouchEnd: (e: React.TouchEvent<HTMLElement>) => void;
  isLeftRailOpeningDrag?: boolean;
  shouldOpenLeftRailByDrag?: boolean;
  leftRailOpeningStyle?: React.CSSProperties;
  leftRailOpeningBackdropStyle?: React.CSSProperties;
  onLeftRailOpeningDragTouchStart?: (e: React.TouchEvent<HTMLElement>) => void;
  onLeftRailOpeningDragTouchMove?: (e: React.TouchEvent<HTMLElement>) => void;
  onLeftRailOpeningDragTouchEnd?: () => void;
  shouldHoldBlankThreadStage?: boolean;
};

function normalizeFutureChainPlan(value: unknown): FutureChainPlan | null {
  const plan = String(value ?? "").trim().toLowerCase();

  if (plan === "free" || plan === "plus" || plan === "pro") {
    return plan;
  }

  return null;
}

function resolveFutureChainPlan(params: {
  futureChainDisplay: FutureChainDisplayForView | null;
  userState: unknown;
}): FutureChainPlan {
  const displayPlan = normalizeFutureChainPlan(params.futureChainDisplay?.plan);
  if (displayPlan) return displayPlan;

  const statePlan = normalizeFutureChainPlan(
    (params.userState as { plan?: unknown } | null | undefined)?.plan,
  );

  return statePlan ?? "free";
}

export default function ChatClientView(props: ChatClientViewExtendedProps) {
  const {
    rootRef,
    loggedIn,
    email,
    uiLang,
    ui,

    futureChainDisplay = null,

    input,
    setInput,

    messages,
    loading,
    threadBusy,

    threads,
    activeThreadId,
    activeThread,
    activeThreadState,

    memOpen,
    setMemOpen,
    railOpen,
    onOpenRail,
    onCloseRail,
    onRailSwipeOpenTouchStart,
    onRailSwipeOpenTouchEnd,

    rendered,
    visibleTexts,

    canShowMore,
    onShowMore,

    scrollerRef,
    composerRef,
    inputRef,

    atBottom,
    setAtBottom,
    atBottomRef,

    userState,
    userStateErr,

    lastFailed,
    retryLastFailed,

    sendMessage,

    canSend,
    composing,
    normalizedInput,
    scrollToBottom,

    disableNewChat: disableNewChatProp,
    onChangeLang,

    isLeftRailOpeningDrag = false,
    shouldOpenLeftRailByDrag = false,
    leftRailOpeningStyle = {},
    leftRailOpeningBackdropStyle = {},
    onLeftRailOpeningDragTouchStart,
    onLeftRailOpeningDragTouchMove,
    onLeftRailOpeningDragTouchEnd,
    shouldHoldBlankThreadStage: shouldHoldBlankThreadStageFromClient = false,
  } = props;

  const disableNewChat = Boolean(disableNewChatProp);
  const renderedLength = Array.isArray(rendered) ? rendered.length : 0;

  const futureChainPlan = React.useMemo(
    () =>
      resolveFutureChainPlan({
        futureChainDisplay,
        userState,
      }),
    [futureChainDisplay, userState],
  );

  const scrollerDivRef =
    scrollerRef as React.RefObject<HTMLDivElement | null>;

  const surface = useChatClientViewSurface({
    uiLang,
    ui,
    loggedIn,
    messagesLength: messages.length,
    renderedLength,
    activeThreadId,
    lastFailed,
    loading,
  });

  const {
    workspaceMode,
    guestMode,
    uiForComposer,
    labels,
    shouldShowGuestHero,
    shouldShowWorkspaceHero,
  } = surface;

  const shouldShowWorkspaceHeroForPane =
    shouldShowWorkspaceHero && shouldHoldBlankThreadStageFromClient;

  const noopSetWorkspaceHeroDismissed = React.useCallback(
    (_next: boolean | ((prev: boolean) => boolean)) => {},
    [],
  );

  const shouldShowPreparing = false;
  const showRecoverUi = false;
  const showStuckUi = false;

  const setInputForComposer = React.useCallback<
    React.Dispatch<React.SetStateAction<string>>
  >(
    (updater) => {
      const nextValue =
        typeof updater === "function"
          ? (updater as (prevState: string) => string)(input)
          : updater;

      setInput(String(nextValue ?? ""));
    },
    [input, setInput],
  );

  useVisualViewportVars();
  useComposerOffset({ rootRef, composerRef, extraPx: 18 });

  const viewport = useChatViewportController({
    workspaceMode,
    activeThreadId,
    renderedLength,
    inputRef,
    scrollerRef: scrollerDivRef,
    atBottomRef,
    setAtBottom,
    scrollToBottom,
    dismissWorkspaceHero: () => {},
  });

  const {
    isMobile,
    bottomRef,
    armFocusGuard,
    runFocusGuard,
    stickToBottomNow,
    onJumpToBottom,
  } = viewport;

  const bottomDivRef =
    bottomRef as React.RefObject<HTMLDivElement | null>;

  const rootInlineStyle = React.useMemo<React.CSSProperties>(() => {
    if (isMobile) {
      return {
        ["--pcRailWidth" as any]: "0px",
      };
    }

    return {
      ["--pcRailWidth" as any]: railOpen ? "288px" : "0px",
    };
  }, [isMobile, railOpen]);

  const reloadPage = React.useCallback(() => {
    try {
      location.reload();
    } catch {}
  }, []);

  const canRunWorkspaceAction = React.useCallback(() => {
    return workspaceMode;
  }, [workspaceMode]);

  const { onSelectThread, onCreateThread, onRenameThread, onDeleteThread } =
    useChatClientViewThreadActions({
      threads,
      activeThreadId,
      shouldHoldBlankThreadStage: shouldHoldBlankThreadStageFromClient,
      disableNewChat,
      canRunWorkspaceAction,
      setWorkspaceHeroDismissed: noopSetWorkspaceHeroDismissed,
      closeRailForViewport: () => {
        if (!isMobile) return;
        onCloseRail();
      },
    });

  const { messagePaneProps } = useChatClientViewMessagePaneProps({
    guestMode,
    workspaceMode,
    uiLang,
    ui,
    labels,
    rendered,
    visibleTexts,
    canShowMore,
    onShowMore,
    scrollerRef: scrollerDivRef,
    bottomRef: bottomDivRef,
    paneLoading: loading,
    userStateErr,
    shouldShowGuestHero,
    shouldShowWorkspaceHero: shouldShowWorkspaceHeroForPane,
    shouldHoldBlankThreadStage: shouldHoldBlankThreadStageFromClient,
    shouldShowPreparing,
    showRecoverUi,
    showStuckUi,
    shouldShowJump: !atBottom,
    onJumpToBottom,
    jumpAria: ui.jumpAria,
    onReload: reloadPage,
    onResetAndReload: reloadPage,
    isMobile,
    futureChainDisplay,
    futureChainPlan,
  });

  const messagePanePropsForRender = {
    ...messagePaneProps,
    scrollerRef: scrollerDivRef,
    bottomRef: bottomDivRef,
  };

  const { composerSectionProps } = useChatClientViewComposerSectionProps({
    guestMode,
    workspaceMode,
    uiLang,
    uiForComposer,
    loading,
    threadBusy,
    threads,
    activeThreadId,
    input,
    setInput: setInputForComposer,
    inputRef,
    composerRef,
    composing,
    canSendNow: Boolean(canSend),
    lastFailed,
    retryLastFailed,
    isMobile,
    sendLabel: uiLang === "en" ? "Send" : "送信",
    armFocusGuard,
    runFocusGuard,
    onComposerFocusScrollBottom: stickToBottomNow,
    trySend: () => {
      try {
        const r = sendMessage(normalizedInput);
        if (r && typeof (r as any).catch === "function") {
          (r as any).catch(() => {});
        }
      } catch {}
    },
    tryGuestAction: () => {
      try {
        const r = sendMessage(normalizedInput);
        if (r && typeof (r as any).catch === "function") {
          (r as any).catch(() => {});
        }
      } catch {}
    },
  });

  const ChatOverlaysAny = ChatOverlays as any;

  return (
    <main
      ref={rootRef}
      className={styles.root}
      style={rootInlineStyle}
      onTouchStart={(e) => {
        onRailSwipeOpenTouchStart(e);
        onLeftRailOpeningDragTouchStart?.(e);
      }}
      onTouchMove={(e) => {
        onLeftRailOpeningDragTouchMove?.(e);
      }}
      onTouchEnd={(e) => {
        onRailSwipeOpenTouchEnd(e);
        onLeftRailOpeningDragTouchEnd?.();

        if (shouldOpenLeftRailByDrag) {
          onOpenRail();
        }
      }}
    >
      <ChatOverlaysAny
        guestMode={guestMode}
        railOpen={railOpen}
        memOpen={memOpen}
        uiLang={uiLang}
        ui={ui}
        userState={userState}
        userStateErr={userStateErr}
        threads={threads}
        activeThreadId={activeThreadId}
        activeThread={activeThread ?? null}
        activeThreadState={activeThreadState ?? null}
        disableNewChat={disableNewChat}
        onCloseMem={() => setMemOpen(false)}
        onOpenMemories={() => setMemOpen(true)}
        onCloseRail={onCloseRail}
        onSelectThread={onSelectThread}
        onCreateThread={onCreateThread}
        onRenameThread={onRenameThread}
        onDeleteThread={onDeleteThread}
        isLeftRailOpeningDrag={isLeftRailOpeningDrag}
        leftRailOpeningStyle={leftRailOpeningStyle}
        leftRailOpeningBackdropStyle={leftRailOpeningBackdropStyle}
      />

      <ChatLayout
        guestMode={guestMode}
        uiLang={uiLang}
        email={email}
        railOpen={railOpen}
        onToggleRail={railOpen ? onCloseRail : onOpenRail}
        onChangeLang={onChangeLang}
      >
        <ChatMessagePane {...messagePanePropsForRender} />
        <ChatComposerSection {...composerSectionProps} />
      </ChatLayout>
    </main>
  );
}

/*
【このファイルの正式役割】
Chat画面の親表示統合ファイル。
親は、全体レイアウトに必要な上位状態と中継ハンドラを束ね、
子へ渡すことに専念する。
このファイルは状態や Compass を再判定する場所ではなく、
本文採用の唯一の正を作る場所でもなく、
子コンポーネントへ必要な値を渡す親責務だけを持つ。

【今回このファイルで修正したこと】
- ChatClient.tsx から渡される futureChainDisplay を props として受け取れるようにした。
- futureChainDisplay.plan を優先して Future Chain 表示用 plan を正規化する処理を追加した。
- futureChainDisplay.plan がない場合のみ、userState.plan を表示用 plan として正規化する fallback を追加した。
- futureChainDisplay と futureChainPlan を useChatClientViewMessagePaneProps(...) へ渡すようにした。
- このファイルでは Future Chain の表示可否、保存可否、handoffMessageSnapshot生成、recipient_support検索、delivery_event保存、state_changed、state_level、Compass、HOPY回答○、DB保存、MEMORIES、DASHBOARD は再判定していない。

/components/chat/ChatClientView.tsx
*/