// /components/chat/lib/useChatClientViewState.ts
"use client";

import { useEffect, useMemo } from "react";
import type { ChatMsg, Thread } from "./chatTypes";
import type { HopyState } from "./stateBadge";
import { useRenderMessages } from "./useRenderMessages";
import { pickLatestAssistantStateMessage } from "./chatMessageState";
import { mergeThreadStateFromMessage } from "./chatThreadState";

const EMPTY_VISIBLE_TEXTS = new Map<string, string>();

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

function getMessageThreadKey(message: ChatMsg): string {
  const msgAny = (message ?? null) as any;

  return String(
    msgAny?.conversation_id ??
      msgAny?.thread_id ??
      msgAny?.conversationId ??
      msgAny?.threadId ??
      ""
  ).trim();
}

function isMessageForActiveThread(message: ChatMsg, activeThreadKey: string) {
  if (!activeThreadKey) return true;

  const messageThreadKey = getMessageThreadKey(message);
  if (!messageThreadKey) return false;

  return messageThreadKey === activeThreadKey;
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

  const viewMessages = useMemo<ChatMsg[]>(() => {
    const sourceMessages = Array.isArray(messages) ? messages : [];

    if (!displayLoggedIn) return sourceMessages;
    if (!activeThreadKey) return sourceMessages;

    return sourceMessages.filter((message) =>
      isMessageForActiveThread(message, activeThreadKey)
    );
  }, [displayLoggedIn, activeThreadKey, messages]);

  const { rendered, visibleTexts } = useRenderMessages({
    messages: viewMessages,
    visibleCount,
    uiLang,
    dayStartLabel: ui.dayStart,
    tmap,
  });

  const viewRendered = Array.isArray(rendered) ? rendered : [];
  const viewVisibleTexts =
    visibleTexts instanceof Map ? visibleTexts : EMPTY_VISIBLE_TEXTS;

  const latestAssistantStateMsg = pickLatestAssistantStateMessage(viewMessages);

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

  const activeThreadFromList = useMemo<Thread | null>(() => {
    if (!displayLoggedIn) return null;
    if (!activeThreadKey) return null;

    return (
      threads.find((thread) => String((thread as any)?.id ?? "").trim() === activeThreadKey) ??
      null
    );
  }, [displayLoggedIn, activeThreadKey, threads]);

  const isDraftLikeActiveThread = useMemo(() => {
    if (!displayLoggedIn) return false;
    if (!activeThreadKey) return false;
    if (activeThreadFromList) return false;

    const hasNoMessages = viewMessages.length === 0;
    const hasNoInput = !Boolean(normalizedInput);
    const hasNoAssistantState = !latestAssistantStateMsg;

    return hasNoMessages && hasNoInput && hasNoAssistantState;
  }, [
    displayLoggedIn,
    activeThreadKey,
    activeThreadFromList,
    viewMessages.length,
    normalizedInput,
    latestAssistantStateMsg,
  ]);

  const latestAssistantCanonicalState = useMemo<HopyState | null>(() => {
    if (!latestAssistantStateMsg) return null;

    const msgAny = latestAssistantStateMsg as any;
    return toCanonicalState(msgAny?.hopy_confirmed_payload?.state) ?? null;
  }, [latestAssistantStateMsg]);

  const viewActiveThread = useMemo<Thread | null>(() => {
    if (!activeThreadFromList) return null;
    if (!latestAssistantCanonicalState) return activeThreadFromList;

    return {
      ...(activeThreadFromList as any),
      current_phase: latestAssistantCanonicalState.current_phase,
      state_level: latestAssistantCanonicalState.state_level,
      prev_phase: latestAssistantCanonicalState.prev_phase,
      prev_state_level: latestAssistantCanonicalState.prev_state_level,
      state_changed: latestAssistantCanonicalState.state_changed,
      updated_at:
        latestAssistantCanonicalState.updated_at ??
        (activeThreadFromList as any)?.updated_at ??
        null,
    } as Thread;
  }, [activeThreadFromList, latestAssistantCanonicalState]);

  const resolvedViewUserState = useMemo<HopyState | null>(() => {
    if (!displayLoggedIn) return null;
    if (isDraftLikeActiveThread) return null;

    if (viewMessages.length > 0) {
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
    viewMessages.length,
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
    viewMessages,
    viewRendered,
    viewVisibleTexts,
    viewActiveThread,
    viewUserState,
  };
}

/*
このファイルの正式役割
チャット画面用の表示状態組み立てファイル。
messages / threads / activeThreadId / userState から、
画面表示に使う viewMessages / viewRendered / viewVisibleTexts / viewActiveThread / viewUserState を作る。

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
activeThreadId と一致する messages だけを useRenderMessages(...) に渡し、
画面表示直前に使う viewRendered / viewVisibleTexts を組み立てる表示中継層である。
そのため、Compass を含んだ assistant message が messages に入っていれば、
その message を描画用データへ渡す側のファイルである。
*/

/*
【今回このファイルで修正したこと】
1. activeThreadId と threads から activeThreadFromList を先に確定するようにしました。
2. threads に存在する既存スレッドを、messages が空という理由だけで draft-like 扱いしないようにしました。
3. タブ復帰後に messages が未復帰でも、threads 側の選択中スレッド情報から viewActiveThread / viewUserState を組み立てられるようにしました。
4. 本文採用、confirmed payload、state_changed、HOPY回答○、Compass、DB保存/復元、1..5 の唯一の正には触っていません。
*/

/* /components/chat/lib/useChatClientViewState.ts */