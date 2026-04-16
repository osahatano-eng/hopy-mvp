// /components/chat/lib/useChatInitParts.ts
"use client";

import type { Dispatch, SetStateAction, RefObject, MutableRefObject } from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

import type { Lang, Thread, ChatMsg } from "./chatTypes";
import { fetchThreads, ensureActiveThread } from "./threadApi";
import { saveActiveThreadId, clearActiveThreadId } from "./threadStore";
import {
  sortThreadsByUpdatedDesc,
  mergeThreadsPreferNewer,
  pickExistingThreadId,
} from "./useChatInitThreadList";
import { isSessionUsable, getSessionWithRetry } from "./useChatInitSession";

export {
  createThreadsRefreshHandler,
  createSelectThreadHandler,
} from "./useChatInitEventHandlers";
export type { ThreadsRefreshHandlerArgs } from "./useChatInitEventHandlers";

export {
  isSessionUsable,
  shouldHandleAuthEventWithRefs,
  getSessionWithRetry,
} from "./useChatInitSession";
export type { ShouldHandleAuthRefs } from "./useChatInitSession";

export const IS_DEV =
  (() => {
    try {
      return process.env.NODE_ENV !== "production";
    } catch {
      return true;
    }
  })() ?? true;

export function isDebugLogEnabled(): boolean {
  if (IS_DEV) return true;
  try {
    return typeof window !== "undefined" && localStorage.getItem("hopy_debug") === "1";
  } catch {
    return false;
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function logInfo(...args: unknown[]) {
  if (!isDebugLogEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.info(...args);
  } catch {}
}

export function logWarn(...args: unknown[]) {
  if (!isDebugLogEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.warn(...args);
  } catch {}
}

export function microtask(fn: () => void) {
  try {
    if (typeof queueMicrotask === "function") {
      queueMicrotask(fn);
      return;
    }
  } catch {}
  Promise.resolve()
    .then(fn)
    .catch(() => {});
}

export function errText(x: unknown) {
  const s = String((x as any)?.message ?? x ?? "").trim();
  return s || "unknown error";
}

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

export function getCustomDetail(ev: Event | undefined): Record<string, unknown> {
  if (!ev) return {};
  try {
    const ce = ev as CustomEvent<unknown>;
    const d = (ce as any)?.detail;
    if (d && typeof d === "object") return d as Record<string, unknown>;
  } catch {}
  return {};
}

export type PendingInit = {
  force: boolean;
  sessionHint?: Session | null;
  clientRequestId?: string;
};

export type FetchThreadsWithRetryResult = {
  ok: boolean;
  list: Thread[];
  allowCreateNew: boolean;
  error?: string;
};

export async function fetchUserStateOnly<TState>(args: {
  isAlive: () => boolean;
  initSeqRef: MutableRefObject<number>;
  seq: number;
  paramsRef: MutableRefObject<UseChatInitParams<TState>>;
  userId: string;
}) {
  const { isAlive, initSeqRef, seq, paramsRef, userId } = args;
  const p = paramsRef.current;

  if (!isAlive()) return;
  if (seq !== initSeqRef.current) return;

  p.setUserStateErr(null);

  try {
    const { data: sessionData, error: sessionError } = await p.supabase.auth.getSession();

    if (!isAlive()) return;
    if (seq !== initSeqRef.current) return;

    if (sessionError) {
      throw sessionError;
    }

    const session = sessionData?.session ?? null;
    const sessionUser = session?.user ?? null;
    const metadata = (sessionUser?.user_metadata ?? {}) as Record<string, unknown>;

    const resolvedUserName =
      String(
        metadata?.name ??
          metadata?.full_name ??
          metadata?.display_name ??
          sessionUser?.email ??
          "",
      ).trim() || null;

    const resolvedUserImageUrl =
      String(metadata?.avatar_url ?? metadata?.picture ?? "").trim() || null;

    const { data: profileRow, error: profileError } = await p.supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();

    if (!isAlive()) return;
    if (seq !== initSeqRef.current) return;

    if (profileError) {
      throw profileError;
    }

    const resolvedPlan = String((profileRow as any)?.plan ?? "").trim() || null;

    const rawState = {
      session: session
        ? {
            user: {
              id: String(sessionUser?.id ?? "").trim() || null,
              email: String(sessionUser?.email ?? "").trim() || null,
              user_metadata: {
                name: String(metadata?.name ?? "").trim() || null,
                full_name: String(metadata?.full_name ?? "").trim() || null,
                display_name: String(metadata?.display_name ?? "").trim() || null,
                avatar_url: String(metadata?.avatar_url ?? "").trim() || null,
                picture: String(metadata?.picture ?? "").trim() || null,
              },
            },
          }
        : null,
      profile: {
        plan: resolvedPlan,
      },
      user_name: resolvedUserName,
      user_image_url: resolvedUserImageUrl,
      plan: resolvedPlan,
    };

    const normalizedState = p.normalizeState(rawState);

    const mergedState =
      rawState &&
      normalizedState &&
      typeof rawState === "object" &&
      typeof normalizedState === "object"
        ? ({
            ...rawState,
            ...normalizedState,
          } as TState)
        : (normalizedState ?? (rawState as TState));

    p.setUserState(mergedState);
    p.setUserStateErr(null);
  } catch (e) {
    if (!isAlive()) return;
    if (seq !== initSeqRef.current) return;

    p.setUserState(null);
    p.setUserStateErr(errText(e));
    logWarn("[useChatInit] fetchUserStateOnly error", errText(e));
  }
}

export async function fetchThreadsOnly<TState>(args: {
  isAlive: () => boolean;
  initSeqRef: MutableRefObject<number>;
  seq: number;
  supabase: SupabaseClient<any>;
  paramsRef: MutableRefObject<UseChatInitParams<TState>>;
}): Promise<Thread[] | null> {
  const { isAlive, initSeqRef, seq, supabase, paramsRef } = args;
  const p = paramsRef.current;

  try {
    const r = await fetchThreads(supabase, p.uiLang);

    if (!isAlive()) return null;
    if (seq !== initSeqRef.current) return null;

    if (!r.ok) return null;

    const titleFallback = p.uiLang === "en" ? "New chat" : "新規チャット";
    const incoming = Array.isArray(r.list) ? r.list : [];

    p.setThreads((prev) =>
      sortThreadsByUpdatedDesc(
        mergeThreadsPreferNewer(Array.isArray(prev) ? prev : [], incoming, titleFallback),
      ),
    );

    return incoming;
  } catch (e) {
    logWarn("[useChatInit] fetchThreadsOnly error", errText(e));
    return null;
  }
}

export async function fetchThreadsWithRetry<TState>(args: {
  isAlive: () => boolean;
  initSeqRef: MutableRefObject<number>;
  seq: number;
  supabase: SupabaseClient<any>;
  uiLang: Lang;
  onSuccessList?: (list: Thread[]) => void;
}): Promise<FetchThreadsWithRetryResult> {
  const { isAlive, initSeqRef, seq, supabase, uiLang, onSuccessList } = args;

  const delays = [0, 180, 420, 780, 1200];

  let list: Thread[] = [];
  let lastErr: string | undefined;

  for (let i = 0; i < delays.length; i++) {
    if (!isAlive()) return { ok: false, list: [], allowCreateNew: false };
    if (seq !== initSeqRef.current) return { ok: false, list: [], allowCreateNew: false };

    if (delays[i] > 0) await sleep(delays[i]);

    if (!isAlive()) return { ok: false, list: [], allowCreateNew: false };
    if (seq !== initSeqRef.current) return { ok: false, list: [], allowCreateNew: false };

    try {
      const r = await fetchThreads(supabase, uiLang);

      if (!isAlive()) return { ok: false, list: [], allowCreateNew: false };
      if (seq !== initSeqRef.current) return { ok: false, list: [], allowCreateNew: false };

      if (r.ok) {
        list = Array.isArray(r.list) ? r.list : [];

        try {
          onSuccessList?.(list);
        } catch {}

        if (list.length > 0) {
          return { ok: true, list, allowCreateNew: false };
        }

        if (i < delays.length - 1) continue;

        return { ok: true, list: [], allowCreateNew: true };
      }

      lastErr = String(r.error ?? "fetchThreads error");
      if (i < delays.length - 1) continue;

      return { ok: false, list: [], allowCreateNew: false, error: lastErr };
    } catch (e) {
      lastErr = errText(e);
      logWarn("[useChatInit] fetchThreads threw", lastErr);

      if (i < delays.length - 1) continue;

      return { ok: false, list: [], allowCreateNew: false, error: lastErr };
    }
  }

  return {
    ok: false,
    list: Array.isArray(list) ? list : [],
    allowCreateNew: false,
    error: lastErr,
  };
}

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
  resumeInFlightRef: MutableRefObject<boolean>;
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

  const clearInitDebounceTimer = () => {
    const t = initDebounceTimerRef.current;
    if (t != null) {
      initDebounceTimerRef.current = null;
      try {
        window.clearTimeout(t);
      } catch {}
    }
  };

  const schedulePostInitThreadsRefresh = (
    seq: number,
    delayMs: number,
    reason: string,
  ) => {
    try {
      window.setTimeout(() => {
        if (!isAlive()) return;
        if (seq !== initSeqRef.current) return;

        microtask(() => {
          fetchThreadsOnly<TState>({ isAlive, initSeqRef, seq, supabase, paramsRef })
            .then((list) => {
              if (!isAlive()) return;
              if (seq !== initSeqRef.current) return;
              logInfo("[useChatInit] post-init threads refresh done", {
                reason,
                count: Array.isArray(list) ? list.length : 0,
              });
            })
            .catch((e) => {
              logWarn("[useChatInit] post-init threads refresh error", {
                reason,
                err: errText(e),
              });
            });
        });
      }, Math.max(0, delayMs));
    } catch {}
  };

  const init = async (
    force = false,
    sessionHint?: Session | null,
    forceClientRequestId?: string,
  ) => {
    const p = paramsRef.current;

    const incomingId = String(forceClientRequestId ?? "").trim();

    const schedulePendingInit = (delayMs: number) => {
      clearInitDebounceTimer();

      try {
        initDebounceTimerRef.current = window.setTimeout(() => {
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

    const now = Date.now();
    if (!force && now - lastInitAtRef.current < 100) {
      logInfo("[useChatInit] init ignored (debounced)", {
        clientRequestId: incomingId || undefined,
      });
      return;
    }

    clearInitDebounceTimer();
    pendingInitRef.current = null;

    initRunningRef.current = true;
    lastInitAtRef.current = now;

    const seq = ++initSeqRef.current;

    const initHadForceCreate = Boolean(forceCreateNextThreadRef.current);

    let clientRequestIdForCreate = "";
    try {
      if (incomingId) {
        clientRequestIdForCreate = incomingId;
        createRequestRef.current = { id: incomingId, at: Date.now() };
      } else if (force || forceCreateNextThreadRef.current) {
        const prev = createRequestRef.current;
        const age = Date.now() - (prev.at || 0);
        if (prev.id && age >= 0 && age <= CREATE_REQ_REUSE_MS) {
          clientRequestIdForCreate = prev.id;
        } else {
          clientRequestIdForCreate = "";
        }
      }
    } catch {}

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
        const prev = pendingInitRef.current;
        pendingInitRef.current = {
          force: Boolean(prev?.force || force),
          sessionHint: null,
          clientRequestId: incomingId || prev?.clientRequestId,
        };
        logWarn("[useChatInit] init no session -> schedule retry (no reset)", {
          delayMs: 420,
          hadUser: Boolean(lastUserIdRef.current),
          clientRequestId: pendingInitRef.current.clientRequestId || undefined,
        });
        schedulePendingInit(420);
        return;
      }

      lastUserIdRef.current = user.id;

      p.setEmail(user.email ?? "");

      const userStatePromise = fetchUserStateOnly<TState>({
        isAlive,
        initSeqRef,
        seq,
        paramsRef,
        userId: user.id,
      });

      try {
        fetchThreadsOnly<TState>({
          isAlive,
          initSeqRef,
          seq,
          supabase,
          paramsRef,
        }).catch(() => {});
      } catch {}

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

      const wantForceCreate = Boolean(forceCreateNextThreadRef.current);

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
      const sortedList = sortThreadsByUpdatedDesc(Array.isArray(list) ? list : []);
      const currentTargetThreadId = pickExistingThreadId(
        sortedList,
        activeThreadIdShadowRef.current,
      );

      if (!tr.ok && !wantForceCreate) {
        logWarn("[useChatInit] threads fetch failed -> keep idle state and retry", {
          reason: tr.error,
        });

        try {
          setActiveThreadIdSafe(null);
          clearActiveThreadId();
        } catch {}

        const prev = pendingInitRef.current;
        pendingInitRef.current = {
          force: Boolean(prev?.force),
          sessionHint: session,
          clientRequestId: incomingId || prev?.clientRequestId,
        };
        schedulePendingInit(420);

        await userStatePromise;
        microtask(() => p.inputRef?.current?.focus?.());
        return;
      }

      let tid: string | null = null;

      const mergeSetThreads: Dispatch<SetStateAction<Thread[]>> = (next) => {
        try {
          if (typeof next === "function") {
            p.setThreads(next);
            return;
          }

          const nextList = Array.isArray(next) ? (next as Thread[]) : [];
          p.setThreads((prev) =>
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
            if (typeof next === "function") p.setThreads(next);
            else p.setThreads(Array.isArray(next) ? (next as Thread[]) : []);
          } catch {}
        }
      };

      if (wantForceCreate) {
        forceCreateNextThreadRef.current = false;

        try {
          p.setMessages([]);
          p.setVisibleCount(200);
          p.setLastFailed(null);
          p.setUserStateErr(null);
        } catch {}

        try {
          clearActiveThreadId();
        } catch {}
      }

      if (wantForceCreate) {
        try {
          const r = await ensureActiveThread({
            supabase,
            list: sortedList,
            uiLang: p.uiLang,
            setActiveThreadId: (v: string | null) => setActiveThreadIdSafe(v),
            setThreads: mergeSetThreads,
            forceCreate: wantForceCreate,
            clientRequestId: clientRequestIdForCreate
              ? clientRequestIdForCreate
              : undefined,
          });

          if (r.ok) {
            tid = r.id;
          } else {
            tid = null;
            p.setUserStateErr(`thread create failed: ${String(r.error ?? "unknown")}`);
          }
        } catch (e) {
          logWarn("[useChatInit] ensureActiveThread error", e);
          tid = null;
          p.setUserStateErr(`thread create failed: ${errText(e)}`);
        }
      } else if (sortedList.length > 0) {
        tid = currentTargetThreadId || String(sortedList[0]?.id ?? "").trim() || null;
        if (tid) {
          try {
            setActiveThreadIdSafe(tid);
          } catch {}
        }
      }

      if (!isAlive()) return;
      if (seq !== initSeqRef.current) return;

      if (tid) {
        try {
          saveActiveThreadId(tid);
        } catch {}

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

        schedulePostInitThreadsRefresh(
          seq,
          480,
          wantForceCreate ? "init:create-forced" : "init:restore-existing",
        );
      } else {
        try {
          setActiveThreadIdSafe(null);
          clearActiveThreadId();
          p.setMessages([]);
          p.setVisibleCount(200);
        } catch {}

        logInfo("[useChatInit] stay idle (hero-first)", {
          threads: tr.ok ? sortedList.length : "unknown",
          forced: wantForceCreate,
          threadsOk: tr.ok,
          clientRequestId: clientRequestIdForCreate || undefined,
        });

        schedulePostInitThreadsRefresh(seq, 480, "init:hero-first");
      }

      await userStatePromise;
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

  const onCreateThread: EventListener = (ev) => {
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
      createRequestRef.current = { id: incomingClientRequestId, at: now };
    }

    createInFlightRef.current = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
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

  return {
    clearInitDebounceTimer,
    init,
    onCreateThread,
  };
}

/*
このファイルの正式役割:
チャット初期化の実体ファイル。
session 確立後の初期化、threads 再取得、activeThread 復元、新規 thread 作成時の制御を担う。
分離済み責務は import / re-export のみを行い、本体を持たない。
*/

/*
【今回このファイルで修正したこと】
1. init 内で user が取れなかったとき、lastUserIdRef.current があっても early return せず retry を予約するように修正しました。
2. これにより、reload では通る session 再取得ルートを、tab復帰後でも同じように再試行させます。
3. 今回は no session 時の retry 入口 1か所だけを対象にし、DB仕様、confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階の唯一の正には触っていません。
*/

/* /components/chat/lib/useChatInitParts.ts */