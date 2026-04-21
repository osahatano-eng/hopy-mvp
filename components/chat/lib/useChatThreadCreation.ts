// /components/chat/lib/useChatThreadCreation.ts
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { isTemporaryGuestThreadId } from "./chatThreadIdentity";

type Params = {
  displayLoggedIn: boolean;
  activeThreadIdRef: MutableRefObject<string | null>;
  setThreadBusy: Dispatch<SetStateAction<boolean>>;
  setUserStateErr: Dispatch<SetStateAction<string | null>>;
  setActiveThreadId: (v: string | null) => void;
  setVisibleCount: Dispatch<SetStateAction<number>>;
};

function errText(x: any) {
  const msg = String(x?.message ?? x ?? "thread_create_failed").trim();
  return msg || "thread_create_failed";
}

function canUseResolvedThreadId(threadId: string) {
  const tid = String(threadId ?? "").trim();
  if (!tid) return false;
  if (isTemporaryGuestThreadId(tid)) return false;
  return true;
}

function isPendingCreationTarget(threadId: string) {
  const tid = String(threadId ?? "").trim();
  if (!tid) return false;
  return isTemporaryGuestThreadId(tid);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePendingThreadIdFromDetail(detail: unknown) {
  const safe = (detail ?? {}) as Record<string, unknown>;

  const candidates = [
    safe.clientRequestId,
    safe.client_request_id,
    safe.threadId,
    safe.thread_id,
    safe.selectedThreadId,
    safe.selected_thread_id,
    safe.id,
  ];

  for (const value of candidates) {
    const tid = String(value ?? "").trim();
    if (!tid) continue;
    return tid;
  }

  return "";
}

function dispatchThreadsRefresh(detail: Record<string, unknown>) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("hopy:threads-refresh", { detail }));
  } catch {}
}

function shouldAdoptResolvedThreadId(args: {
  currentThreadId: string;
  pendingThreadId: string;
  resolvedThreadId: string;
}) {
  const current = String(args.currentThreadId ?? "").trim();
  const pending = String(args.pendingThreadId ?? "").trim();
  const resolved = String(args.resolvedThreadId ?? "").trim();

  if (!canUseResolvedThreadId(resolved)) return false;
  if (current === resolved) return true;
  if (!current) return true;
  if (isTemporaryGuestThreadId(current)) return true;
  if (!pending) return false;
  return current === pending;
}

export function useChatThreadCreation(params: Params) {
  const {
    displayLoggedIn,
    activeThreadIdRef,
    setThreadBusy,
    setUserStateErr,
    setActiveThreadId,
    setVisibleCount,
  } = params;

  const ensureThreadInflightRef = useRef(false);
  const lastResolvedThreadIdRef = useRef("");
  const pendingThreadTargetRef = useRef("");

  const applyPendingThreadTarget = useCallback(
    (threadId: string) => {
      if (!displayLoggedIn) return;

      const tid = String(threadId ?? "").trim();
      if (!tid) return;

      pendingThreadTargetRef.current = tid;
      lastResolvedThreadIdRef.current = "";

      if (!isPendingCreationTarget(tid)) return;

      const current = String(activeThreadIdRef.current ?? "").trim();
      if (current === tid) return;

      activeThreadIdRef.current = tid;
      setActiveThreadId(tid);
      setVisibleCount(200);
      setUserStateErr(null);
    },
    [
      displayLoggedIn,
      activeThreadIdRef,
      setActiveThreadId,
      setVisibleCount,
      setUserStateErr,
    ],
  );

  useEffect(() => {
    if (!displayLoggedIn) return;

    const handleCreateThread = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      const pendingThreadId = resolvePendingThreadIdFromDetail(detail);
      if (!pendingThreadId) return;
      applyPendingThreadTarget(pendingThreadId);
    };

    const handleWorkspaceClear = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      const pendingThreadId = resolvePendingThreadIdFromDetail(detail);
      if (!pendingThreadId) return;
      applyPendingThreadTarget(pendingThreadId);
    };

    window.addEventListener(
      "hopy:create-thread",
      handleCreateThread as EventListener,
    );
    window.addEventListener(
      "hopy:workspace-clear",
      handleWorkspaceClear as EventListener,
    );

    return () => {
      window.removeEventListener(
        "hopy:create-thread",
        handleCreateThread as EventListener,
      );
      window.removeEventListener(
        "hopy:workspace-clear",
        handleWorkspaceClear as EventListener,
      );
    };
  }, [displayLoggedIn, applyPendingThreadTarget]);

  const waitForUsableThreadId = useCallback(
    async (tries: number, delayMs: number): Promise<string | null> => {
      for (let i = 0; i < tries; i += 1) {
        await sleep(delayMs);

        const tid = String(activeThreadIdRef.current ?? "").trim();
        if (canUseResolvedThreadId(tid)) {
          return tid;
        }
      }

      return null;
    },
    [activeThreadIdRef],
  );

  const ensureThreadId = useCallback(async (): Promise<string | null> => {
    if (!displayLoggedIn) return null;

    const current = String(activeThreadIdRef.current ?? "").trim();

    if (canUseResolvedThreadId(current)) {
      return current;
    }

    if (isTemporaryGuestThreadId(current)) {
      return null;
    }

    if (ensureThreadInflightRef.current) {
      return waitForUsableThreadId(30, 20);
    }

    ensureThreadInflightRef.current = true;

    try {
      setThreadBusy(true);
      return await waitForUsableThreadId(8, 18);
    } catch (e: any) {
      setUserStateErr(errText(e));
      return null;
    } finally {
      ensureThreadInflightRef.current = false;
      try {
        setThreadBusy(false);
      } catch {}
    }
  }, [
    displayLoggedIn,
    activeThreadIdRef,
    waitForUsableThreadId,
    setThreadBusy,
    setUserStateErr,
  ]);

  const onThreadIdResolved = useCallback(
    (id: string) => {
      if (!displayLoggedIn) return;

      const tid = String(id ?? "").trim();
      if (!canUseResolvedThreadId(tid)) return;

      const current = String(activeThreadIdRef.current ?? "").trim();
      const pendingThreadId = pendingThreadTargetRef.current.trim();
      const lastResolved = lastResolvedThreadIdRef.current.trim();

      if (lastResolved === tid && current === tid) return;

      if (
        !shouldAdoptResolvedThreadId({
          currentThreadId: current,
          pendingThreadId,
          resolvedThreadId: tid,
        })
      ) {
        if (pendingThreadId && current !== pendingThreadId) {
          pendingThreadTargetRef.current = "";
        }
        return;
      }

      pendingThreadTargetRef.current = "";
      lastResolvedThreadIdRef.current = tid;
      activeThreadIdRef.current = tid;
      setActiveThreadId(tid);
      setVisibleCount(200);
      setUserStateErr(null);

      dispatchThreadsRefresh({
        reason: "thread-resolved",
        id: tid,
        threadId: tid,
        thread_id: tid,
      });
    },
    [
      displayLoggedIn,
      activeThreadIdRef,
      setActiveThreadId,
      setVisibleCount,
      setUserStateErr,
    ],
  );

  return {
    ensureThreadId,
    onThreadIdResolved,
  };
}

/*
このファイルの正式役割：
新規スレッド作成後に確定した thread_id を active として採用し、
その thread を現在の表示対象へ切り替えるためのフック。
また、新規チャット押下直後の pending target を active として受け取り、
blank stage へ入るための表示対象切替も担当する。
本文の直接読込・merge・反映は持たない。
*/

/*
【今回このファイルで修正したこと】
1. pendingThreadTargetRef が temporary id 以外の clientRequestId も保持できるようにしました。
2. activeThreadId が空、または temporary id のままの場合でも、実DBの resolved thread_id を active として採用できるようにしました。
3. resolvedThreadId が temporary id の場合は採用しないように、onThreadIdResolved 側も canUseResolvedThreadId() で統一しました。
4. 新規チャット送信後、本文側の実 thread_id と左カラムの activeThreadId が一致しやすい経路へ戻しました。
5. 本文読込、送信本体、HOPY回答○、Compass、confirmed payload、DB保存/復元、state 1..5 の唯一の正には触っていません。
*/

/* /components/chat/lib/useChatThreadCreation.ts */