// /components/chat/lib/useChatThreadEvents.ts
"use client";

import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lang, Thread } from "./chatTypes";
import { deleteThread as deleteThreadApi } from "./threadApi";
import { clearActiveThreadId, saveActiveThreadId } from "./threadStore";
import {
  dedupeThreadsById,
  normalizeThreadCandidate,
  sortThreadsPreferUpdatedAtDesc,
} from "./threadUtils";

type Params = {
  supabase: SupabaseClient;
  uiLang: Lang;
  loggedInRef: React.MutableRefObject<boolean>;
  threads: Thread[];
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
  activeThreadIdRef: React.MutableRefObject<string | null>;
  setActiveThreadId: React.Dispatch<React.SetStateAction<string | null>>;
  setThreadBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setUserStateErr: React.Dispatch<React.SetStateAction<string | null>>;
};

type ThreadEventDetail = Record<string, unknown>;

function asDetail(source: unknown): ThreadEventDetail {
  return (source ?? {}) as ThreadEventDetail;
}

function readEventDetail(event: Event): ThreadEventDetail {
  return asDetail((event as CustomEvent)?.detail);
}

function isUuidLikeThreadId(value: string) {
  const v = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}

function readThreadId(source: unknown): string {
  const safe = asDetail(source);
  return String(safe.threadId ?? safe.thread_id ?? safe.id ?? "").trim();
}

function readThreadTitle(source: unknown): string {
  const safe = asDetail(source);
  return String(safe.title ?? safe.name ?? "").trim();
}

function readPrevTitle(source: unknown): string {
  const safe = asDetail(source);
  return String(
    safe.prevTitle ??
      safe.previousTitle ??
      safe.prev ??
      safe.prev_title ??
      safe.previous_title ??
      safe.beforeTitle ??
      safe.before_title ??
      "",
  ).trim();
}

function readUpdatedAt(source: unknown): string {
  const safe = asDetail(source);
  return String(
    safe.updated_at ??
      safe.updatedAt ??
      safe.state_updated_at ??
      safe.stateUpdatedAt ??
      "",
  ).trim();
}

function readReason(source: unknown): string {
  return String(asDetail(source).reason ?? "").trim();
}

function isDeletePayload(source: unknown): boolean {
  const safe = asDetail(source);
  const reason = readReason(source).toLowerCase();

  return (
    Boolean(safe.deleted) ||
    Boolean(safe.isDeleted) ||
    Boolean(safe.removed) ||
    Boolean(safe.isRemoved) ||
    reason.includes("delete") ||
    reason.includes("removed")
  );
}

function normalizeOneThread(source: unknown, titleFallback: string): Thread | null {
  const normalized = normalizeThreadCandidate(source, titleFallback);
  if (!normalized) return null;

  const id = String((normalized as any)?.id ?? "").trim();
  if (!id || !isUuidLikeThreadId(id)) return null;

  const title = String((normalized as any)?.title ?? "").trim() || titleFallback;
  const updatedAt =
    readUpdatedAt(source) || String((normalized as any)?.updated_at ?? "").trim();

  return {
    ...(normalized as any),
    id,
    title,
    ...(updatedAt ? { updated_at: updatedAt } : {}),
  } as Thread;
}

function mergeThreadItem(prevThread: Thread, nextThread: Thread): Thread {
  return {
    ...(prevThread as any),
    ...(nextThread as any),
    id: String((nextThread as any)?.id ?? (prevThread as any)?.id ?? "").trim(),
    title:
      String((nextThread as any)?.title ?? "").trim() ||
      String((prevThread as any)?.title ?? "").trim(),
  } as Thread;
}

function upsertThread(prev: Thread[], source: unknown, titleFallback: string): Thread[] {
  const normalized = normalizeOneThread(source, titleFallback);
  if (!normalized) return prev;

  const targetId = String((normalized as any)?.id ?? "").trim();
  let found = false;

  const next = prev.map((thread) => {
    const threadId = String((thread as any)?.id ?? "").trim();
    if (threadId !== targetId) return thread;
    found = true;
    return mergeThreadItem(thread, normalized);
  });

  if (!found) {
    next.unshift(normalized);
  }

  return sortThreadsPreferUpdatedAtDesc(dedupeThreadsById(next));
}

function mergeThreadList(prev: Thread[], incoming: Thread[]): Thread[] {
  const map = new Map<string, Thread>();

  for (const thread of prev) {
    const id = String((thread as any)?.id ?? "").trim();
    if (!id) continue;
    map.set(id, thread);
  }

  for (const thread of incoming) {
    const id = String((thread as any)?.id ?? "").trim();
    if (!id) continue;

    const before = map.get(id);
    map.set(id, before ? mergeThreadItem(before, thread) : thread);
  }

  return sortThreadsPreferUpdatedAtDesc(dedupeThreadsById(Array.from(map.values())));
}

function readProvidedThreadList(source: unknown, titleFallback: string): Thread[] | null {
  const safe = asDetail(source);
  const candidates = [safe.threads, safe.items, safe.list];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    const normalized = candidate
      .map((item) => normalizeOneThread(item, titleFallback))
      .filter(Boolean) as Thread[];

    return sortThreadsPreferUpdatedAtDesc(dedupeThreadsById(normalized));
  }

  return null;
}

function removeThreadById(prev: Thread[], threadId: string): Thread[] {
  return prev.filter((thread) => String((thread as any)?.id ?? "").trim() !== threadId);
}

function clearSelectedThreadState(params: {
  activeThreadIdRef: React.MutableRefObject<string | null>;
  setActiveThreadId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  clearActiveThreadId();
  params.activeThreadIdRef.current = null;
  params.setActiveThreadId(null);
}

function applySelectedThreadState(params: {
  threadId: string;
  activeThreadIdRef: React.MutableRefObject<string | null>;
  setActiveThreadId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  saveActiveThreadId(params.threadId);
  params.activeThreadIdRef.current = params.threadId;
  params.setActiveThreadId(params.threadId);
}

export function useChatThreadEvents({
  supabase,
  uiLang,
  loggedInRef,
  threads,
  setThreads,
  activeThreadIdRef,
  setActiveThreadId,
  setThreadBusy,
  setUserStateErr,
}: Params) {
  const threadsRef = useRef<Thread[]>([]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onWorkspaceClear = (e: Event) => {
      if (!loggedInRef.current) return;

      const detail = readEventDetail(e);
      const reason = readReason(detail);

      if (reason !== "ui:create-thread") return;

      clearSelectedThreadState({
        activeThreadIdRef,
        setActiveThreadId,
      });
    };

    window.addEventListener("hopy:workspace-clear", onWorkspaceClear as EventListener);
    return () => {
      window.removeEventListener(
        "hopy:workspace-clear",
        onWorkspaceClear as EventListener,
      );
    };
  }, [activeThreadIdRef, loggedInRef, setActiveThreadId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const titleFallback = uiLang === "en" ? "New chat" : "新規チャット";

    const onThreadsRefresh = (e: Event) => {
      if (!loggedInRef.current) return;

      const detail = readEventDetail(e);
      const provided = readProvidedThreadList(detail, titleFallback);

      if (provided) {
        setThreads((prev) => mergeThreadList(prev, provided));
        return;
      }

      const id = readThreadId(detail);
      if (!id || !isUuidLikeThreadId(id)) return;

      if (isDeletePayload(detail)) {
        setThreads((prev) => removeThreadById(prev, id));
        return;
      }

      const reason = readReason(detail);
      const title = readThreadTitle(detail);
      const prevTitle = readPrevTitle(detail);
      const updatedAt = readUpdatedAt(detail);

      if (reason.includes("rollback") && prevTitle) {
        setThreads((prev) =>
          upsertThread(
            prev,
            {
              ...detail,
              id,
              title: prevTitle,
              updated_at: updatedAt,
            },
            titleFallback,
          ),
        );
        return;
      }

      setThreads((prev) =>
        upsertThread(
          prev,
          {
            ...detail,
            id,
            ...(title ? { title } : {}),
            ...(updatedAt ? { updated_at: updatedAt } : {}),
          },
          titleFallback,
        ),
      );
    };

    window.addEventListener("hopy:threads-refresh", onThreadsRefresh as EventListener);
    return () => {
      window.removeEventListener(
        "hopy:threads-refresh",
        onThreadsRefresh as EventListener,
      );
    };
  }, [loggedInRef, setThreads, uiLang]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onDeleteThread = async (e: Event) => {
      if (!loggedInRef.current) return;

      const detail = readEventDetail(e);
      const threadId = readThreadId(detail);
      if (!threadId || !isUuidLikeThreadId(threadId)) return;

      setThreadBusy(true);

      const currentThreads = threadsRef.current;
      const removedThread =
        currentThreads.find(
          (thread) => String((thread as any)?.id ?? "").trim() === threadId,
        ) ?? null;
      const remainingThreads = removeThreadById(currentThreads, threadId);
      const nextThreadId = String((remainingThreads[0] as any)?.id ?? "").trim() || null;
      const wasActive = String(activeThreadIdRef.current ?? "").trim() === threadId;

      const rollbackDeletedThread = (message: string) => {
        setUserStateErr(message || "thread_delete_failed");

        if (removedThread) {
          setThreads((prev) => mergeThreadList(prev, [removedThread]));
        }

        if (!wasActive || !removedThread) return;

        const rollbackId = String((removedThread as any)?.id ?? "").trim();
        if (!rollbackId) return;

        applySelectedThreadState({
          threadId: rollbackId,
          activeThreadIdRef,
          setActiveThreadId,
        });
      };

      setThreads((prev) => removeThreadById(prev, threadId));

      if (wasActive) {
        clearSelectedThreadState({
          activeThreadIdRef,
          setActiveThreadId,
        });
      }

      try {
        const result = await deleteThreadApi({
          supabase,
          threadId,
        } as any);

        if (!result?.ok) {
          const msg = String((result as any)?.error ?? "thread_delete_failed").trim();
          rollbackDeletedThread(msg);
          return;
        }

        if (wasActive && nextThreadId) {
          applySelectedThreadState({
            threadId: nextThreadId,
            activeThreadIdRef,
            setActiveThreadId,
          });
        }
      } catch (err: any) {
        const msg = String(err?.message ?? err ?? "thread_delete_failed").trim();
        rollbackDeletedThread(msg);
      } finally {
        setThreadBusy(false);
      }
    };

    window.addEventListener("hopy:delete-thread", onDeleteThread as EventListener);
    return () => {
      window.removeEventListener(
        "hopy:delete-thread",
        onDeleteThread as EventListener,
      );
    };
  }, [
    activeThreadIdRef,
    loggedInRef,
    setActiveThreadId,
    setThreadBusy,
    setThreads,
    setUserStateErr,
    supabase,
  ]);
}

/*
このファイルの正式役割
thread 系カスタムイベントを受け取り、
threads 一覧の更新と delete 後の activeThreadId 更新へつなぐことだけを担う。
このファイルは hopy:select-thread を受けない。
本文表示判定をしない。
messages / visibleCount の表示責務を持たない。
保険のための二重イベント監視や二重反映を持たない。
削除イベントでは thread 削除実行と、その結果に応じた
threads / activeThreadId の更新だけを行う。
*/

/*
【今回このファイルで修正したこと】
1. Params から未使用だった setMessages 契約を削除しました。
2. Params から未使用だった setVisibleCount 契約を削除しました。
3. Params から未使用だった noteThreadDecision 契約を削除しました。
4. chatTypes import から未使用だった ChatMsg を削除しました。
5. このファイルの責務を、thread event 受信と threads / activeThreadId 更新だけにさらに固定しました。
6. 本文採用 / HOPY唯一の正 / state 1..5 / Compass / DB保存復元には触っていません。
*/

/* /components/chat/lib/useChatThreadEvents.ts */