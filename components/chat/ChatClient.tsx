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

import { normalizeHopyState, type HopyState } from "./lib/stateBadge";
import { clearActiveThreadId } from "./lib/threadStore";
import {
  isCompletedAssistantReplyMessage,
  resolveMessagesOwnerThreadId,
} from "./lib/chatClientMessageMeta";

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

type ThreadDecision = { id: string; at: number; reason: string };

const EMPTY_THREADS: Thread[] = [];

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
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadBusy, setThreadBusy] = useState(false);

  const [memOpen, setMemOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  const [lastFailed, setLastFailed] = useState<FailedSend | null>(null);

  const [userState, setUserState] = useState<HopyState | null>(null);
  const [userStateErr, setUserStateErr] = useState<string | null>(null);

  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);

  const pendingEmptyThreadIdRef = useRef<string | null>(null);
  const lastThreadDecisionRef = useRef<ThreadDecision | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);

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
    []
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

  const clearThreadViewRefs = useCallback(() => {
    pendingEmptyThreadIdRef.current = null;
  }, []);

  const resetRailState = useCallback(() => {
    setMemOpen(false);
    setRailOpen(false);
    resetOpeningDrag();
  }, [resetOpeningDrag]);

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
    loggedInRef,
  } = auth;

  const { shouldHoldSignedOutScreen } = useChatClientSignedOutFlow({
    authReady,
    displayLoggedIn,
    loggedIn,
    logoutRedirecting,
    signedOutCauseRef,
    activeThreadId,
    activeThreadIdRef,
    clearThreadViewRefs,
    resetRailState,
    setEmail,
    setMessages,
    setLoading,
    setVisibleCount,
    setThreads,
    setActiveThreadId,
    setThreadBusy,
    setLastFailed,
    setUserState,
    setUserStateErr,
  });

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;

    const tid = String(activeThreadId ?? "").trim();
    if (!tid) return;

    if (isTemporaryGuestThreadId(tid)) {
      pendingEmptyThreadIdRef.current = tid;
    }
  }, [activeThreadId]);

  const messagesRef = useRef<ChatMsg[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const currentMessagesOwnerThreadId = useMemo(() => {
    return resolveMessagesOwnerThreadId(messages);
  }, [messages]);

  useEffect(() => {
    if (!loading) return;
    if (messages.length <= 0) return;

    const lastMessage = messages[messages.length - 1];
    if (!isCompletedAssistantReplyMessage(lastMessage)) return;

    try {
      setLoading(false);
    } catch {}
  }, [loading, messages]);

  const noteThreadDecision = useCallback((tid: string, reason: string) => {
    lastThreadDecisionRef.current = { id: tid, at: Date.now(), reason };
  }, []);

  const mergeThreadTitle = useCallback((threadId: string, nextTitle: string) => {
    setThreads((prev) => {
      const tid = String(threadId ?? "").trim();
      if (!tid) return prev;

      const nt = String(nextTitle ?? "").trim();
      if (!nt) return prev;

      let found = false;
      let changed = false;

      const next = prev.map((t) => {
        const id = String((t as any)?.id ?? "").trim();
        if (id !== tid) return t;

        found = true;
        const prevTitle = String((t as any)?.title ?? "").trim();
        if (prevTitle === nt) return t;

        changed = true;
        return { ...(t as any), title: nt } as Thread;
      });

      if (!found) {
        return [{ id: tid, title: nt } as Thread, ...prev];
      }
      return changed ? next : prev;
    });
  }, []);

  const handleThreadRenamed = useCallback(
    (th: any) => {
      try {
        const tid = String((th as any)?.id ?? "").trim();
        const ttl = String((th as any)?.title ?? "").trim();
        if (!tid || !ttl) return;
        mergeThreadTitle(tid, ttl);
      } catch {}
    },
    [mergeThreadTitle]
  );

  const ensureThreadExists = useCallback(
    (threadId: string) => {
      const tid = String(threadId ?? "").trim();
      if (!tid) return;
      if (isTemporaryGuestThreadId(tid)) return;

      const defaultTitle = uiLang === "en" ? "New chat" : "新規チャット";
      setThreads((prev) => {
        const exists = prev.some((t) => String((t as any)?.id ?? "").trim() === tid);
        if (exists) return prev;
        return [
          { id: tid, title: defaultTitle, state_level: 1, current_phase: 1 } as Thread,
          ...prev,
        ];
      });
    },
    [uiLang]
  );

  useChatThreadEvents({
    supabase,
    uiLang,
    loggedInRef,
    threads,
    setThreads,
    activeThreadIdRef,
    setActiveThreadId,
    setMessages,
    setVisibleCount,
    setThreadBusy,
    setUserStateErr,
    noteThreadDecision,
  });

  const { composing, composingRef, imeTick } = useImeStabilizer({
    inputRef,
    input,
    setInput,
    uiLang,
  });
  void imeTick;

  useAutoGrowTextarea(inputRef as React.RefObject<HTMLTextAreaElement>, input, 420);

  useChatClientViewportVars({
    rootRef,
    composerRef,
    composerHeightFallback: 96,
  });

  const { tmap } = useTranslateCache({ uiLang, messages });

  const normalizedViewUserState = useMemo(() => {
    return normalizeHopyState(userState);
  }, [userState]);

  const thinkingLabel = useMemo(() => {
    return buildThinkingLabel(uiLang, normalizedViewUserState);
  }, [uiLang, normalizedViewUserState]);

  const ui = useMemo(() => {
    return buildUi(uiLang, thinkingLabel);
  }, [uiLang, thinkingLabel]);

  const viewUi = useMemo(() => {
    return buildUi(uiLang, "");
  }, [uiLang]);

  const stateUnknownShort = ui.stateUnknownShort;

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

  const applyResolvedActiveThreadId = useCallback(
    (nextId: string | null, reason: string) => {
      const tid = String(nextId ?? "").trim();

      if (!tid) {
        try {
          clearActiveThreadId();
        } catch {}

        try {
          activeThreadIdRef.current = null;
        } catch {}

        try {
          clearThreadViewRefs();
        } catch {}

        try {
          guardedSetMessages([]);
        } catch {}

        try {
          setVisibleCount(200);
        } catch {}

        try {
          noteThreadDecision("", reason);
        } catch {}

        setActiveThreadId(null);
        return;
      }

      if (isTemporaryGuestThreadId(tid)) {
        pendingEmptyThreadIdRef.current = tid;
        setActiveThreadId(tid);
        return;
      }

      try {
        noteThreadDecision(tid, reason);
      } catch {}

      setActiveThreadId(tid);
    },
    [clearThreadViewRefs, guardedSetMessages, noteThreadDecision]
  );

  const setActiveThreadIdFromInit = useCallback(
    (v: string | null) => {
      applyResolvedActiveThreadId(v, "useChatInit:setActiveThreadId");
    },
    [applyResolvedActiveThreadId]
  );

  useChatInit<HopyState>({
    supabase,
    uiLang,
    setEmail,
    setMessages: guardedSetMessages,
    setThreads,
    setActiveThreadId: setActiveThreadIdFromInit,
    setVisibleCount,
    setLastFailed,
    setUserState,
    setUserStateErr,
    normalizeState: normalizeHopyState,
    scrollToBottom,
    inputRef,
  });

  const setActiveThreadIdFromSwitch = useCallback(
    (v: string | null) => {
      applyResolvedActiveThreadId(v, "useThreadSwitch:setActiveThreadId");
    },
    [applyResolvedActiveThreadId]
  );

  useThreadSwitch({
    supabase,
    activeThreadId,
    setActiveThreadId: setActiveThreadIdFromSwitch,
    setThreadBusy,
    setMessages: guardedSetMessages,
    setVisibleCount,
    scrollToBottom,
    threads,
    setLastFailed,
    inputRef,
    setUserStateErr,
  });

  const normalizedInput = cleanForDecision(input);

  const setActiveThreadIdFromThreadCreation = useCallback(
    (v: string | null) => {
      applyResolvedActiveThreadId(v, "useChatThreadCreation:setActiveThreadId");
    },
    [applyResolvedActiveThreadId]
  );

  const { ensureThreadId, onThreadIdResolved } = useChatThreadCreation({
    displayLoggedIn,
    activeThreadIdRef,
    messagesRef,
    setThreadBusy,
    setUserStateErr,
    ensureThreadExists,
    noteThreadDecision,
    guardedSetMessages,
    supabase,
    scrollToBottom,
    setActiveThreadId: setActiveThreadIdFromThreadCreation,
    setVisibleCount,
  });

  const messagesForView = useMemo(() => {
    if (!displayLoggedIn) return messages;

    const activeTid = String(activeThreadId ?? "").trim();
    if (!activeTid) return [];

    const ownerTid = String(currentMessagesOwnerThreadId ?? "").trim();

    if (isTemporaryGuestThreadId(activeTid)) {
      if (ownerTid === activeTid) {
        return messages;
      }

      if (!ownerTid && loading && messages.length > 0) {
        return messages;
      }

      return [];
    }

    if (!ownerTid || ownerTid === activeTid) {
      return messages;
    }

    return [];
  }, [
    displayLoggedIn,
    activeThreadId,
    messages,
    currentMessagesOwnerThreadId,
    loading,
  ]);

  const {
    viewMessages,
    viewRendered,
    viewVisibleTexts,
    viewActiveThread,
    activeThreadStateLevel,
    viewUserState,
  } = useChatClientViewState({
    displayLoggedIn,
    activeThreadId,
    threads,
    setThreads,
    messages: messagesForView,
    visibleCount,
    uiLang,
    ui: viewUi,
    tmap,
    userState,
    normalizedInput,
  });

  void activeThreadStateLevel;

  const { normalizedResolvedViewUserState, mergedUserStateForView } =
    resolveMergedUserStateForView({
      viewUserState,
    });

  const isViewingPendingEmptyThread = isTemporaryGuestThreadId(
    String(activeThreadId ?? "").trim()
  );

  const { resolvedActiveThreadForView, resolvedActiveThreadState } =
    resolveActiveThreadStateForView({
      displayLoggedIn,
      isViewingPendingEmptyThread,
      viewActiveThread,
      normalizedResolvedViewUserState,
    });

  useBroadcastUserStateLabel({
    displayLoggedIn,
    resolvedActiveThreadState,
    userStateErr,
    uiLang,
    stateUnknownShort,
  });

  useEffect(() => {
    const activeTid = String(activeThreadId ?? "").trim();
    if (activeTid && !isTemporaryGuestThreadId(activeTid)) {
      const pendingTid = String(pendingEmptyThreadIdRef.current ?? "").trim();
      if (pendingTid && pendingTid === activeTid) {
        pendingEmptyThreadIdRef.current = null;
      }
    }
  }, [activeThreadId]);

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

    input,
    setInput,
    loading,
    setLoading,
    setMessages,
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
    getIsComposing: () => Boolean(composingRef.current),
  });

  const canSendNow = displayLoggedIn
    ? !loading && !threadBusy && Boolean(normalizedInput)
    : !loading && Boolean(normalizedInput);

  const canShowMore = viewMessages.length > visibleCount;

  const onShowMore = useCallback(() => {
    setVisibleCount((v) => Math.min(viewMessages.length, v + 200));
  }, [viewMessages.length]);

  const shouldBootScreen = !shouldHoldSignedOutScreen && !authReady && !displayLoggedIn;

  const disableNewChat = Boolean(displayLoggedIn && threadBusy);

  const activeThreadIdForView = useMemo(() => {
    if (!displayLoggedIn) return null;

    const rawActive = String(activeThreadId ?? "").trim();
    return rawActive || null;
  }, [displayLoggedIn, activeThreadId]);

  const shouldHoldBlankThreadStage = useMemo(() => {
    if (!displayLoggedIn) return false;
    if (loading) return false;
    if (viewRendered.length > 0) return false;
    if (messagesForView.length > 0) return false;

    const activeTid = String(activeThreadIdForView ?? activeThreadId ?? "").trim();
    if (!activeTid) return false;

    if (!isTemporaryGuestThreadId(activeTid)) {
      return false;
    }

    return true;
  }, [
    displayLoggedIn,
    loading,
    viewRendered.length,
    messagesForView.length,
    activeThreadIdForView,
    activeThreadId,
  ]);

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

  if (shouldBootScreen) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
        aria-label="booting chat"
      >
        <div style={{ fontSize: 14, opacity: 0.75 }}>
          {displayLoggedIn
            ? uiLang === "en"
              ? "Preparing chat…"
              : "チャットを準備中…"
            : "Loading..."}
        </div>
      </main>
    );
  }

  const ChatClientViewAny = ChatClientView as any;

  return (
    <ChatClientViewAny
      rootRef={rootRef}
      loggedIn={displayLoggedIn}
      email={displayLoggedIn ? email : ""}
      uiLang={uiLang}
      ui={ui}
      input={input}
      setInput={setInput}
      messages={viewMessages}
      loading={loading}
      threads={displayLoggedIn ? threads : EMPTY_THREADS}
      activeThreadId={displayLoggedIn ? activeThreadIdForView : null}
      activeThread={resolvedActiveThreadForView}
      activeThreadState={
        displayLoggedIn && !isViewingPendingEmptyThread
          ? resolvedActiveThreadState ?? null
          : null
      }
      threadBusy={displayLoggedIn ? threadBusy : false}
      shouldHoldBlankThreadStage={displayLoggedIn ? shouldHoldBlankThreadStage : false}
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
      canSend={Boolean(canSendNow)}
      normalizedInput={normalizedInput}
      composing={Boolean(composing)}
      disableNewChat={Boolean(disableNewChat)}
      onChangeLang={onChangeLang}
    />
  );
}

/*
このファイルの正式役割
チャット画面の親本体ファイル。
state / ref / hook 呼び出し / 値の受け渡しをまとめ、
ChatClientView へ表示用の値を接続する。
親は読むだけ・つなぐだけに寄せる。
*/

/*
【今回このファイルで修正したこと】
1. 仮 thread_id 中で ownerThreadId がまだ空でも、送信中かつ messages が存在する場合は messagesForView に通すよう修正しました。
2. shouldHoldBlankThreadStage が通常 thread の threadBusy まで抱え込んでいた待機画面責務をこの親から外し、仮空スレッド時だけに限定しました。
3. 送信中は shouldHoldBlankThreadStage を false にし、本文表示の入口を待機画面が握り続けないよう修正しました。
4. これにより、この親ファイル内で重複していた本文採用条件と待機画面条件の衝突を減らしました。
5. HOPY回答○、Compass、confirmed payload、DB保存・復元には触っていません。
*/

/* /components/chat/ChatClient.tsx */