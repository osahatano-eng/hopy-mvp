// /components/chat/ChatClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import type { ChatMsg, Thread } from "./lib/chatTypes";
import { clampText, detectUserLang } from "./lib/text";
import { useAutoGrowTextarea, usePreventHorizontalScroll } from "./lib/hooks";

import ChatClientView from "./ChatClientView";

import { useChatInit } from "./lib/useChatInit";
import { useThreadSwitch } from "./lib/useThreadSwitch";
import { useTranslateCache } from "./lib/useTranslateCache";
import { useChatSend, type FailedSend } from "./lib/useChatSend";
import { loadMessages } from "./lib/threadApi";
import type { ChatSendFutureChainPersist } from "./lib/chatSendRequestExecution";

import { normalizeHopyState, type HopyState } from "./lib/stateBadge";
import {
  cleanForDecision,
  initHopyApiDebugTools,
  initHopyImeDebugTools,
} from "./lib/debugTools";
import { useImeStabilizer } from "./lib/useImeStabilizer";
import { buildThinkingLabel, buildUi } from "./lib/chatClientUi";
import { useChatAuth } from "./lib/useChatAuth";
import { useChatClientLanguage } from "./lib/useChatClientLanguage";
import { useChatClientSignedOutFlow } from "./lib/useChatClientSignedOutFlow";
import { useChatClientViewportVars } from "./lib/useChatClientViewportVars";
import { useChatThreadEvents } from "./lib/useChatThreadEvents";
import { useChatClientViewState } from "./lib/useChatClientViewState";
import { useChatThreadCreation } from "./lib/useChatThreadCreation";
import { useChatClientBootScroll } from "./lib/useChatClientBootScroll";
import { isTemporaryGuestThreadId } from "./lib/chatThreadIdentity";
import { useLeftRailSwipeOpen } from "./view/hooks/useLeftRailSwipeOpen";
import { useLeftRailOpeningDrag } from "./view/hooks/useLeftRailOpeningDrag";
import { resolveActiveThreadStateForView } from "./view/resolveActiveThreadStateForView";
import { useBroadcastUserStateLabel } from "./view/useBroadcastUserStateLabel";
import { resolveMergedUserStateForView } from "./view/resolveMergedUserStateForView";

const EMPTY_THREADS: Thread[] = [];
const PC_RAIL_MEDIA_QUERY = "(min-width: 1024px)";

export default function ChatClient() {
  usePreventHorizontalScroll(true);

  useEffect(() => {
    initHopyApiDebugTools();
    initHopyImeDebugTools();
  }, []);

  const [email, setEmail] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);

  const { uiLang, onChangeLang } = useChatClientLanguage();

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);

  const [visibleCount, setVisibleCount] = useState(200);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadIdState, setActiveThreadIdState] = useState<string | null>(null);
  const [threadBusy, setThreadBusy] = useState(false);

  const [memOpen, setMemOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  const [lastFailed, setLastFailed] = useState<FailedSend | null>(null);
  const [futureChainPersist, setFutureChainPersist] =
    useState<ChatSendFutureChainPersist | null>(null);

  const [userState, setUserState] = useState<HopyState | null>(null);
  const [userStateErr, setUserStateErr] = useState<string | null>(null);

  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);

  const activeThreadIdRef = useRef<string | null>(null);

  const setActiveThreadId = useCallback<
    React.Dispatch<React.SetStateAction<string | null>>
  >((updater) => {
    setActiveThreadIdState((prev) => {
      const rawNext =
        typeof updater === "function"
          ? (updater as (prevState: string | null) => string | null)(prev)
          : updater;

      const nextId = String(rawNext ?? "").trim() || null;
      activeThreadIdRef.current = nextId;
      return nextId;
    });
  }, []);

  const activeThreadId = activeThreadIdState;

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior | "auto" | "smooth" = "auto") => {
      atBottomRef.current = true;
      setAtBottom(true);

      try {
        const sc = scrollerRef.current;
        if (!sc) return;

        if (behavior === "smooth") {
          sc.scrollTo({ top: sc.scrollHeight, behavior: "smooth" });
        } else {
          sc.scrollTop = sc.scrollHeight;
        }
      } catch {}
    },
    [],
  );

  const openRail = useCallback(() => {
    setRailOpen(true);
  }, []);

  const closeRail = useCallback(() => {
    setRailOpen(false);
  }, []);

  const {
    handleLeftRailSwipeOpenTouchStart,
    handleLeftRailSwipeOpenTouchEnd,
  } = useLeftRailSwipeOpen({
    railOpen,
    onOpenRail: openRail,
  });

  const {
    isLeftRailOpeningDrag,
    shouldOpenByDrag,
    leftRailOpeningStyle,
    leftRailOpeningBackdropStyle,
    handleOpeningDragTouchStart,
    handleOpeningDragTouchMove,
    handleOpeningDragTouchEnd,
    resetOpeningDrag,
  } = useLeftRailOpeningDrag({
    railOpen,
    enabled: true,
  });

  const resetRailState = useCallback(() => {
    setMemOpen(false);
    setRailOpen(false);
    resetOpeningDrag();
  }, [resetOpeningDrag]);

  const guardedSetMessages = useCallback<
    React.Dispatch<React.SetStateAction<ChatMsg[]>>
  >((updater) => {
    setMessages((prev) => {
      try {
        const next =
          typeof updater === "function"
            ? (updater as (prevState: ChatMsg[]) => ChatMsg[])(prev)
            : updater;
        return Array.isArray(next) ? next : prev;
      } catch {
        return prev;
      }
    });
  }, []);

  const auth = useChatAuth({
    supabase,
    setEmail,
  });

  const {
    authReady,
    logoutRedirecting,
    signedOutCauseRef,
    loggedIn,
    displayLoggedIn,
  } = auth;

  const { shouldHoldSignedOutScreen } = useChatClientSignedOutFlow({
    authReady,
    displayLoggedIn,
    loggedIn,
    logoutRedirecting,
    signedOutCauseRef,
    activeThreadId,
    activeThreadIdRef,
    resetRailState,
    setEmail,
    setMessages: guardedSetMessages,
    setLoading,
    setVisibleCount,
    setThreads,
    setActiveThreadId,
    setThreadBusy,
    setLastFailed,
    setUserState,
    setUserStateErr,
  });

  const [viewLoggedIn, setViewLoggedIn] = useState(false);
  const viewLoggedInRef = useRef(false);

  useEffect(() => {
    setViewLoggedIn((prev) => {
      if (displayLoggedIn) return true;
      if (shouldHoldSignedOutScreen) return false;
      if (!authReady) return prev;
      return prev;
    });
  }, [authReady, displayLoggedIn, shouldHoldSignedOutScreen]);

  useEffect(() => {
    viewLoggedInRef.current = viewLoggedIn;
  }, [viewLoggedIn]);

  useEffect(() => {
    if (!viewLoggedIn) {
      setRailOpen(false);
      return;
    }

    try {
      if (typeof window === "undefined") return;
      if (typeof window.matchMedia !== "function") {
        setRailOpen(false);
        return;
      }

      const mediaQuery = window.matchMedia(PC_RAIL_MEDIA_QUERY);

      const syncRailByViewport = () => {
        setRailOpen(mediaQuery.matches);
      };

      syncRailByViewport();

      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", syncRailByViewport);
        return () => {
          mediaQuery.removeEventListener("change", syncRailByViewport);
        };
      }

      if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(syncRailByViewport);
        return () => {
          mediaQuery.removeListener(syncRailByViewport);
        };
      }
    } catch {}

    return;
  }, [viewLoggedIn]);

  useChatThreadEvents({
    supabase,
    uiLang,
    loggedInRef: viewLoggedInRef,
    threads,
    setThreads,
    activeThreadIdRef,
    setActiveThreadId,
    setThreadBusy,
    setUserStateErr,
  });

  const { composing, composingRef } = useImeStabilizer({
    inputRef,
    input,
    setInput,
    uiLang,
  });

  useAutoGrowTextarea(
    inputRef as React.RefObject<HTMLTextAreaElement>,
    input,
    420,
  );

  useChatClientViewportVars({
    rootRef,
    composerRef,
    composerHeightFallback: 96,
  });

  const { tmap } = useTranslateCache({ uiLang, messages });

  const thinkingLabel = useMemo(
    () => buildThinkingLabel(uiLang, normalizeHopyState(userState)),
    [uiLang, userState],
  );

  const ui = useMemo(() => buildUi(uiLang, thinkingLabel), [uiLang, thinkingLabel]);
  const viewUi = useMemo(() => buildUi(uiLang, ""), [uiLang]);

  useChatInit<HopyState>({
    supabase,
    uiLang,
    setEmail,
    setMessages: guardedSetMessages,
    setThreads,
    setActiveThreadId,
    setVisibleCount,
    setLastFailed,
    setUserState,
    setUserStateErr,
    normalizeState: normalizeHopyState,
    scrollToBottom,
    inputRef,
  });

  useThreadSwitch({
    supabase,
    activeThreadId,
    setActiveThreadId,
    setThreadBusy,
    setMessages: guardedSetMessages,
    setLastFailed,
    setUserStateErr,
  });

  const normalizedInput = cleanForDecision(input);

  const { ensureThreadId, onThreadIdResolved } = useChatThreadCreation({
    displayLoggedIn: viewLoggedIn,
    activeThreadIdRef,
    setThreadBusy,
    setUserStateErr,
    setActiveThreadId,
    setVisibleCount,
  });

  const handleThreadRenamed = useCallback((payload: unknown) => {
    const safe = (payload ?? {}) as Record<string, unknown>;

    const renamedThreadId = String(
      safe.threadId ?? safe.thread_id ?? safe.id ?? activeThreadIdRef.current ?? "",
    ).trim();

    const renamedTitle = String(
      safe.title ?? safe.nextTitle ?? safe.newTitle ?? safe.name ?? "",
    ).trim();

    if (!renamedThreadId || !renamedTitle) return;

    setThreads((prev) => {
      let changed = false;

      const next = prev.map((thread) => {
        const threadSafe = thread as unknown as Record<string, unknown>;
        const threadId = String(
          threadSafe.id ?? threadSafe.threadId ?? threadSafe.thread_id ?? "",
        ).trim();

        if (threadId !== renamedThreadId) {
          return thread;
        }

        changed = true;

        return {
          ...thread,
          title: renamedTitle,
        };
      });

      return changed ? next : prev;
    });
  }, []);

  const {
    viewMessages,
    viewRendered,
    viewVisibleTexts,
    viewActiveThread,
    viewUserState,
  } = useChatClientViewState({
    displayLoggedIn: viewLoggedIn,
    activeThreadId,
    threads,
    setThreads,
    messages,
    visibleCount,
    uiLang,
    ui: viewUi,
    tmap,
    userState,
    normalizedInput,
  });

  const { normalizedResolvedViewUserState, mergedUserStateForView } =
    resolveMergedUserStateForView({
      viewUserState,
    });

  const activeThreadKey = String(activeThreadId ?? "").trim();
  const isViewingPendingEmptyThread = isTemporaryGuestThreadId(activeThreadKey);

  const { resolvedActiveThreadForView, resolvedActiveThreadState } =
    resolveActiveThreadStateForView({
      displayLoggedIn: viewLoggedIn,
      isViewingPendingEmptyThread,
      viewActiveThread,
      normalizedResolvedViewUserState,
    });

  useBroadcastUserStateLabel({
    displayLoggedIn: viewLoggedIn,
    resolvedActiveThreadState,
    userStateErr,
    uiLang,
    stateUnknownShort: ui.stateUnknownShort,
  });

  useChatClientBootScroll({
    activeThreadId,
    viewRenderedLength: viewRendered.length,
    scrollToBottom,
    atBottomRef,
    setAtBottom,
  });

  const login = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/signin` },
    });
  }, []);

  const useChatSendAny = useChatSend as any;

  const { sendMessage, retryLastFailed } = useChatSendAny({
    supabase,
    uiLang,
    ui: { loginAlert: ui.loginAlert, emptyReply: ui.emptyReply },
    activeThreadId,
    ensureThreadId,
    onThreadIdResolved,
    onThreadRenamed: handleThreadRenamed,
    onFutureChainPersist: setFutureChainPersist,
    input,
    setInput,
    loading,
    setLoading,
    setMessages: guardedSetMessages,
    setVisibleCount,
    atBottomRef,
    setAtBottom,
    scrollToBottom,
    lastFailed,
    setLastFailed,
    normalizeState: normalizeHopyState,
    setUserState,
    setUserStateErr,
    clampText,
    detectUserLang,
    loadMessages,
    getIsComposing: () => Boolean(composingRef.current),
  });

  const canSendNow = viewLoggedIn
    ? !loading && !threadBusy && Boolean(normalizedInput)
    : !loading && Boolean(normalizedInput);

  const disableNewChat = viewLoggedIn && loading;

  const shouldHoldBlankThreadStage =
    viewLoggedIn && isViewingPendingEmptyThread;

  const canShowMore =
    !shouldHoldBlankThreadStage && viewMessages.length > visibleCount;

  const onShowMore = useCallback(() => {
    setVisibleCount((v) => Math.min(viewMessages.length, v + 200));
  }, [viewMessages.length]);

  if (shouldHoldSignedOutScreen) {
    return (
      <main
        aria-label="signing out"
        style={{
          minHeight: "100dvh",
          width: "100%",
          background: "var(--paper, #ffffff)",
        }}
      />
    );
  }

  const ChatClientViewAny = ChatClientView as any;

  return (
    <ChatClientViewAny
      rootRef={rootRef}
      loggedIn={viewLoggedIn}
      email={viewLoggedIn ? email : ""}
      uiLang={uiLang}
      ui={ui}
      futureChainPersist={futureChainPersist}
      input={input}
      setInput={setInput}
      messages={viewMessages}
      loading={loading}
      threads={viewLoggedIn ? threads : EMPTY_THREADS}
      activeThreadId={viewLoggedIn ? activeThreadKey || null : null}
      activeThread={resolvedActiveThreadForView}
      activeThreadState={
        viewLoggedIn && !isViewingPendingEmptyThread
          ? resolvedActiveThreadState ?? null
          : null
      }
      threadBusy={viewLoggedIn && threadBusy}
      shouldHoldBlankThreadStage={shouldHoldBlankThreadStage}
      memOpen={memOpen}
      setMemOpen={setMemOpen}
      railOpen={railOpen}
      onOpenRail={openRail}
      onCloseRail={closeRail}
      onRailSwipeOpenTouchStart={handleLeftRailSwipeOpenTouchStart}
      onRailSwipeOpenTouchEnd={handleLeftRailSwipeOpenTouchEnd}
      isLeftRailOpeningDrag={isLeftRailOpeningDrag}
      shouldOpenLeftRailByDrag={shouldOpenByDrag}
      leftRailOpeningStyle={leftRailOpeningStyle}
      leftRailOpeningBackdropStyle={leftRailOpeningBackdropStyle}
      onLeftRailOpeningDragTouchStart={handleOpeningDragTouchStart}
      onLeftRailOpeningDragTouchMove={handleOpeningDragTouchMove}
      onLeftRailOpeningDragTouchEnd={handleOpeningDragTouchEnd}
      visibleCount={visibleCount}
      rendered={viewRendered}
      visibleTexts={viewVisibleTexts}
      canShowMore={canShowMore}
      onShowMore={onShowMore}
      scrollerRef={scrollerRef}
      composerRef={composerRef}
      inputRef={inputRef as any}
      atBottom={atBottom}
      setAtBottom={setAtBottom}
      scrollToBottom={scrollToBottom}
      atBottomRef={atBottomRef}
      userState={mergedUserStateForView}
      userStateErr={userStateErr}
      lastFailed={lastFailed}
      retryLastFailed={retryLastFailed}
      login={login}
      sendMessage={sendMessage}
      canSend={canSendNow}
      normalizedInput={normalizedInput}
      composing={composing}
      disableNewChat={disableNewChat}
      onChangeLang={onChangeLang}
    />
  );
}

/*
【このファイルの正式役割】
チャット画面の親本体ファイル。
state / ref / hook 呼び出し / 値の受け渡しをまとめ、
ChatClientView へ表示用の値を接続する。
親は読むだけ・つなぐだけに寄せる。
このファイルは HOPY唯一の正、state_changed、Compass、HOPY回答○、Future Chain保存可否を再判定しない。

【今回このファイルで修正したこと】
- ChatSendFutureChainPersist 型を読み込んだ。
- futureChainPersist state を追加した。
- useChatSend(...) の onFutureChainPersist で Future Chain 保存結果を受け取るようにした。
- ChatClientView へ futureChainPersist を props として渡すようにした。
- Future Chain の保存可否、state_changed、state_level、Compass、HOPY回答○、DB保存、MEMORIES、DASHBOARD は再判定していない。

/components/chat/ChatClient.tsx
*/