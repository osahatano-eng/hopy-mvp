// /components/chat/lib/useChatClientViewState.ts
"use client";

import { useEffect, useMemo } from "react";
import type { ChatMsg, Thread } from "./chatTypes";
import type { HopyState } from "./stateBadge";
import { useRenderMessages } from "./useRenderMessages";
import { pickLatestAssistantStateMessage } from "./chatMessageState";
import { mergeThreadStateFromMessage } from "./chatThreadState";

type Params = {
  displayLoggedIn: boolean;
  activeThreadId: string | null;
  threads: Thread[];
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
  messages: ChatMsg[];
  visibleCount: number;
  uiLang: "ja" | "en";
  ui: {
    dayStart: string;
  };
  tmap: Map<string, string>;
  userState: HopyState | null;
  normalizedInput: string;
};

function hasMergedThreadStateChanged(prevThread: Thread, nextThread: Thread) {
  if (prevThread === nextThread) return false;

  const prevAny = (prevThread ?? null) as any;
  const nextAny = (nextThread ?? null) as any;

  return (
    prevAny?.state_level !== nextAny?.state_level ||
    prevAny?.current_phase !== nextAny?.current_phase ||
    prevAny?.state_changed !== nextAny?.state_changed ||
    prevAny?.prev_phase !== nextAny?.prev_phase ||
    prevAny?.prev_state_level !== nextAny?.prev_state_level
  );
}

function clampPhase1to5(value: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const v = Math.trunc(n);
  if (v < 1 || v > 5) return null;
  return v as 1 | 2 | 3 | 4 | 5;
}

function toCanonicalState(source: any): HopyState | null {
  if (!source || typeof source !== "object") return null;

  const current =
    clampPhase1to5(source?.current_phase) ??
    clampPhase1to5(source?.state_level);

  const prev =
    clampPhase1to5(source?.prev_phase) ??
    clampPhase1to5(source?.prev_state_level);

  const changed =
    typeof source?.state_changed === "boolean"
      ? source.state_changed
      : source?.state_changed === 1 ||
          source?.state_changed === "1" ||
          source?.state_changed === "true"
        ? true
        : source?.state_changed === 0 ||
            source?.state_changed === "0" ||
            source?.state_changed === "false"
          ? false
          : false;

  if (current == null && prev == null) return null;

  return {
    current_phase: current,
    state_level: current,
    prev_phase: prev,
    prev_state_level: prev,
    state_changed: changed,
    updated_at: String(source?.updated_at ?? "").trim() || null,
  };
}

export function useChatClientViewState({
  displayLoggedIn,
  activeThreadId,
  threads,
  setThreads,
  messages,
  visibleCount,
  uiLang,
  ui,
  tmap,
  userState,
  normalizedInput,
}: Params) {
  const activeThreadKey = String(activeThreadId ?? "").trim();

  const { rendered, visibleTexts } = useRenderMessages({
    messages,
    visibleCount,
    uiLang,
    dayStartLabel: ui.dayStart,
    tmap,
  });

  const viewRendered = Array.isArray(rendered) ? rendered : [];
  const viewVisibleTexts = Array.isArray(visibleTexts) ? visibleTexts : [];

  const latestAssistantStateMsg = pickLatestAssistantStateMessage(messages);

  useEffect(() => {
    if (!displayLoggedIn) return;
    if (!activeThreadKey) return;
    if (!latestAssistantStateMsg) return;

    setThreads((prev) => {
      if (!Array.isArray(prev) || prev.length <= 0) return prev;

      let changed = false;

      const next = prev.map((thread) => {
        const id = String((thread as any)?.id ?? "").trim();
        if (id !== activeThreadKey) return thread;

        const merged = mergeThreadStateFromMessage(thread, latestAssistantStateMsg);

        if (hasMergedThreadStateChanged(thread, merged)) {
          changed = true;
          return merged;
        }

        return thread;
      });

      return changed ? next : prev;
    });
  }, [displayLoggedIn, activeThreadKey, latestAssistantStateMsg, setThreads]);

  const isDraftLikeActiveThread = useMemo(() => {
    if (!displayLoggedIn) return false;
    if (!activeThreadKey) return false;

    const hasNoMessages = messages.length === 0;
    const hasNoInput = !Boolean(normalizedInput);
    const hasNoAssistantState = !latestAssistantStateMsg;

    return hasNoMessages && hasNoInput && hasNoAssistantState;
  }, [
    displayLoggedIn,
    activeThreadKey,
    messages.length,
    normalizedInput,
    latestAssistantStateMsg,
  ]);

  const latestAssistantCanonicalState = useMemo<HopyState | null>(() => {
    if (!latestAssistantStateMsg) return null;

    const msgAny = latestAssistantStateMsg as any;
    return toCanonicalState(msgAny?.hopy_confirmed_payload?.state) ?? null;
  }, [latestAssistantStateMsg]);

  const viewActiveThread = useMemo<Thread | null>(() => {
    if (!displayLoggedIn) return null;
    if (!activeThreadKey) return null;

    const activeThread =
      threads.find((thread) => String((thread as any)?.id ?? "").trim() === activeThreadKey) ??
      null;

    if (!activeThread) return null;
    if (!latestAssistantCanonicalState) return activeThread;

    return {
      ...(activeThread as any),
      current_phase: latestAssistantCanonicalState.current_phase,
      state_level: latestAssistantCanonicalState.state_level,
      prev_phase: latestAssistantCanonicalState.prev_phase,
      prev_state_level: latestAssistantCanonicalState.prev_state_level,
      state_changed: latestAssistantCanonicalState.state_changed,
      updated_at:
        latestAssistantCanonicalState.updated_at ??
        (activeThread as any)?.updated_at ??
        null,
    } as Thread;
  }, [displayLoggedIn, activeThreadKey, threads, latestAssistantCanonicalState]);

  const resolvedViewUserState = useMemo<HopyState | null>(() => {
    if (!displayLoggedIn) return null;
    if (isDraftLikeActiveThread) return null;

    if (messages.length > 0) {
      return latestAssistantCanonicalState ?? null;
    }

    if (viewActiveThread) {
      const threadState = toCanonicalState(viewActiveThread);
      if (threadState) return threadState;
    }

    return null;
  }, [
    displayLoggedIn,
    isDraftLikeActiveThread,
    messages.length,
    latestAssistantCanonicalState,
    viewActiveThread,
  ]);

  const viewUserState = useMemo<HopyState | null>(() => {
    if (!resolvedViewUserState) return null;
    if (!userState || typeof userState !== "object") return resolvedViewUserState;

    return {
      ...(userState as HopyState),
      ...resolvedViewUserState,
    };
  }, [userState, resolvedViewUserState]);

  return {
    viewMessages: messages,
    viewRendered,
    viewVisibleTexts,
    viewActiveThread,
    viewUserState,
  };
}

/*
このファイルの正式役割
チャット画面用の表示状態組み立てファイル。
messages / threads / activeThreadId から、
画面表示に使う viewMessages / viewRendered / viewVisibleTexts / viewActiveThread を作る。

このファイルが受け取るもの
displayLoggedIn
activeThreadId
threads
setThreads
messages
visibleCount
uiLang
ui
tmap
userState
normalizedInput

このファイルが渡すもの
viewMessages
viewRendered
viewVisibleTexts
viewActiveThread
viewUserState

Compass 観点でこのファイルの意味
このファイルは Compass を直接生成する場所ではない。
messages を useRenderMessages(...) に渡し、
画面表示直前に使う viewRendered / viewVisibleTexts を組み立てる表示中継層である。
そのため、Compass を含んだ assistant message が messages に入っていれば、
その message を描画用データへ渡す側のファイルである。
*/

/*
【今回このファイルで修正したこと】
1. activeThread の中間 useMemo を削除しました。
2. 表示用 active thread の決定を viewActiveThread に一本化しました。
3. viewUserState の merge を表示責務に必要な最小形へ整理しました。
4. HOPY唯一の正、confirmed payload、state_changed、HOPY回答○、Compass、DB保存/復元の意味仕様には触っていません。
*/

/* /components/chat/lib/useChatClientViewState.ts */