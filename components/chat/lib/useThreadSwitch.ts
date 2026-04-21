// /components/chat/lib/useThreadSwitch.ts
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadMessages, renameThread as renameThreadApi } from "./threadApi";
import { normMsg } from "./threadApiSupport";
import { saveActiveThreadId } from "./threadStore";
import type { ChatMsg } from "./chatTypes";

type UseThreadSwitchParams = {
  supabase: SupabaseClient<any>;
  activeThreadId: string | null;
  setActiveThreadId: (v: string | null) => void;
  setThreadBusy: (v: boolean) => void;
  setMessages: Dispatch<SetStateAction<ChatMsg[]>>;
  setLastFailed?: (v: any | null) => void;
  setUserStateErr?: (v: string | null) => void;
};

function readThreadEventId(detail: any): string {
  const candidates = [
    detail?.threadId,
    detail?.thread_id,
    detail?.selectedThreadId,
    detail?.selected_thread_id,
    detail?.id,
  ];

  for (const value of candidates) {
    const tid = String(value ?? "").trim();
    if (!tid) continue;
    return tid;
  }

  return "";
}

function readPrevTitle(detail: any): string {
  return String(
    detail?.prevTitle ??
      detail?.previousTitle ??
      detail?.prev ??
      detail?.prev_title ??
      detail?.previous_title ??
      detail?.beforeTitle ??
      detail?.before_title ??
      "",
  ).trim();
}

function isUuidLikeThreadId(value: string) {
  const v = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}

function buildRenameFailureDetail(id: string, prevTitle?: string) {
  const prev = String(prevTitle ?? "").trim();
  if (prev) {
    return {
      reason: "rename-rollback",
      id,
      threadId: id,
      title: prev,
      prevTitle: prev,
    };
  }

  return {
    reason: "rename-failed",
    id,
    threadId: id,
  };
}

function dispatchThreadsRefresh(detail: any) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("hopy:threads-refresh", { detail }));
  } catch {}
}

export function useThreadSwitch(params: UseThreadSwitchParams) {
  const {
    supabase,
    activeThreadId,
    setActiveThreadId,
    setThreadBusy,
    setUserStateErr,
  } = params;

  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const mountedRef = useRef(true);
  const switchSeqRef = useRef(0);
  const activeThreadIdRef = useRef<string | null>(activeThreadId);
  const renameSeqByThreadRef = useRef<Record<string, number>>({});

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  const setThreadBusySafe = useCallback((next: boolean) => {
    try {
      paramsRef.current.setThreadBusy(next);
    } catch {}
  }, []);

  const loadSelectedThreadMessages = useCallback(
    (threadId: string) => {
      const nextId = String(threadId ?? "").trim();
      if (!isUuidLikeThreadId(nextId)) return;

      let disposed = false;
      const seq = ++switchSeqRef.current;

      const isCurrentRequestForSelectedThread = () => {
        if (!mountedRef.current) return false;
        if (disposed) return false;
        if (seq !== switchSeqRef.current) return false;
        return String(activeThreadIdRef.current ?? "").trim() === nextId;
      };

      const run = async () => {
        setThreadBusySafe(true);

        try {
          paramsRef.current.setLastFailed?.(null);
          paramsRef.current.setUserStateErr?.(null);

          const loadedMessages = await loadMessages(
            paramsRef.current.supabase,
            nextId,
          );

          if (!isCurrentRequestForSelectedThread()) return;

          paramsRef.current.setMessages(
            Array.isArray(loadedMessages) ? loadedMessages : [],
          );
        } catch (e) {
          if (!isCurrentRequestForSelectedThread()) return;
          paramsRef.current.setUserStateErr?.(
            `messages load failed: ${normMsg(e)}`,
          );
        } finally {
          if (mountedRef.current && seq === switchSeqRef.current) {
            setThreadBusySafe(false);
          }
        }
      };

      void run();

      return () => {
        disposed = true;
      };
    },
    [setThreadBusySafe],
  );

  const selectThread = useCallback(
    (id: string) => {
      const nextId = String(id ?? "").trim();
      if (!isUuidLikeThreadId(nextId)) return;

      const prevId = String(activeThreadIdRef.current ?? "").trim();

      activeThreadIdRef.current = nextId;
      saveActiveThreadId(nextId);

      if (nextId !== prevId) {
        setActiveThreadId(nextId);
        return;
      }

      loadSelectedThreadMessages(nextId);
    },
    [loadSelectedThreadMessages, setActiveThreadId],
  );

  const renameThread = useCallback(
    async (threadId: string, nextTitle: string, prevTitle?: string) => {
      const id = String(threadId ?? "").trim();
      const titleRaw = String(nextTitle ?? "").trim();

      if (!id) return;
      if (!titleRaw) return;
      if (!isUuidLikeThreadId(id)) return;

      const title = titleRaw.length > 120 ? titleRaw.slice(0, 120) : titleRaw;

      const nextSeq = (renameSeqByThreadRef.current[id] ?? 0) + 1;
      renameSeqByThreadRef.current[id] = nextSeq;

      try {
        setThreadBusy(true);
      } catch {}

      try {
        setUserStateErr?.(null);

        const { data: sess } = await supabase.auth.getSession();
        const user = sess.session?.user;
        if (!user) {
          dispatchThreadsRefresh(buildRenameFailureDetail(id, prevTitle));
          setUserStateErr?.("rename failed: no session");
          return;
        }

        const r = await renameThreadApi({
          supabase,
          threadId: id,
          nextTitle: title,
        });

        if (renameSeqByThreadRef.current[id] !== nextSeq) return;

        if (!r || typeof r !== "object" || !(r as any).ok) {
          const msg =
            String((r as any)?.error ?? "rename failed").trim() ||
            "rename failed";

          dispatchThreadsRefresh(buildRenameFailureDetail(id, prevTitle));
          setUserStateErr?.(`rename failed: ${msg}`);
          return;
        }

        const th: any = (r as any).thread ?? null;
        const outId = String(th?.id ?? id).trim();
        const outTitle = String(th?.title ?? title).trim();
        const outUpdated = String(th?.updated_at ?? "").trim();

        const payload: any = {
          reason: "rename",
          id: outId,
          threadId: outId,
          title: outTitle,
        };
        if (outUpdated) payload.updated_at = outUpdated;

        dispatchThreadsRefresh(payload);
      } catch (e) {
        if (renameSeqByThreadRef.current[id] !== nextSeq) return;

        dispatchThreadsRefresh(buildRenameFailureDetail(id, prevTitle));
        setUserStateErr?.(`rename failed: ${normMsg(e)}`);
      } finally {
        if (renameSeqByThreadRef.current[id] === nextSeq) {
          try {
            setThreadBusy(false);
          } catch {}
        }
      }
    },
    [setThreadBusy, setUserStateErr, supabase],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onSelectThread = (e: any) => {
      try {
        const d = e?.detail ?? {};
        const id = readThreadEventId(d);
        if (!id) return;
        selectThread(id);
      } catch {}
    };

    window.addEventListener("hopy:select-thread", onSelectThread as any);

    return () => {
      window.removeEventListener("hopy:select-thread", onSelectThread as any);
    };
  }, [selectThread]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onRenameThread = (e: any) => {
      try {
        const d = e?.detail ?? {};
        const id = readThreadEventId(d);
        const title = String(d.title ?? "").trim();
        const prevTitle = readPrevTitle(d);

        if (!id || !title) return;
        void renameThread(id, title, prevTitle || undefined);
      } catch {}
    };

    window.addEventListener("hopy:rename-thread", onRenameThread as any);

    return () => {
      window.removeEventListener("hopy:rename-thread", onRenameThread as any);
    };
  }, [renameThread]);

  useEffect(() => {
    const nextId = String(activeThreadId ?? "").trim();
    activeThreadIdRef.current = nextId || null;
    if (!nextId) return;

    return loadSelectedThreadMessages(nextId);
  }, [activeThreadId, loadSelectedThreadMessages]);

  return { selectThread };
}

/*
このファイルの正式役割
スレッド切替専用フック。
hopy:select-thread で渡された thread_id を受け取り、
activeThreadId 更新と、その activeThreadId に基づく
messages 再読込開始・現在要求かどうかの確認・反映までを行う。
あわせて rename-thread を受けた rename 連携だけを行う。
このファイルは hopy:thread を受けない。
他タブ復帰時の可視状態監視は持たない。
表示責務や HOPY唯一の正の再判定を持たない。
*/

/*
【今回このファイルで修正したこと】
1. MESSAGES_READ_TIMEOUT_MS を削除しました。
2. withTimeout() を削除しました。
3. readMessagesOnce() を削除しました。
4. timeout 時に messages を空配列へ落とす処理を削除しました。
5. loadMessages() の結果だけを、現在選択中の thread に一致した場合に setMessages へ反映する形へ戻しました。
6. profile / plan 取得、threads取得、送信、MEMORIES には触れていません。
7. confirmed payload、state_changed、HOPY回答○、Compass、DB保存/復元、状態1..5 の唯一の正には触れていません。
*/

/* /components/chat/lib/useThreadSwitch.ts */