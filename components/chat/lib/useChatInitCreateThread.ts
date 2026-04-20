// /components/chat/lib/useChatInitCreateThread.ts
"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import type { Lang, Thread, ChatMsg } from "./chatTypes";
import { ensureActiveThread } from "./threadApi";
import {
  sortThreadsByUpdatedDesc,
  mergeThreadsPreferNewer,
} from "./useChatInitThreadList";
import { isSessionUsable, getSessionWithRetry } from "./useChatInitSession";
import { clearStoredActiveThreadId } from "./useChatInitActiveThread";
import {
  logInfo,
  logWarn,
  errText,
  getCustomDetail,
} from "./useChatInitUtils";

export type UseChatInitCreateThreadParams<TState> = {
  uiLang: Lang;

  setMessages: Dispatch<SetStateAction<ChatMsg[]>>;
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  setVisibleCount: Dispatch<SetStateAction<number>>;

  setLastFailed: (v: any | null) => void;

  setUserStateErr: (v: string | null) => void;
};

export function resolveClientRequestIdForCreate(args: {
  incomingId: string;
  requestedForceCreate: boolean;
  forceCreateNextThreadRef: MutableRefObject<boolean>;
  createRequestRef: MutableRefObject<{ id: string; at: number }>;
  CREATE_REQ_REUSE_MS: number;
}): string {
  const {
    incomingId,
    requestedForceCreate,
    forceCreateNextThreadRef,
    createRequestRef,
    CREATE_REQ_REUSE_MS,
  } = args;

  try {
    if (incomingId) {
      createRequestRef.current = { id: incomingId, at: Date.now() };
      return incomingId;
    }

    if (requestedForceCreate || forceCreateNextThreadRef.current) {
      const prev = createRequestRef.current;
      const age = Date.now() - (prev.at || 0);

      if (prev.id && age >= 0 && age <= CREATE_REQ_REUSE_MS) {
        return prev.id;
      }
    }
  } catch {}

  return "";
}

export function createMergeSetThreads(args: {
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  titleFallback: string;
}): Dispatch<SetStateAction<Thread[]>> {
  const { setThreads, titleFallback } = args;

  return (next) => {
    try {
      if (typeof next === "function") {
        setThreads(next);
        return;
      }

      const nextList = Array.isArray(next) ? (next as Thread[]) : [];

      setThreads((prev) =>
        sortThreadsByUpdatedDesc(
          mergeThreadsPreferNewer(
            Array.isArray(prev) ? prev : [],
            nextList,
            titleFallback,
          ),
        ),
      );
    } catch {
      try {
        if (typeof next === "function") {
          setThreads(next);
        } else {
          setThreads(Array.isArray(next) ? (next as Thread[]) : []);
        }
      } catch {}
    }
  };
}

export function resetForForcedCreate<TState>(args: {
  forceCreateNextThreadRef: MutableRefObject<boolean>;
  params: UseChatInitCreateThreadParams<TState>;
}) {
  const { forceCreateNextThreadRef, params } = args;

  forceCreateNextThreadRef.current = false;

  try {
    params.setMessages([]);
    params.setVisibleCount(200);
    params.setLastFailed(null);
    params.setUserStateErr(null);
  } catch {}

  clearStoredActiveThreadId();
}

export async function ensureForcedActiveThread<TState>(args: {
  supabase: SupabaseClient<any>;
  sortedList: Thread[];
  uiLang: Lang;
  setActiveThreadIdSafe: (v: string | null) => void;
  params: UseChatInitCreateThreadParams<TState>;
  titleFallback: string;
  clientRequestIdForCreate: string;
}): Promise<string | null> {
  const {
    supabase,
    sortedList,
    uiLang,
    setActiveThreadIdSafe,
    params,
    titleFallback,
    clientRequestIdForCreate,
  } = args;

  const mergeSetThreads = createMergeSetThreads({
    setThreads: params.setThreads,
    titleFallback,
  });

  try {
    const r = await ensureActiveThread({
      supabase,
      list: sortedList,
      uiLang,
      setActiveThreadId: (v: string | null) => setActiveThreadIdSafe(v),
      setThreads: mergeSetThreads,
      forceCreate: true,
      clientRequestId: clientRequestIdForCreate
        ? clientRequestIdForCreate
        : undefined,
    });

    if (r.ok) {
      return r.id;
    }

    params.setUserStateErr(`thread create failed: ${String(r.error ?? "unknown")}`);
    return null;
  } catch (e) {
    logWarn("[useChatInit] ensureActiveThread error", e);
    params.setUserStateErr(`thread create failed: ${errText(e)}`);
    return null;
  }
}

export function createCreateThreadHandler(args: {
  isAlive: () => boolean;
  supabase: SupabaseClient<any>;

  initSeqRef: MutableRefObject<number>;

  forceCreateNextThreadRef: MutableRefObject<boolean>;

  lastCreateEventAtRef: MutableRefObject<number>;
  CREATE_EVENT_DEDUPE_MS: number;

  createInFlightRef: MutableRefObject<boolean>;

  createRequestRef: MutableRefObject<{ id: string; at: number }>;

  init: (
    force?: boolean,
    sessionHint?: Session | null,
    forceClientRequestId?: string,
  ) => Promise<void>;
}): EventListener {
  const {
    isAlive,
    supabase,

    initSeqRef,

    forceCreateNextThreadRef,

    lastCreateEventAtRef,
    CREATE_EVENT_DEDUPE_MS,

    createInFlightRef,

    createRequestRef,

    init,
  } = args;

  return (ev) => {
    if (!isAlive()) return;

    const d = getCustomDetail(ev);
    const incomingClientRequestId = String((d as any)?.clientRequestId ?? "").trim();
    const incomingReason = String((d as any)?.reason ?? "").trim().toLowerCase();

    if (incomingReason !== "send") {
      logInfo("[useChatInit] create-thread ignored (ui-stage only)", {
        reason: incomingReason || undefined,
        clientRequestId: incomingClientRequestId || undefined,
      });
      return;
    }

    if (createInFlightRef.current) {
      try {
        const reason = String((d as any)?.reason ?? "").trim();
        logInfo("[useChatInit] create-thread ignored (in-flight)", {
          reason: reason || undefined,
          clientRequestId: incomingClientRequestId || undefined,
        });
      } catch {
        logInfo("[useChatInit] create-thread ignored (in-flight)");
      }
      return;
    }

    const now = Date.now();

    if (now - lastCreateEventAtRef.current <= CREATE_EVENT_DEDUPE_MS) {
      try {
        const reason = String((d as any)?.reason ?? "").trim();
        logInfo("[useChatInit] create-thread event ignored (deduped)", {
          reason: reason || undefined,
          clientRequestId: incomingClientRequestId || undefined,
        });
      } catch {
        logInfo("[useChatInit] create-thread event ignored (deduped)");
      }
      return;
    }

    lastCreateEventAtRef.current = now;

    if (incomingClientRequestId) {
      createRequestRef.current = {
        id: incomingClientRequestId,
        at: now,
      };
    }

    createInFlightRef.current = true;

    (async () => {
      try {
        const seq = initSeqRef.current;
        const session = await getSessionWithRetry({
          isAlive,
          initSeqRef,
          seq,
          supabase,
        });

        const user = isSessionUsable(session) ? session.user : null;

        if (!isAlive()) {
          createInFlightRef.current = false;
          return;
        }

        if (!user) {
          logWarn("[useChatInit] create-thread no session -> delegate to init retry (no reset)");
          forceCreateNextThreadRef.current = true;

          try {
            await init(true, null, incomingClientRequestId || undefined);
          } finally {
            createInFlightRef.current = false;
          }

          return;
        }

        forceCreateNextThreadRef.current = true;

        try {
          await init(true, session, incomingClientRequestId || undefined);
        } finally {
          createInFlightRef.current = false;
        }
      } catch (e) {
        createInFlightRef.current = false;
        logWarn("[useChatInit] create-thread session check failed", errText(e));
      }
    })();
  };
}

/*
このファイルの正式役割:
useChatInitParts.ts から切り出す、新規 thread 作成制御責務を担う。
clientRequestId の解決、force create 前の表示状態リセット、ensureActiveThread 呼び出し、create-thread event handler 生成だけを担当する。
profile / plan / userState 取得、threads 取得、activeThread 復元補助、messages 取得、本文表示、HOPY状態、Compass、confirmed payload の正は作らない。
*/

/*
【今回このファイルで修正したこと】
1. useChatInitParts.ts に混在している新規 thread 作成制御責務の受け皿として、新規ファイルを作成しました。
2. clientRequestId 解決を resolveClientRequestIdForCreate として分離しました。
3. ensureActiveThread 用の setThreads merge 処理を createMergeSetThreads として分離しました。
4. force create 前の表示状態リセットを resetForForcedCreate として分離しました。
5. ensureActiveThread 呼び出しを ensureForcedActiveThread として分離しました。
6. create-thread event handler 生成を createCreateThreadHandler として分離しました。
7. profile / plan / userState 取得、threads 取得、activeThread 復元補助、本文表示、送信、MEMORIES には触れていません。
8. HOPY唯一の正、confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階、DB保存・復元仕様には触れていません。
*/

/* /components/chat/lib/useChatInitCreateThread.ts */