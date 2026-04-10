// /components/chat/ChatClient.tsx
"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import type { ChatMsg, Thread } from "./lib/chatTypes";
import { clampText, detectUserLang } from "./lib/text";
import { useAutoGrowTextarea, useComposerHeight, usePreventHorizontalScroll, useVisualViewportBottom } from "./lib/hooks";

import ChatClientView from "./ChatClientView";

import { useChatInit } from "./lib/useChatInit";
import { useThreadSwitch } from "./lib/useThreadSwitch";
import { useTranslateCache } from "./lib/useTranslateCache";
import { useChatSend, type FailedSend } from "./lib/useChatSend";

import { normalizeHopyState, type HopyState } from "./lib/stateBadge";
import { clearActiveThreadId } from "./lib/threadStore";

import { cleanForDecision, initHopyApiDebugTools, initHopyImeDebugTools } from "./lib/debugTools";
import { useImeStabilizer } from "./lib/useImeStabilizer";
import { readInitialUiLang, buildThinkingLabel, buildUi } from "./lib/chatClientUi";
import { useChatAuth } from "./lib/useChatAuth";
import { useChatThreadEvents } from "./lib/useChatThreadEvents";
import { useChatClientViewState } from "./lib/useChatClientViewState";
import { useChatThreadCreation } from "./lib/useChatThreadCreation";
import { isTemporaryGuestThreadId } from "./lib/chatThreadIdentity";
import { useLeftRailSwipeOpen } from "./view/hooks/useLeftRailSwipeOpen";
import { useLeftRailOpeningDrag } from "./view/hooks/useLeftRailOpeningDrag";
import { resolveActiveThreadStateForView } from "./view/resolveActiveThreadStateForView";
import { useBroadcastUserStateLabel } from "./view/useBroadcastUserStateLabel";
import { resolveMergedUserStateForView } from "./view/resolveMergedUserStateForView";

type ThreadDecision = { id: string; at: number; reason: string };

const EMPTY_THREADS: Thread[] = [];

function extractRenderableMessageText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => extractRenderableMessageText(item))
      .filter(Boolean)
      .join(" ")
      .trim();
    return joined;
  }

  if (value && typeof value === "object") {
    const safe = value as Record<string, unknown>;

    return extractRenderableMessageText(
      safe.text ??
        safe.content ??
        safe.body ??
        safe.reply ??
        safe.message ??
        safe.value ??
        safe.parts,
    );
  }

  return "";
}

function extractMessageThreadId(msg: ChatMsg | null | undefined): string {
  const safe = msg as any;
  if (!safe) return "";

  const candidates = [
    safe.thread_id,
    safe.threadId,
    safe.conversation_id,
    safe.conversationId,
    safe.chat_id,
    safe.chatId,
    safe.thread?.id,
    safe.conversation?.id,
  ];

  for (const candidate of candidates) {
    const tid = String(candidate ?? "").trim();
    if (tid) return tid;
  }

  return "";
}

function resolveMessagesOwnerThreadId(messages: ChatMsg[] | null | undefined): string {
  if (!Array.isArray(messages) || messages.length <= 0) return "";

  const counts = new Map<string, number>();
  let firstDetected = "";

  for (const msg of messages) {
    const tid = extractMessageThreadId(msg);
    if (!tid) continue;

    if (!firstDetected) {
      firstDetected = tid;
    }

    counts.set(tid, (counts.get(tid) ?? 0) + 1);
  }

  if (!firstDetected) return "";

  if (counts.size === 1) {
    return firstDetected;
  }

  let winner = "";
  let winnerCount = 0;

  for (const [tid, count] of counts.entries()) {
    if (count > winnerCount) {
      winner = tid;
      winnerCount = count;
    }
  }

  return winner;
}

function isCompletedAssistantReplyMessage(msg: ChatMsg | null | undefined): boolean {
  const safe = msg as any;
  if (!safe) return false;

  const role = String(safe.role ?? "").trim().toLowerCase();
  if (role !== "assistant") return false;

  const status = String(safe.status ?? "").trim().toLowerCase();
  if (status === "pending" || status === "loading" || status === "streaming") {
    return false;
  }

  if (
    safe.pending === true ||
    safe.loading === true ||
    safe.streaming === true ||
    safe.isThinking === true
  ) {
    return false;
  }

  const text = extractRenderableMessageText(
    safe.text ??
      safe.content ??
      safe.body ??
      safe.reply ??
      safe.message ??
      safe.parts,
  );

  return Boolean(text);
}

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
  const [uiLang, setUiLang] = useState(() => readInitialUiLang());

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

  const scrollToBottom = useCallback((behavior: ScrollBehavior | "auto" | "smooth" = "auto") => {
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
  }, []);

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

  const resetLoggedOutState = useCallback(
    ({
      clearMessages,
      clearLoading,
      clearActiveThreadRef,
      clearLastThreadDecision,
    }: {
      clearMessages: boolean;
      clearLoading: boolean;
      clearActiveThreadRef: boolean;
      clearLastThreadDecision: boolean;
    }) => {
      try {
        clearActiveThreadId();
      } catch {}

      try {
        setThreads([]);
      } catch {}

      try {
        setActiveThreadId(null);
      } catch {}

      if (clearMessages) {
        try {
          setMessages([]);
        } catch {}

        try {
          setVisibleCount(200);
        } catch {}
      }

      try {
        setUserState(null);
      } catch {}

      try {
        setUserStateErr(null);
      } catch {}

      try {
        setLastFailed(null);
      } catch {}

      try {
        setThreadBusy(false);
      } catch {}

      if (clearLoading) {
        try {
          setLoading(false);
        } catch {}
      }

      try {
        resetRailState();
      } catch {}

      if (clearActiveThreadRef) {
        try {
          activeThreadIdRef.current = null;
        } catch {}
      }

      if (clearLastThreadDecision) {
        try {
          lastThreadDecisionRef.current = null;
        } catch {}
      }

      try {
        clearThreadViewRefs();
      } catch {}
    },
    [clearThreadViewRefs, resetRailState]
  );

  const clearTemporaryGuestSelection = useCallback(() => {
    try {
      clearActiveThreadId();
    } catch {}

    try {
      setActiveThreadId(null);
    } catch {}

    try {
      setMessages([]);
    } catch {}

    try {
      setVisibleCount(200);
    } catch {}

    try {
      activeThreadIdRef.current = null;
    } catch {}

    try {
      clearThreadViewRefs();
    } catch {}
  }, [clearThreadViewRefs]);

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

  const prevDisplayLoggedInRef = useRef(false);
  const [signedOutFromLoggedIn, setSignedOutFromLoggedIn] = useState(false);

  const justSignedOut =
    authReady &&
    prevDisplayLoggedInRef.current &&
    !displayLoggedIn;

  useEffect(() => {
    if (!authReady) return;

    if (displayLoggedIn) {
      setSignedOutFromLoggedIn(false);
      prevDisplayLoggedInRef.current = true;
      return;
    }

    if (prevDisplayLoggedInRef.current) {
      setSignedOutFromLoggedIn(true);
    }

    prevDisplayLoggedInRef.current = false;
  }, [authReady, displayLoggedIn]);

  const shouldHoldSignedOutScreen =
    authReady &&
    !displayLoggedIn &&
    Boolean(
      logoutRedirecting ||
        signedOutCauseRef.current ||
        signedOutFromLoggedIn ||
        justSignedOut,
    );

  useEffect(() => {
    if (!shouldHoldSignedOutScreen) return;

    try {
      if (window.location.pathname !== "/") {
        window.location.replace("/");
      }
    } catch {}
  }, [shouldHoldSignedOutScreen]);

  const activeThreadIdRef = useRef<string | null>(null);
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
        return [{ id: tid, title: defaultTitle, state_level: 1, current_phase: 1 } as Thread, ...prev];
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

  useEffect(() => {
    if (!authReady) return;

    if (!displayLoggedIn) {
      try {
        setEmail("");
      } catch {}
    }

    if (!loggedIn) {
      if (!signedOutCauseRef.current) {
        resetLoggedOutState({
          clearMessages: false,
          clearLoading: false,
          clearActiveThreadRef: false,
          clearLastThreadDecision: false,
        });
        return;
      }

      resetLoggedOutState({
        clearMessages: true,
        clearLoading: true,
        clearActiveThreadRef: true,
        clearLastThreadDecision: true,
      });
      return;
    }
  }, [authReady, loggedIn, displayLoggedIn, signedOutCauseRef, resetLoggedOutState]);

  useEffect(() => {
    if (!authReady) return;
    if (!displayLoggedIn) return;

    const tid = String(activeThreadId ?? "").trim();
    if (!tid) return;
    if (!isTemporaryGuestThreadId(tid)) return;

    clearTemporaryGuestSelection();
  }, [authReady, displayLoggedIn, activeThreadId, clearTemporaryGuestSelection]);

  useAutoGrowTextarea(inputRef as React.RefObject<HTMLTextAreaElement>, input, 420);

  const composerHRaw = useComposerHeight(composerRef as React.RefObject<HTMLElement>, 96);
  const vvBottomRaw = useVisualViewportBottom();
  const composerH = Math.max(0, Math.round(Number.isFinite(composerHRaw) ? composerHRaw : 0));
  const vvBottom = Math.max(0, Math.round(Number.isFinite(vvBottomRaw) ? vvBottomRaw : 0));
  const composerOffset = composerH + 24 + vvBottom;

  const lastAppliedViewportVarsRef = useRef<{
    composerH: number;
    vvBottom: number;
    composerOffset: number;
  } | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const prev = lastAppliedViewportVarsRef.current;
    if (
      prev &&
      prev.composerH === composerH &&
      prev.vvBottom === vvBottom &&
      prev.composerOffset === composerOffset
    ) {
      return;
    }

    el.style.setProperty("--composerH", `${composerH}px`);
    el.style.setProperty("--vvBottom", `${vvBottom}px`);
    el.style.setProperty("--composerOffset", `${composerOffset}px`);

    lastAppliedViewportVarsRef.current = {
      composerH,
      vvBottom,
      composerOffset,
    };
  }, [composerH, vvBottom, composerOffset]);

  useEffect(() => {
    try {
      const saved = String(localStorage.getItem("hopy_lang") || "").toLowerCase();
      const next = saved === "en" ? "en" : "ja";
      setUiLang((prev) => (prev === next ? prev : next));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("hopy_lang", uiLang);
  }, [uiLang]);

  const onChangeLang = useCallback((next: "ja" | "en") => {
    const safeNext = next === "en" ? "en" : "ja";
    setUiLang((prev) => (prev === safeNext ? prev : safeNext));

    try {
      window.dispatchEvent(new CustomEvent("hopy:lang-change", { detail: { lang: safeNext } }));
    } catch {}
  }, []);

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

  const guardedSetMessages = useCallback<React.Dispatch<React.SetStateAction<ChatMsg[]>>>((updater) => {
    setMessages((prev) => {
      try {
        const next = typeof updater === "function" ? (updater as (prevState: ChatMsg[]) => ChatMsg[])(prev) : updater;
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
        const current = String(activeThreadIdRef.current ?? "").trim();

        if (current && !isTemporaryGuestThreadId(current)) {
          return;
        }

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
    [noteThreadDecision]
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

  const bootPendingRef = useRef(false);
  useEffect(() => {
    const tid = String(activeThreadId ?? "").trim();
    if (!tid) return;
    bootPendingRef.current = true;
  }, [activeThreadId]);

  const normalizedInput = cleanForDecision(input);

  const {
    ensureThreadId,
    onThreadIdResolved,
  } = useChatThreadCreation({
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
    setActiveThreadId,
    setVisibleCount,
  });

  const messagesForView = useMemo(() => {
    if (!displayLoggedIn) return messages;

    const activeTid = String(activeThreadId ?? "").trim();
    if (!activeTid) return [];
    if (isTemporaryGuestThreadId(activeTid)) return messages;

    const ownerTid = String(currentMessagesOwnerThreadId ?? "").trim();
    if (!ownerTid || ownerTid === activeTid) {
      return messages;
    }

    return [];
  }, [displayLoggedIn, activeThreadId, messages, currentMessagesOwnerThreadId]);

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

  const {
    normalizedResolvedViewUserState,
    mergedUserStateForView,
  } = resolveMergedUserStateForView({
    viewUserState,
  });

  const hasPendingEmptyThread = Boolean(String(pendingEmptyThreadIdRef.current ?? "").trim());
  const isViewingPendingEmptyThread = isTemporaryGuestThreadId(String(activeThreadId ?? "").trim());

  const {
    resolvedActiveThreadForView,
    resolvedActiveThreadState,
  } = resolveActiveThreadStateForView({
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

  const scrollToBottomRef = useRef(scrollToBottom);
  useEffect(() => {
    scrollToBottomRef.current = scrollToBottom;
  }, [scrollToBottom]);

  useLayoutEffect(() => {
    if (!bootPendingRef.current) return;
    if (!String(activeThreadId ?? "").trim()) return;
    if (viewRendered.length <= 0) return;

    bootPendingRef.current = false;
    atBottomRef.current = true;
    setAtBottom(true);

    const go = () => {
      try {
        scrollToBottomRef.current("auto");
      } catch {}
    };

    try {
      requestAnimationFrame(() => {
        requestAnimationFrame(go);
      });
    } catch {
      go();
    }
  }, [activeThreadId, viewRendered.length, scrollToBottom]);

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

  const disableNewChat =
    displayLoggedIn &&
    !hasPendingEmptyThread &&
    !isViewingPendingEmptyThread &&
    messages.length === 0 &&
    !Boolean(normalizedInput);

  const activeThreadIdForView = useMemo(() => {
    if (!displayLoggedIn) return null;

    const rawActive = String(activeThreadId ?? "").trim();
    return rawActive || null;
  }, [displayLoggedIn, activeThreadId]);

  const shouldHoldBlankThreadStage = useMemo(() => {
    if (!displayLoggedIn) return false;
    if (!threadBusy) return false;
    if (viewRendered.length > 0) return false;
    if (messagesForView.length > 0) return false;

    const activeTid = String(activeThreadIdForView ?? activeThreadId ?? "").trim();
    if (!activeTid) return false;
    if (isTemporaryGuestThreadId(activeTid)) return false;

    return true;
  }, [
    displayLoggedIn,
    threadBusy,
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
          {displayLoggedIn ? (uiLang === "en" ? "Preparing chat…" : "チャットを準備中…") : "Loading..."}
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
messages / threads / activeThreadId / rendered / visibleTexts など、
表示に必要な値をまとめて ChatClientView へ渡す。
*/

/*
【今回このファイルで修正したこと】
1. threadMessagesCacheRef / messagesOwnerThreadIdRef を削除し、ChatClient.tsx 内での本文キャッシュ採用をやめました。
2. messagesForView は「現在の activeThreadId に一致する messages だけを渡す」形へ絞りました。
3. activeThreadIdForView の viewActiveThreadId fallback を削除し、選択の正を activeThreadId だけに戻しました。
4. messages 読込責務、HOPY回答○、Compass、state_changed、confirmed payload、DB保存、DB復元の唯一の正には触っていません。
*/

/* /components/chat/ChatClient.tsx */