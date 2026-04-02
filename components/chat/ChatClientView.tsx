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
import { isTemporaryGuestThreadId } from "./lib/chatThreadIdentity";

type ChatClientViewExtendedProps = ChatClientViewProps & {
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
};

function safeUUID(): string {
  try {
    const g: any = globalThis as any;
    if (g?.crypto && typeof g.crypto.randomUUID === "function") {
      return g.crypto.randomUUID();
    }
  } catch {}
  try {
    return `cr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  } catch {
    return `cr_${Date.now()}`;
  }
}

export default function ChatClientView(props: ChatClientViewExtendedProps) {
  const {
    rootRef,
    loggedIn,
    email,
    uiLang,
    ui,

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

    login,
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
  } = props;

  const disableNewChat = Boolean(disableNewChatProp);

  const surface = useChatClientViewSurface({
    uiLang,
    ui,
    loggedIn,
    messagesLength: messages.length,
    renderedLength: rendered.length,
    activeThreadId,
    userState,
    userStateErr,
    lastFailed,
    normalizedInput,
    loading,
    threadBusy,
  });

  const {
    workspaceMode,
    guestMode,
    busy,
    dismissWorkspaceHero,
    setWorkspaceHeroDismissed,
    uiForComposer,
    labels,
    guestCopy,
    shouldHoldBlankThreadStage,
    shouldShowWorkspaceHero,
    shouldShowGuestHero,
    shouldShowPreparing,
    showRecoverUi,
    showStuckUi,
    overlayUserState,
  } = surface;

  void overlayUserState;

  const resolvedOverlayActiveThread = React.useMemo(() => {
    return activeThread ?? null;
  }, [activeThread]);

  const loggedInRef = React.useRef(false);
  const busyRef = React.useRef(false);
  const threadsRef = React.useRef<any[]>([]);
  const disableNewChatRef = React.useRef(false);
  const activeThreadIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    loggedInRef.current = Boolean(workspaceMode);
    busyRef.current = Boolean(busy);
    threadsRef.current = Array.isArray(threads) ? threads : [];
    disableNewChatRef.current = Boolean(disableNewChat);
    activeThreadIdRef.current = String(activeThreadId ?? "").trim() || null;
  }, [workspaceMode, busy, threads, disableNewChat, activeThreadId]);

  useVisualViewportVars();
  useComposerOffset({ rootRef, composerRef, extraPx: 18 });

  const viewportRenderedLength = React.useMemo(() => {
    if (loading) return messages.length;
    return rendered.length;
  }, [loading, messages.length, rendered.length]);

  const viewport = useChatViewportController({
    workspaceMode,
    activeThreadId,
    renderedLength: viewportRenderedLength,
    inputRef,
    scrollerRef,
    atBottomRef,
    setAtBottom,
    scrollToBottom,
    dismissWorkspaceHero,
  });

  const {
    isMobile,
    isInputFocused,
    bottomRef,
    armFocusGuard,
    runFocusGuard,
    stickToBottomNow,
    scrollComposerAreaToBottom,
    onJumpToBottom,
  } = viewport;

  React.useEffect(() => {
    if (!workspaceMode) return;
    if (isInputFocused) setWorkspaceHeroDismissed(true);
  }, [workspaceMode, isInputFocused, setWorkspaceHeroDismissed]);

  React.useEffect(() => {
    if (!workspaceMode) return;
    if (isMobile) return;
    onOpenRail();
  }, [workspaceMode, isMobile, onOpenRail]);

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

  const doReload = React.useCallback(() => {
    try {
      location.reload();
    } catch {}
  }, []);

  const sendLabel = busy ? ui.sending : uiLang === "en" ? "Send" : "送信";

  const canSendNow = Boolean(canSend) && !busy && !composing;
  const canSendGuestNow = Boolean(canSend) && !busy && !composing;

  const executeSend = React.useCallback(
    (shouldDismissHero: boolean, allowSend: boolean) => {
      if (shouldDismissHero) dismissWorkspaceHero();
      if (composing) return;
      if (!allowSend) return;

      try {
        const r = sendMessage(normalizedInput);
        if (r && typeof (r as any).catch === "function") (r as any).catch(() => {});
      } catch {}

      if (isMobile) {
        try {
          inputRef.current?.blur();
        } catch {}
      }

      scrollComposerAreaToBottom();
    },
    [
      dismissWorkspaceHero,
      composing,
      sendMessage,
      normalizedInput,
      isMobile,
      inputRef,
      scrollComposerAreaToBottom,
    ],
  );

  const trySend = React.useCallback(() => {
    executeSend(true, canSendNow);
  }, [executeSend, canSendNow]);

  const tryGuestAction = React.useCallback(() => {
    executeSend(false, canSendGuestNow);
  }, [executeSend, canSendGuestNow]);

  const shouldShowJump = React.useMemo(() => !busy && !atBottom, [busy, atBottom]);

  const onToggleRail = React.useCallback(() => {
    if (railOpen) {
      onCloseRail();
      return;
    }
    onOpenRail();
  }, [railOpen, onCloseRail, onOpenRail]);

  const closeRailForViewport = React.useCallback(() => {
    if (!isMobile) return;

    try {
      requestAnimationFrame(() => onCloseRail());
      return;
    } catch {}

    try {
      setTimeout(() => onCloseRail(), 0);
      return;
    } catch {}

    onCloseRail();
  }, [isMobile, onCloseRail]);

  const onSelectThread = React.useCallback(
    (threadId: string) => {
      const id = String(threadId ?? "").trim();
      if (!id) return;

      const selectedThread = Array.isArray(threadsRef.current)
        ? threadsRef.current.find((t) => String((t as any)?.id ?? "").trim() === id) ?? null
        : null;

      const selectedTitle = String((selectedThread as any)?.title ?? "").trim();

      try {
        window.dispatchEvent(
          new CustomEvent("hopy:select-thread", {
            detail: {
              threadId: id,
              id,
              selectedThreadId: id,
              selectedTitle: selectedTitle || undefined,
              reason: "ui:view",
              source: "direct",
            },
          }),
        );
      } catch {}

      closeRailForViewport();
    },
    [closeRailForViewport],
  );

  const createThreadGuardRef = React.useRef(0);
  const createOpRef = React.useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const CREATE_REQ_REUSE_MS = 500;

  const onCreateThread = React.useCallback(
    (opts?: { clientRequestId: string }) => {
      if (typeof window === "undefined") return;
      if (!loggedInRef.current) return;
      if (busyRef.current) return;

      const currentActiveId = String(activeThreadIdRef.current ?? "").trim();

      if (currentActiveId && isTemporaryGuestThreadId(currentActiveId)) {
        try {
          window.dispatchEvent(
            new CustomEvent("hopy:workspace-clear", {
              detail: {
                reason: "ui:return-pending-thread",
                threadId: currentActiveId,
                id: currentActiveId,
                source: "direct",
              },
            }),
          );
        } catch {}

        try {
          window.dispatchEvent(
            new CustomEvent("hopy:select-thread", {
              detail: {
                threadId: currentActiveId,
                id: currentActiveId,
                selectedThreadId: currentActiveId,
                reason: "ui:return-pending-thread",
                source: "direct",
              },
            }),
          );
        } catch {}

        closeRailForViewport();
        return;
      }

      if (disableNewChatRef.current) {
        closeRailForViewport();
        return;
      }

      const now = Date.now();

      if (now - createThreadGuardRef.current < 120) return;
      createThreadGuardRef.current = now;

      const incoming = String(opts?.clientRequestId ?? "").trim();
      const prev = createOpRef.current;

      const reusePrev =
        !incoming && Boolean(prev.id) && now - (prev.at || 0) >= 0 && now - (prev.at || 0) <= CREATE_REQ_REUSE_MS;

      const clientRequestId = incoming || (reusePrev ? prev.id : safeUUID());
      createOpRef.current = { id: clientRequestId, at: now };

      setWorkspaceHeroDismissed(false);

      try {
        window.dispatchEvent(
          new CustomEvent("hopy:workspace-clear", {
            detail: {
              reason: "ui:create-thread",
              source: "direct",
              clientRequestId,
            },
          }),
        );
      } catch {}

      try {
        window.dispatchEvent(
          new CustomEvent("hopy:create-thread", {
            detail: { reason: "ui", source: "direct", clientRequestId },
          }),
        );
      } catch {}

      closeRailForViewport();
    },
    [closeRailForViewport, setWorkspaceHeroDismissed],
  );

  const onRenameThread = React.useCallback(
    (threadId: string, nextTitle: string) => {
      if (typeof window === "undefined") return;
      if (!loggedInRef.current) return;
      if (!busyRef.current && !String(threadId ?? "").trim()) return;
      if (busyRef.current) return;

      const id = String(threadId ?? "").trim();
      const title = String(nextTitle ?? "").trim();
      if (!id) return;
      if (!title) return;

      let prevTitle = "";
      try {
        const arr = threadsRef.current;
        prevTitle = String(arr.find((t) => String((t as any)?.id ?? "").trim() === id)?.title ?? "").trim() || "";
      } catch {}

      if (prevTitle && prevTitle === title) {
        closeRailForViewport();
        return;
      }

      let updated_at = "";
      try {
        updated_at = new Date().toISOString();
      } catch {}

      try {
        window.dispatchEvent(
          new CustomEvent("hopy:threads-refresh", {
            detail: {
              reason: "rename:optimistic",
              id,
              threadId: id,
              title,
              updated_at,
              prevTitle,
              previousTitle: prevTitle,
              prev_title: prevTitle,
              previous_title: prevTitle,
              source: "direct",
            },
          }),
        );
      } catch {}

      try {
        window.dispatchEvent(
          new CustomEvent("hopy:rename-thread", {
            detail: {
              reason: "ui",
              threadId: id,
              id,
              title,
              prevTitle,
              previousTitle: prevTitle,
              prev_title: prevTitle,
              previous_title: prevTitle,
              source: "direct",
            },
          }),
        );
      } catch {}

      closeRailForViewport();
    },
    [closeRailForViewport],
  );

  const onDeleteThread = React.useCallback(
    (threadId: string) => {
      if (typeof window === "undefined") return;
      if (!loggedInRef.current) return;
      if (busyRef.current) return;

      const id = String(threadId ?? "").trim();
      if (!id) return;

      let prevTitle = "";
      try {
        const arr = threadsRef.current;
        prevTitle = String(
          arr.find((t) => String((t as any)?.id ?? "").trim() === id)?.title ?? "",
        ).trim();
      } catch {}

      try {
        window.dispatchEvent(
          new CustomEvent("hopy:delete-thread", {
            detail: {
              reason: "ui",
              threadId: id,
              id,
              prevTitle: prevTitle || undefined,
              previousTitle: prevTitle || undefined,
              prev_title: prevTitle || undefined,
              previous_title: prevTitle || undefined,
              source: "direct",
            },
          }),
        );
      } catch {}

      closeRailForViewport();
    },
    [closeRailForViewport],
  );

  const shouldHideHeader = false;

  const topInset = React.useMemo(() => {
    const chatHeaderInset = "calc(48px + env(safe-area-inset-top))";
    return isMobile ? chatHeaderInset : "0px";
  }, [isMobile]);

  const headerWrapperStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!shouldHideHeader) return undefined;
    return {
      opacity: 0,
      visibility: "hidden",
      pointerEvents: "none",
    };
  }, [shouldHideHeader]);

  const onCloseMem = React.useCallback(() => setMemOpen(false), [setMemOpen]);
  const onOpenMemories = React.useCallback(() => setMemOpen(true), [setMemOpen]);

  const onComposerFocusScrollBottom = React.useCallback(() => {
    if (isMobile) return;
    stickToBottomNow();
  }, [isMobile, stickToBottomNow]);

  const messagePaneProps = React.useMemo(
    () => ({
      guestMode,
      workspaceMode,
      uiLang,
      ui,
      labels,
      guestCopy,
      topInset,
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
      onReload: doReload,
      onResetAndReload: doReload,
      login,
      shouldShowJump,
      jumpAria: ui.jumpAria,
      onJumpToBottom,
    }),
    [
      guestMode,
      workspaceMode,
      uiLang,
      ui,
      labels,
      guestCopy,
      topInset,
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
      doReload,
      login,
      shouldShowJump,
      onJumpToBottom,
    ],
  );

  const composerSectionProps = React.useMemo(
    () => ({
      guestMode,
      workspaceMode,
      uiLang,
      ui: uiForComposer,
      loading,
      threadBusy,
      threads,
      activeThreadId,
      input,
      setInput,
      inputRef,
      composerRef,
      composing,
      canSendNow,
      canSendGuestNow,
      lastFailed,
      retryLastFailed,
      guestSoftWarn: "",
      isMobile,
      sendLabel,
      onArmFocusGuard: armFocusGuard,
      onRunFocusGuard: runFocusGuard,
      onFocusScrollBottom: onComposerFocusScrollBottom,
      onTrySend: trySend,
      onTryGuestAction: tryGuestAction,
    }),
    [
      guestMode,
      workspaceMode,
      uiLang,
      uiForComposer,
      loading,
      threadBusy,
      threads,
      activeThreadId,
      input,
      setInput,
      inputRef,
      composerRef,
      composing,
      canSendNow,
      canSendGuestNow,
      lastFailed,
      retryLastFailed,
      isMobile,
      sendLabel,
      armFocusGuard,
      runFocusGuard,
      onComposerFocusScrollBottom,
      trySend,
      tryGuestAction,
    ],
  );

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
        activeThread={resolvedOverlayActiveThread}
        activeThreadState={activeThreadState ?? null}
        disableNewChat={disableNewChat}
        onCloseMem={onCloseMem}
        onOpenMemories={onOpenMemories}
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
        onToggleRail={onToggleRail}
        onChangeLang={onChangeLang}
        headerWrapperStyle={headerWrapperStyle}
      >
        <ChatMessagePane {...messagePaneProps} />
        <ChatComposerSection {...composerSectionProps} />
      </ChatLayout>
    </main>
  );
}

/*
このファイルの正式役割:
Chat画面の表示統合ファイル。
レイアウト、オーバーレイ、メッセージ表示、コンポーザー表示を束ね、
各 hook や子コンポーネントへ、すでに確定した値を渡す。
このファイルは状態や Compass を再判定する場所ではなく、
受け取った確定値を UI に中継する責務だけを持つ。
*/

/*
【今回このファイルで修正したこと】
1. SPで入力欄focus時に下方向スクロール補正が走らないように、onFocusScrollBottom をモバイル時だけ止めました。
2. HOPY唯一の正、state 1..5、Compass、threads、messages、auth、left rail の挙動は触っていません。
*/