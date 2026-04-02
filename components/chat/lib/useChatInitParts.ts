// /components/chat/lib/useChatInitParts.ts
"use client";

import type { Dispatch, SetStateAction, RefObject, MutableRefObject } from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

import type { Lang, Thread, ChatMsg } from "./chatTypes";
import { fetchThreads, ensureActiveThread } from "./threadApi";
import { saveActiveThreadId, clearActiveThreadId } from "./threadStore";

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

export function safeIso(v: unknown): string {
  const s = String(v ?? "").trim();
  return s;
}

export function toMs(isoLike: string): number {
  const s = String(isoLike ?? "").trim();
  if (!s) return 0;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return 0;
  return t;
}

export function pickTitle(prevTitle: string, nextTitle: string, fallback: string) {
  const p = String(prevTitle ?? "").trim();
  const n = String(nextTitle ?? "").trim();
  if (n) return n;
  if (p) return p;
  return fallback;
}

export function isSessionUsable(session: Session | null | undefined): session is Session {
  return Boolean(session?.user?.id) && Boolean(String(session?.access_token ?? "").trim());
}

export function sortThreadsByUpdatedDesc(list: Thread[]): Thread[] {
  const arr = Array.isArray(list) ? list.slice() : [];
  if (arr.length <= 1) return arr;

  const idx = new Map<string, number>();
  for (let i = 0; i < arr.length; i++) {
    const id = String(arr[i]?.id ?? "").trim();
    if (!id) continue;
    if (!idx.has(id)) idx.set(id, i);
  }

  arr.sort((a, b) => {
    const am = toMs(safeIso(a?.updated_at));
    const bm = toMs(safeIso(b?.updated_at));

    if (bm !== am) return bm - am;

    const aid = String(a?.id ?? "").trim();
    const bid = String(b?.id ?? "").trim();
    const ai = idx.get(aid) ?? 0;
    const bi = idx.get(bid) ?? 0;
    return ai - bi;
  });

  return arr;
}

export function mergeThreadsPreferNewer(prev: Thread[], incoming: Thread[], titleFallback: string): Thread[] {
  const prevList = Array.isArray(prev) ? prev : [];
  const nextList = Array.isArray(incoming) ? incoming : [];

  const prevMap = new Map<string, Thread>();
  for (const t of prevList) {
    const id = String(t?.id ?? "").trim();
    if (!id) continue;
    if (!prevMap.has(id)) prevMap.set(id, t);
  }

  const seen = new Set<string>();
  const out: Thread[] = [];

  for (const t of nextList) {
    const id = String(t?.id ?? "").trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const prevT = prevMap.get(id);

    const incTitle = String(t?.title ?? "").trim();
    const incUpdated = safeIso(t?.updated_at);

    if (!prevT) {
      const title = incTitle || titleFallback;
      const outT: Thread = { ...t, id, title };
      out.push(outT);
      continue;
    }

    const prevTitle = String(prevT?.title ?? "").trim();
    const prevUpdated = safeIso(prevT?.updated_at);

    const prevMs = toMs(prevUpdated);
    const incMs = toMs(incUpdated);

    const incomingIsNewer = incMs > prevMs;

    const title = incomingIsNewer
      ? pickTitle(prevTitle, incTitle, titleFallback)
      : pickTitle(incTitle, prevTitle, titleFallback);

    let updated_at = prevUpdated;
    if (incUpdated) {
      if (!prevUpdated) updated_at = incUpdated;
      else if (incMs >= prevMs) updated_at = incUpdated;
    }

    const merged: Thread = { ...prevT, ...t, id, title };
    if (updated_at) merged.updated_at = updated_at;
    else delete (merged as any).updated_at;

    out.push(merged);
  }

  for (const t of prevList) {
    const id = String(t?.id ?? "").trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const title = String(t?.title ?? "").trim() || titleFallback;
    const merged: Thread = { ...t, id, title };
    out.push(merged);
  }

  return out;
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

export type ShouldHandleAuthRefs = {
  handledInitialSessionRef: MutableRefObject<boolean>;
  lastAuthEventRef: MutableRefObject<{ key: string; at: number }>;
  AUTH_EVENT_DEDUPE_MS: number;
};

export function shouldHandleAuthEventWithRefs(
  refs: ShouldHandleAuthRefs,
  event: string,
  session: Session | null
) {
  const ev = String(event ?? "").trim();

  if (ev === "INITIAL_SESSION") {
    if (!session?.user) return false;
    if (refs.handledInitialSessionRef.current) return false;
    refs.handledInitialSessionRef.current = true;
    return true;
  }

  const uid = String(session?.user?.id ?? "");
  const key = `${ev}:${uid}`;
  const now = Date.now();
  const last = refs.lastAuthEventRef.current;

  if (last.key === key && now - last.at <= refs.AUTH_EVENT_DEDUPE_MS) return false;

  refs.lastAuthEventRef.current = { key, at: now };
  return true;
}

export async function fetchUserStateOnly<TState>(args: {
  isAlive: () => boolean;
  initSeqRef: MutableRefObject<number>;
  seq: number;
  paramsRef: MutableRefObject<UseChatInitParams<TState>>;
  userId: string;
  accessToken: string | undefined;
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
          ""
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
      rawState && normalizedState && typeof rawState === "object" && typeof normalizedState === "object"
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
      sortThreadsByUpdatedDesc(mergeThreadsPreferNewer(Array.isArray(prev) ? prev : [], incoming, titleFallback))
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
      } else {
        lastErr = String(r.error ?? "fetchThreads error");
        if (i < delays.length - 1) continue;

        return { ok: false, list: [], allowCreateNew: false, error: lastErr };
      }
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

export async function getSessionWithRetry(args: {
  isAlive: () => boolean;
  initSeqRef: MutableRefObject<number>;
  seq: number;
  supabase: SupabaseClient<any>;
  hint?: Session | null;
}) {
  const { isAlive, initSeqRef, seq, supabase, hint } = args;
  if (isSessionUsable(hint ?? null)) return hint as Session;

  const delays = [0, 80, 160, 260, 420, 650, 900, 1200, 1600, 2100, 2750];

  for (let i = 0; i < delays.length; i++) {
    if (!isAlive()) return null;
    if (seq !== initSeqRef.current) return null;

    if (delays[i] > 0) await sleep(delays[i]);

    if (!isAlive()) return null;
    if (seq !== initSeqRef.current) return null;

    try {
      const { data } = await supabase.auth.getSession();
      const s = data.session ?? null;
      if (isSessionUsable(s)) return s;
    } catch {}
  }
  return null;
}

export type ThreadsRefreshHandlerArgs<TState> = {
  isAlive: () => boolean;
  supabase: SupabaseClient<any>;
  paramsRef: MutableRefObject<UseChatInitParams<TState>>;
  bumpThreadMutation: (reason: string) => void;
};

export function createThreadsRefreshHandler<TState>(args: ThreadsRefreshHandlerArgs<TState>): EventListener {
  const { isAlive, supabase, paramsRef, bumpThreadMutation } = args;

  return (ev) => {
    if (!isAlive()) return;
    if (typeof window === "undefined") return;

    const p = paramsRef.current;

    try {
      const d = getCustomDetail(ev);

      const reason = String(d?.reason ?? "").trim();
      bumpThreadMutation(reason || "threads-refresh");

      if (reason === "rename-failed") {
        microtask(() => {
          (async () => {
            try {
              const r = await fetchThreads(supabase, p.uiLang);
              if (!isAlive()) return;
              if (!r.ok) return;

              const titleFallback = p.uiLang === "en" ? "New chat" : "新規チャット";
              const incoming = Array.isArray(r.list) ? r.list : [];

              p.setThreads((prev) =>
                sortThreadsByUpdatedDesc(
                  mergeThreadsPreferNewer(Array.isArray(prev) ? prev : [], incoming, titleFallback)
                )
              );
            } catch (e) {
              logWarn("[useChatInit] threads-refresh(rename-failed) refetch error", errText(e));
            }
          })();
        });
        return;
      }

      const listRaw = (d as any)?.list ?? (d as any)?.threads ?? (d as any)?.items;
      const hasList = Array.isArray(listRaw);

      const tid = String((d as any)?.id ?? (d as any)?.threadId ?? (d as any)?.thread_id ?? "").trim();

      let title = String((d as any)?.title ?? (d as any)?.nextTitle ?? (d as any)?.next_title ?? "").trim();

      const rollbackish =
        reason.includes("rollback") ||
        reason.includes("rename-rollback") ||
        reason.includes("failed") ||
        reason.includes("rename-failed");

      if (!title && rollbackish) {
        title = String(
          (d as any)?.prevTitle ??
            (d as any)?.previousTitle ??
            (d as any)?.prev_title ??
            (d as any)?.previous_title ??
            ""
        ).trim();
      }

      const updated_at_in = String((d as any)?.updated_at ?? "").trim();

      if (!hasList && !tid) return;

      const titleFallback = p.uiLang === "en" ? "New chat" : "新規チャット";

      p.setThreads((prev) => {
        const prevList = Array.isArray(prev) ? prev : [];

        if (hasList) {
          const nextList = (listRaw as any[]).filter(Boolean) as Thread[];
          const merged = mergeThreadsPreferNewer(prevList, nextList, titleFallback);
          return sortThreadsByUpdatedDesc(merged);
        }

        if (!tid) return prevList;
        if (!title && !updated_at_in) return prevList;

        let found = false;
        let changed = false;

        const next = prevList.map((t) => {
          const id = String(t?.id ?? "").trim();
          if (id !== tid) return t;

          found = true;

          const prevTitle = String(t?.title ?? "").trim();
          const prevUpdated = safeIso(t?.updated_at);

          const nt = title ? title : prevTitle;

          const prevMs = toMs(prevUpdated);
          const incMs = toMs(updated_at_in);

          let nu = prevUpdated;
          if (updated_at_in) {
            if (!prevUpdated) nu = updated_at_in;
            else if (incMs >= prevMs) nu = updated_at_in;
          }

          if (prevTitle === nt && prevUpdated === nu) return t;

          changed = true;
          const out: Thread = { ...t };
          if (nt) out.title = nt;
          if (nu) out.updated_at = nu;
          else delete (out as any).updated_at;
          return out;
        });

        if (!found) {
          let ua = updated_at_in;
          if (!ua && !rollbackish) {
            try {
              ua = new Date().toISOString();
            } catch {}
          }

          const out: Thread = { id: tid, title: title || titleFallback };
          if (ua) out.updated_at = ua;

          return sortThreadsByUpdatedDesc([out, ...prevList]);
        }

        if (!changed) return prevList;
        return sortThreadsByUpdatedDesc(next);
      });
    } catch (e) {
      logWarn("[useChatInit] threads-refresh handler error", errText(e));
    }
  };
}

export function createSelectThreadHandler(args: {
  isAlive: () => boolean;
  bumpThreadMutation: (reason: string) => void;
}): EventListener {
  const { isAlive, bumpThreadMutation } = args;

  return (ev) => {
    if (!isAlive()) return;
    if (typeof window === "undefined") return;

    try {
      const d = getCustomDetail(ev);
      const tid = String((d as any)?.threadId ?? (d as any)?.id ?? (d as any)?.thread_id ?? "").trim();
      const reason = String((d as any)?.reason ?? "select-thread").trim();

      bumpThreadMutation(reason || "select-thread");
      if (tid) logInfo("[useChatInit] select-thread observed", { tid, reason });
    } catch {
      bumpThreadMutation("select-thread");
    }
  };
}

export function createThreadObservedHandler(args: {
  isAlive: () => boolean;
  bumpThreadMutation: (reason: string) => void;
}): EventListener {
  const { isAlive, bumpThreadMutation } = args;

  return (ev) => {
    if (!isAlive()) return;
    if (typeof window === "undefined") return;

    try {
      const d = getCustomDetail(ev);
      const tid = String((d as any)?.threadId ?? (d as any)?.id ?? "").trim();
      const reason = String((d as any)?.reason ?? "thread").trim();

      bumpThreadMutation(reason || "thread");
      if (tid) logInfo("[useChatInit] thread observed", { tid, reason });
    } catch {
      bumpThreadMutation("thread");
    }
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

  dispatchThreadEvent: (threadId: string, reason: string, source?: "event" | "storage" | "direct" | "unknown") => void;

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

    threadMutationSeqRef,
    lastThreadMutationAtRef,

    dispatchThreadEvent,

    reset,
    softAuthLost,

    lastResumeAtRef,
    resumeInFlightRef,
    RESUME_DEDUPE_MS,
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

  const schedulePostInitThreadsRefresh = (seq: number, delayMs: number, reason: string) => {
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

  const resumeRefresh = async (reason: string) => {
    if (!isAlive()) return;

    const now = Date.now();
    if (now - lastResumeAtRef.current <= RESUME_DEDUPE_MS) return;
    lastResumeAtRef.current = now;

    if (resumeInFlightRef.current) return;
    resumeInFlightRef.current = true;

    const seq = ++initSeqRef.current;

    try {
      const s = await getSessionWithRetry({ isAlive, initSeqRef, seq, supabase, hint: null });

      if (!isAlive()) return;
      if (seq !== initSeqRef.current) return;

      if (!isSessionUsable(s)) {
        logWarn("[useChatInit] resumeRefresh no session -> keep (no reset)", { reason });
        return;
      }

      try {
        fetchUserStateOnly<TState>({
          isAlive,
          initSeqRef,
          seq,
          paramsRef,
          userId: String(s.user.id ?? ""),
          accessToken: s.access_token,
        }).catch(() => {});
      } catch {}

      await fetchThreadsOnly<TState>({ isAlive, initSeqRef, seq, supabase, paramsRef });

      if (!isAlive()) return;
      if (seq !== initSeqRef.current) return;

      logInfo("[useChatInit] resumeRefresh done", { reason, rescued: false });
    } catch (e) {
      logWarn("[useChatInit] resumeRefresh error", { reason, err: errText(e) });
    } finally {
      resumeInFlightRef.current = false;
    }
  };

  const init = async (force = false, sessionHint?: Session | null, forceClientRequestId?: string) => {
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

    if (initRunningRef.current) {
      const prev = pendingInitRef.current;
      pendingInitRef.current = {
        force: Boolean(force || prev?.force),
        sessionHint: sessionHint ?? prev?.sessionHint,
        clientRequestId: incomingId || prev?.clientRequestId,
      };
      logInfo("[useChatInit] init queued (already running)", {
        force: pendingInitRef.current.force,
        clientRequestId: pendingInitRef.current.clientRequestId || undefined,
      });
      return;
    }

    const now = Date.now();
    if (!force && now - lastInitAtRef.current < 100) {
      const prev = pendingInitRef.current;
      pendingInitRef.current = {
        force: Boolean(prev?.force),
        sessionHint: sessionHint ?? prev?.sessionHint,
        clientRequestId: incomingId || prev?.clientRequestId,
      };
      logInfo("[useChatInit] init queued (debounced)", {
        force: pendingInitRef.current.force,
        clientRequestId: pendingInitRef.current.clientRequestId || undefined,
      });

      schedulePendingInit(120);
      return;
    }

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
      const session = await getSessionWithRetry({ isAlive, initSeqRef, seq, supabase, hint: sessionHint ?? null });

      if (!isAlive()) return;
      if (seq !== initSeqRef.current) return;

      const user = isSessionUsable(session) ? session.user : null;
      const accessToken = isSessionUsable(session) ? session.access_token : undefined;

      if (!user) {
        if (lastUserIdRef.current) {
          logWarn("[useChatInit] init no session -> keep (no softAuthLost)");
          return;
        }

        const prev = pendingInitRef.current;
        pendingInitRef.current = {
          force: Boolean(prev?.force || force),
          sessionHint: null,
          clientRequestId: incomingId || prev?.clientRequestId,
        };
        logWarn("[useChatInit] init no session -> schedule retry (no reset)", {
          delayMs: 420,
          clientRequestId: pendingInitRef.current.clientRequestId || undefined,
        });
        schedulePendingInit(420);
        return;
      }

      if (!force && !forceCreateNextThreadRef.current && lastUserIdRef.current === user.id) {
        await fetchUserStateOnly<TState>({
          isAlive,
          initSeqRef,
          seq,
          paramsRef,
          userId: user.id,
          accessToken,
        });

        await fetchThreadsOnly<TState>({ isAlive, initSeqRef, seq, supabase, paramsRef });

        if (!isAlive()) return;
        if (seq !== initSeqRef.current) return;

        logInfo("[useChatInit] same-user reinit -> keep current active thread");

        schedulePostInitThreadsRefresh(seq, 480, "same-user-reinit:keep-active");

        await Promise.resolve();
        microtask(() => p.inputRef?.current?.focus?.());
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
        accessToken,
      });

      try {
        fetchThreadsOnly<TState>({ isAlive, initSeqRef, seq, supabase, paramsRef }).catch(() => {});
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
              mergeThreadsPreferNewer(Array.isArray(prev) ? prev : [], safeIncoming, titleFallback)
            )
          );
        },
      });
      if (!isAlive()) return;
      if (seq !== initSeqRef.current) return;

      const wantForceCreate = Boolean(forceCreateNextThreadRef.current);

      if (tr.ok) {
        const incoming = Array.isArray(tr.list) ? tr.list : [];
        p.setThreads((prev) =>
          sortThreadsByUpdatedDesc(mergeThreadsPreferNewer(Array.isArray(prev) ? prev : [], incoming, titleFallback))
        );
      } else if (wantForceCreate) {
        try {
          p.setThreads([]);
        } catch {}
      }

      const list = tr.ok ? tr.list : ([] as Thread[]);
      const sortedList = sortThreadsByUpdatedDesc(Array.isArray(list) ? list : []);

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
            sortThreadsByUpdatedDesc(mergeThreadsPreferNewer(Array.isArray(prev) ? prev : [], nextList, titleFallback))
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

      const allowCreate = wantForceCreate;

      if (allowCreate) {
        try {
          const r = await ensureActiveThread({
            supabase,
            list: sortedList,
            uiLang: p.uiLang,
            setActiveThreadId: (v: string | null) => setActiveThreadIdSafe(v),
            setThreads: mergeSetThreads,
            forceCreate: wantForceCreate,
            clientRequestId: clientRequestIdForCreate ? clientRequestIdForCreate : undefined,
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
        tid = String(sortedList[0]?.id ?? "").trim() || null;
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

        dispatchThreadEvent(tid, wantForceCreate ? "init:create-forced" : "init:restore-existing", "event");

        p.scrollToBottom("auto");

        logInfo("[useChatInit] ready", {
          tid,
          threads: tr.ok ? sortedList.length : "unknown",
          allowCreateNew: tr.ok ? tr.allowCreateNew : "unknown",
          forced: wantForceCreate,
          threadsOk: tr.ok,
          clientRequestId: clientRequestIdForCreate || undefined,
        });

        schedulePostInitThreadsRefresh(seq, 480, wantForceCreate ? "init:create-forced" : "init:restore-existing");
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
    resumeRefresh,
    onCreateThread,
  };
}

export { createInitController };

/*
このファイルの正式役割
チャット初期化の実体ファイル。
session 確立後の初期化、threads 再取得、activeThread 復元、新規 thread 作成時の制御を担う。
*/

/*
【今回このファイルで修正したこと】
1. fetchUserStateOnly 内の profiles 参照キーを id から user_id に修正しました。
2. public.profiles の実在カラム前提に合わせ、profiles.id does not exist を止める形に戻しました。
3. 状態の唯一の正、Compass 条件、回答ルート本体には触れていません。
*/