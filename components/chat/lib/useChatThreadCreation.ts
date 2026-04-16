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

function shouldAdoptResolvedThreadId(args: {
  currentThreadId: string;
  pendingThreadId: string;
  resolvedThreadId: string;
}) {
  const current = String(args.currentThreadId ?? "").trim();
  const pending = String(args.pendingThreadId ?? "").trim();
  const resolved = String(args.resolvedThreadId ?? "").trim();

  if (!resolved) return false;
  if (current === resolved) return true;
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
      if (!isPendingCreationTarget(tid)) return;

      pendingThreadTargetRef.current = tid;
      lastResolvedThreadIdRef.current = "";

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
      if (!tid) return;

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
1. pending target は temporary id だけを採用するように絞りました。
2. pendingThreadTargetRef を追加し、新規チャット起点の一時 target をこのファイル内で1つだけ保持するようにしました。
3. onThreadIdResolved は、現在の表示 target がその pending target と一致している場合だけ resolved thread_id を採用するようにしました。
4. これにより、遅れて返ってきた旧作成結果が通常のスレッド選択を上書きしにくい形へ戻しました。
5. HOPY回答○、Compass、confirmed payload、DB保存/復元、state 1..5 の唯一の正には触っていません。
*/

/* /components/chat/lib/useChatThreadCreation.ts */