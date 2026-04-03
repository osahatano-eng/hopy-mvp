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

  const activeThreadIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;

    const tid = String(activeThreadId ?? "").trim();
    if (!tid) return;

    if (isTemporaryGuestThreadId(tid)) {
      pendingEmptyThreadIdRef.current = tid;
    }
  }, [activeThreadId]);

  const lastHydratedThreadIdRef = useRef<string | null>(null);

  const messagesRef = useRef<ChatMsg[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const tid = String(activeThreadId ?? "").trim();

    if (!displayLoggedIn) {
      lastHydratedThreadIdRef.current = null;
      return;
    }

    if (!tid) {
      lastHydratedThreadIdRef.current = null;
      return;
    }

    if (isTemporaryGuestThreadId(tid)) {
      lastHydratedThreadIdRef.current = tid;
      return;
    }

    const prevTid = String(lastHydratedThreadIdRef.current ?? "").trim();

    if (!prevTid) {
      lastHydratedThreadIdRef.current = tid;
      return;
    }

    if (prevTid === tid) return;

    lastHydratedThreadIdRef.current = tid;

    try {
      setMessages([]);
    } catch {}

    try {
      setVisibleCount(200);
    } catch {}

    try {
      atBottomRef.current = true;
      setAtBottom(true);
    } catch {}
  }, [displayLoggedIn, activeThreadId]);

  const lastThreadDecisionRef = useRef<ThreadDecision | null>(null);
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
        try {
          clearActiveThreadId();
        } catch {}
        try {
          setThreads([]);
        } catch {}
        try {
          setActiveThreadId(null);
        } catch {}
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
        try {
          setMemOpen(false);
        } catch {}
        try {
          setRailOpen(false);
        } catch {}
        try {
          resetOpeningDrag();
        } catch {}
        try {
          pendingEmptyThreadIdRef.current = null;
        } catch {}
        try {
          lastHydratedThreadIdRef.current = null;
        } catch {}
        return;
      }

      try {
        clearActiveThreadId();
      } catch {}
      try {
        setEmail("");
      } catch {}
      try {
        setThreads([]);
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
      try {
        setLoading(false);
      } catch {}
      try {
        setMemOpen(false);
      } catch {}
      try {
        setRailOpen(false);
      } catch {}
      try {
        resetOpeningDrag();
      } catch {}
      try {
        activeThreadIdRef.current = null;
      } catch {}
      try {
        lastThreadDecisionRef.current = null;
      } catch {}
      try {
        pendingEmptyThreadIdRef.current = null;
      } catch {}
      try {
        lastHydratedThreadIdRef.current = null;
      } catch {}
      return;
    }
  }, [authReady, loggedIn, displayLoggedIn, signedOutCauseRef, resetOpeningDrag]);

  useEffect(() => {
    if (!authReady) return;
    if (!displayLoggedIn) return;

    const tid = String(activeThreadId ?? "").trim();
    if (!tid) return;
    if (!isTemporaryGuestThreadId(tid)) return;

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
      pendingEmptyThreadIdRef.current = null;
    } catch {}
    try {
      activeThreadIdRef.current = null;
    } catch {}
    try {
      lastHydratedThreadIdRef.current = null;
    } catch {}
  }, [authReady, displayLoggedIn, activeThreadId]);

  useAutoGrowTextarea(inputRef as React.RefObject<HTMLTextAreaElement>, input, 420);

  const composerHRaw = useComposerHeight(composerRef, 96);
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
      localStorage.setItem("hopy_lang", safeNext);
    } catch {}

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

  const {
    viewMessages,
    viewRendered,
    viewVisibleTexts,
    viewActiveThreadId,
    viewActiveThread,
    activeThreadStateLevel,
    viewUserState,
  } = useChatClientViewState({
    displayLoggedIn,
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

  const { sendMessage, retryLastFailed } = useChatSend<HopyState>({
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

  const shouldBootScreen = !(
    logoutRedirecting &&
    signedOutCauseRef.current &&
    !displayLoggedIn
  ) && !authReady && !displayLoggedIn;

  const disableNewChat =
    displayLoggedIn &&
    !hasPendingEmptyThread &&
    !isViewingPendingEmptyThread &&
    messages.length === 0 &&
    !Boolean(normalizedInput);

  const activeThreadIdForView = useMemo(() => {
    if (!displayLoggedIn) return null;

    const rawActive = String(activeThreadId ?? "").trim();
    if (rawActive && isTemporaryGuestThreadId(rawActive)) {
      return rawActive;
    }

    return viewActiveThreadId || null;
  }, [displayLoggedIn, activeThreadId, viewActiveThreadId]);

  if (logoutRedirecting && signedOutCauseRef.current && !displayLoggedIn) {
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

このファイルが受け取るもの
入力中の input
messages
threads
activeThreadId
userState
uiLang
useChatSend など各 hook から返る状態
useChatClientViewState から返る
- viewRendered
- viewVisibleTexts
- viewMessages
- viewActiveThread
- viewActiveThreadId

このファイルが渡すもの
ChatClientView
- rendered={viewRendered}
- visibleTexts={viewVisibleTexts}
- messages={viewMessages}
- activeThread
- activeThreadState
- userState
そのほか画面描画に必要な各種 props

Compass 観点でこのファイルの意味
このファイルは Compass を直接生成する場所ではない。
Compass を含みうる messages をもとに、
useChatClientViewState で作られた viewRendered / visibleTexts を受け取り、
最終的に ChatClientView へ渡す表示親である。

このファイルで確認できた大事なこと
1. このファイル自身には compass.text / compass.prompt を message に積む処理はない。
2. Compass 表示に使われる rendered / visibleTexts は useChatClientViewState から受け取っている。
3. このファイルは Compass を作る層ではなく、表示用データを ChatClientView へ受け渡す親である。
4. したがって、このファイル単体が Compass 欠落の直接原因である可能性は低い。
5. 次に確認すべきは、messages へ assistant message を保存する側、または viewRendered / visibleTexts を組み立てる側である。
*/

/*
【今回このファイルで修正したこと】
1. useLeftRailOpeningDrag の呼び出しで不足していた enabled を追加しました。
2. 値はこのファイル内だけで enabled: true とし、hook定義や他ファイルには触れていません。
3. useAutoGrowTextarea の呼び出しで inputRef を React.RefObject<HTMLTextAreaElement> として渡し、nullable ref と non-null ref の型不一致をこのファイル内だけで止めました。
*/