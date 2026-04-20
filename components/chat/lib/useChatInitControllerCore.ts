// /components/chat/lib/useChatInitControllerCore.ts
"use client";

import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import type { ChatMsg, Lang, Thread } from "./chatTypes";
import {
  sortThreadsByUpdatedDesc,
  mergeThreadsPreferNewer,
} from "./useChatInitThreadList";
import { isSessionUsable, getSessionWithRetry } from "./useChatInitSession";
import { fetchUserStateOnly } from "./useChatInitUserState";
import { fetchThreadsWithRetry } from "./useChatInitThreads";
import {
  resolveActiveThreadTarget,
  pickInitialThreadId,
  persistActiveThreadId,
  clearStoredActiveThreadId,
} from "./useChatInitActiveThread";
import {
  resolveClientRequestIdForCreate,
  resetForForcedCreate,
  ensureForcedActiveThread,
  createCreateThreadHandler,
} from "./useChatInitCreateThread";
import {
  logInfo,
  logWarn,
  microtask,
} from "./useChatInitUtils";

export type UseChatInitParams<TState> = {
  supabase: SupabaseClient<any>;
  uiLang: Lang;

  setEmail: (v: string) => void;
  setMessages: Dispatch<SetStateAction<ChatMsg[]>>;
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  setActiveThreadId: (v: string | null) => void;
  setVisibleCount: Dispatch<SetStateAction<number>>;

  setLastFailed: (v: any | null) => void;

  setUserState: (v: TState | null) => void;
  setUserStateErr: (v: string | null) => void;

  normalizeState: (x: any) => TState | null;

  scrollToBottom: (behavior?: ScrollBehavior | "auto" | "smooth") => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
};

export type PendingInit = {
  force: boolean;
  sessionHint?: Session | null;
  clientRequestId?: string;
};

export type InitControllerArgs<TState> = {
  isAlive: () => boolean;

  supabase: SupabaseClient<any>;
  uiLang: Lang;

  paramsRef: MutableRefObject<UseChatInitParams<TState>>;

  initSeqRef: MutableRefObject<number>;
  lastUserIdRef: MutableRefObject<string | null>;

  activeThreadIdShadowRef: MutableRefObject<string | null>;
  setActiveThreadIdSafe: (v: string | null) => void;

  initRunningRef: MutableRefObject<boolean>;
  lastInitAtRef: MutableRefObject<number>;
  initDebounceTimerRef: MutableRefObject<number | null>;

  forceCreateNextThreadRef: MutableRefObject<boolean>;
  pendingInitRef: MutableRefObject<PendingInit | null>;

  lastCreateEventAtRef: MutableRefObject<number>;
  CREATE_EVENT_DEDUPE_MS: number;

  createInFlightRef: MutableRefObject<boolean>;

  createRequestRef: MutableRefObject<{ id: string; at: number }>;
  CREATE_REQ_REUSE_MS: number;

  threadMutationSeqRef: MutableRefObject<number>;
  lastThreadMutationAtRef: MutableRefObject<number>;

  dispatchThreadEvent: (
    threadId: string,
    reason: string,
    source?: "event" | "storage" | "direct" | "unknown",
  ) => void;

  reset: () => void;
  softAuthLost: () => void;

  lastResumeAtRef: MutableRefObject<number>;
  RESUME_DEDUPE_MS: number;
};

export function createInitController<TState>(args: InitControllerArgs<TState>) {
  const {
    isAlive,
    supabase,
    uiLang,
    paramsRef,

    initSeqRef,
    lastUserIdRef,

    activeThreadIdShadowRef,
    setActiveThreadIdSafe,

    initRunningRef,
    lastInitAtRef,
    initDebounceTimerRef,

    forceCreateNextThreadRef,
    pendingInitRef,

    lastCreateEventAtRef,
    CREATE_EVENT_DEDUPE_MS,

    createInFlightRef,

    createRequestRef,
    CREATE_REQ_REUSE_MS,

    dispatchThreadEvent,
  } = args;

  const INIT_RUNNING_STALE_MS = 15_000;

  const clearInitDebounceTimer = () => {
    const t = initDebounceTimerRef.current;
    if (t != null) {
      initDebounceTimerRef.current = null;
      try {
        window.clearTimeout(t);
      } catch {}
    }
  };

  const readPendingInit = (): PendingInit | null => {
    return pendingInitRef.current;
  };

  const init = async (
    force = false,
    sessionHint?: Session | null,
    forceClientRequestId?: string,
  ) => {
    const p = paramsRef.current;

    const incomingId = String(forceClientRequestId ?? "").trim();
    const requestedForceCreate = Boolean(force);
    const now = Date.now();

    const queuePendingInit = (next: PendingInit) => {
      const prev = readPendingInit();
      pendingInitRef.current = {
        force: Boolean(prev?.force || next.force),
        sessionHint: next.sessionHint ?? prev?.sessionHint ?? null,
        clientRequestId: next.clientRequestId || prev?.clientRequestId,
      };
    };

    const schedulePendingInit = (delayMs: number) => {
      clearInitDebounceTimer();

      try {
        initDebounceTimerRef.current = window.setTimeout(() => {
          initDebounceTimerRef.current = null;

          if (!isAlive()) return;

          if (initRunningRef.current) return;

          const pending = pendingInitRef.current;
          if (!pending) return;

          pendingInitRef.current = null;

          logInfo("[useChatInit] init fire (scheduled)", {
            force: Boolean(pending.force),
            clientRequestId: pending.clientRequestId || undefined,
          });

          init(Boolean(pending.force), pending.sessionHint, pending.clientRequestId);
        }, Math.max(0, delayMs));
      } catch {}
    };

    if (initRunningRef.current) {
      const runningAgeMs = Math.max(0, now - (lastInitAtRef.current || 0));

      if (!requestedForceCreate && runningAgeMs > INIT_RUNNING_STALE_MS) {
        logWarn("[useChatInit] init running stale -> restart", {
          runningAgeMs,
          clientRequestId: incomingId || undefined,
        });

        initRunningRef.current = false;
        clearInitDebounceTimer();
        pendingInitRef.current = null;
      } else {
        queuePendingInit({
          force: requestedForceCreate,
          sessionHint: sessionHint ?? null,
          clientRequestId: incomingId || undefined,
        });

        logInfo("[useChatInit] init queued (running)", {
          force: requestedForceCreate,
          clientRequestId: incomingId || undefined,
        });
        return;
      }
    }

    clearInitDebounceTimer();
    pendingInitRef.current = null;

    initRunningRef.current = true;
    lastInitAtRef.current = now;

    const seq = ++initSeqRef.current;

    const initHadForceCreate = Boolean(requestedForceCreate || forceCreateNextThreadRef.current);

    if (!requestedForceCreate && forceCreateNextThreadRef.current && !createInFlightRef.current) {
      logInfo("[useChatInit] drop stale force-create on passive init");
      forceCreateNextThreadRef.current = false;
    }

    const clientRequestIdForCreate = resolveClientRequestIdForCreate({
      incomingId,
      requestedForceCreate,
      forceCreateNextThreadRef,
      createRequestRef,
      CREATE_REQ_REUSE_MS,
    });

    try {
      const session = await getSessionWithRetry({
        isAlive,
        initSeqRef,
        seq,
        supabase,
        hint: sessionHint ?? null,
      });

      if (!isAlive()) return;
      if (seq !== initSeqRef.current) return;

      const user = isSessionUsable(session) ? session.user : null;

      if (!user) {
        const prev = readPendingInit();
        const hadUser = Boolean(lastUserIdRef.current);
        const retryDelayMs = hadUser ? 80 : 420;

        pendingInitRef.current = {
          force: Boolean(prev?.force || requestedForceCreate),
          sessionHint: prev?.sessionHint ?? sessionHint ?? null,
          clientRequestId: incomingId || prev?.clientRequestId,
        };

        logWarn("[useChatInit] init no session -> schedule retry (no reset)", {
          delayMs: retryDelayMs,
          hadUser,
          clientRequestId: pendingInitRef.current.clientRequestId || undefined,
        });

        schedulePendingInit(retryDelayMs);
        return;
      }

      lastUserIdRef.current = user.id;

      p.setEmail(user.email ?? "");

      await fetchUserStateOnly<TState>({
        isAlive,
        initSeqRef,
        seq,
        paramsRef,
        userId: user.id,
        sessionHint: session,
      });

      if (!isAlive()) return;
      if (seq !== initSeqRef.current) return;

      const titleFallback = p.uiLang === "en" ? "New chat" : "新規チャット";

      const tr = await fetchThreadsWithRetry<TState>({
        isAlive,
        initSeqRef,
        seq,
        supabase,
        uiLang,
        onSuccessList: (incoming) => {
          if (!isAlive()) return;
          if (seq !== initSeqRef.current) return;

          const safeIncoming = Array.isArray(incoming) ? incoming : [];

          p.setThreads((prev) =>
            sortThreadsByUpdatedDesc(
              mergeThreadsPreferNewer(
                Array.isArray(prev) ? prev : [],
                safeIncoming,
                titleFallback,
              ),
            ),
          );
        },
      });

      if (!isAlive()) return;
      if (seq !== initSeqRef.current) return;

      const wantForceCreate = requestedForceCreate;

      if (tr.ok) {
        const incoming = Array.isArray(tr.list) ? tr.list : [];

        p.setThreads((prev) =>
          sortThreadsByUpdatedDesc(
            mergeThreadsPreferNewer(
              Array.isArray(prev) ? prev : [],
              incoming,
              titleFallback,
            ),
          ),
        );
      } else if (wantForceCreate) {
        try {
          p.setThreads([]);
        } catch {}
      }

      const list = tr.ok ? tr.list : ([] as Thread[]);
      const { sortedList, currentTargetThreadId } = resolveActiveThreadTarget({
        list,
        activeThreadIdShadowRef,
      });

      if (!tr.ok && !wantForceCreate) {
        logWarn("[useChatInit] threads fetch failed -> keep idle state and retry", {
          reason: tr.error,
        });

        const prev = readPendingInit();

        pendingInitRef.current = {
          force: Boolean(prev?.force),
          sessionHint: session,
          clientRequestId: incomingId || prev?.clientRequestId,
        };

        schedulePendingInit(420);

        microtask(() => p.inputRef?.current?.focus?.());
        return;
      }

      let tid: string | null = null;

      if (wantForceCreate) {
        resetForForcedCreate<TState>({
          forceCreateNextThreadRef,
          params: p,
        });
      }

      if (wantForceCreate) {
        tid = await ensureForcedActiveThread<TState>({
          supabase,
          sortedList,
          uiLang: p.uiLang,
          setActiveThreadIdSafe,
          params: p,
          titleFallback,
          clientRequestIdForCreate,
        });
      } else if (sortedList.length > 0) {
        tid = pickInitialThreadId({
          sortedList,
          currentTargetThreadId,
        });

        if (tid) {
          try {
            setActiveThreadIdSafe(tid);
          } catch {}
        }
      }

      if (!isAlive()) return;
      if (seq !== initSeqRef.current) return;

      if (tid) {
        persistActiveThreadId(tid);

        dispatchThreadEvent(
          tid,
          wantForceCreate ? "init:create-forced" : "init:restore-existing",
          "event",
        );

        p.scrollToBottom("auto");

        logInfo("[useChatInit] ready", {
          tid,
          threads: tr.ok ? sortedList.length : "unknown",
          allowCreateNew: tr.ok ? tr.allowCreateNew : "unknown",
          forced: wantForceCreate,
          threadsOk: tr.ok,
          restoredCurrentTarget: Boolean(
            !wantForceCreate && currentTargetThreadId && tid === currentTargetThreadId,
          ),
          clientRequestId: clientRequestIdForCreate || undefined,
        });
      } else {
        try {
          setActiveThreadIdSafe(null);
          clearStoredActiveThreadId();
          p.setMessages([]);
          p.setVisibleCount(200);
        } catch {}

        logInfo("[useChatInit] stay idle (hero-first)", {
          threads: tr.ok ? sortedList.length : "unknown",
          forced: wantForceCreate,
          threadsOk: tr.ok,
          clientRequestId: clientRequestIdForCreate || undefined,
        });
      }

      microtask(() => p.inputRef?.current?.focus?.());
    } finally {
      initRunningRef.current = false;

      if (initHadForceCreate) {
        createInFlightRef.current = false;
      }

      const pending = pendingInitRef.current;

      if (pending) {
        if (initDebounceTimerRef.current != null) {
          return;
        }

        pendingInitRef.current = null;

        if (isAlive()) {
          microtask(() => {
            if (!isAlive()) return;

            logInfo("[useChatInit] init fire (pending after run)", {
              force: Boolean(pending.force),
              clientRequestId: pending.clientRequestId || undefined,
            });

            init(Boolean(pending.force), pending.sessionHint, pending.clientRequestId);
          });
        }
      }
    }
  };

  const onCreateThread = createCreateThreadHandler({
    isAlive,
    supabase,
    initSeqRef,
    forceCreateNextThreadRef,
    lastCreateEventAtRef,
    CREATE_EVENT_DEDUPE_MS,
    createInFlightRef,
    createRequestRef,
    init,
  });

  return {
    clearInitDebounceTimer,
    init,
    onCreateThread,
  };
}

/*
このファイルの正式役割:
useChatInitParts.ts から切り出す、チャット初期化コントローラー本体を担う。
session 確立後の初期化本線を持ち、profile / plan / userState、threads、activeThread 復元、新規 thread 作成制御の各責務ファイルを呼び出して接続する。
本文描画、messages取得、HOPY状態再判定、Compass再生成、confirmed payload 再生成、DB保存・復元仕様は持たない。
*/

/*
【今回このファイルで修正したこと】
1. fetchUserStateOnly() に controller で確認済みの session を sessionHint として渡しました。
2. useChatInitUserState.ts 側で削除した重複 session retry の代わりに、確認済み session を userState 復元へ渡す一本道にしました。
3. profile / plan / userState 取得本体は useChatInitUserState.ts を呼び出すだけのまま維持しました。
4. threads 取得本体は useChatInitThreads.ts を呼び出すだけのまま維持しました。
5. activeThread 復元補助は useChatInitActiveThread.ts を呼び出すだけのまま維持しました。
6. 新規 thread 作成制御は useChatInitCreateThread.ts を呼び出すだけのまま維持しました。
7. 本文表示、messages取得、送信、MEMORIES には触れていません。
8. HOPY唯一の正、confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階、DB保存・復元仕様には触れていません。
*/

/* /components/chat/lib/useChatInitControllerCore.ts */