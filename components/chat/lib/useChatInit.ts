// /components/chat/lib/useChatInit.ts
"use client";

import { useEffect, useRef } from "react";

import { clearActiveThreadId } from "./threadStore";
import { waitForStableSession } from "./useChatInitSession";

import {
  logInfo,
  logWarn,
  errText,
  type PendingInit,
  type UseChatInitParams,
  createThreadsRefreshHandler,
  createSelectThreadHandler,
  createInitController,
  shouldHandleAuthEventWithRefs,
} from "./useChatInitParts";

function readThreadEventId(detail: unknown): string {
  const safe = (detail ?? {}) as Record<string, unknown>;

  const candidates = [
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

export function useChatInit<TState>(params: UseChatInitParams<TState>) {
  const { supabase, uiLang } = params;

  const paramsRef = useRef<UseChatInitParams<TState>>(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const initSeqRef = useRef(0);
  const lastUserIdRef = useRef<string | null>(null);

  const activeThreadIdShadowRef = useRef<string | null>(null);
  const syncActiveThreadShadow = (v: string | null) => {
    const tid = String(v ?? "").trim();
    activeThreadIdShadowRef.current = tid ? tid : null;
  };

  const setActiveThreadIdSafe = (v: string | null) => {
    const p = paramsRef.current;
    const tid = String(v ?? "").trim();
    const out = tid ? tid : null;
    syncActiveThreadShadow(out);
    try {
      p.setActiveThreadId(out);
    } catch {}
  };

  const initRunningRef = useRef(false);
  const lastInitAtRef = useRef(0);
  const initDebounceTimerRef = useRef<number | null>(null);

  const forceCreateNextThreadRef = useRef(false);
  const pendingInitRef = useRef<PendingInit | null>(null);

  const lastCreateEventAtRef = useRef(0);
  const CREATE_EVENT_DEDUPE_MS = 800;

  const createInFlightRef = useRef(false);

  const createRequestRef = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const CREATE_REQ_REUSE_MS = 1_200;

  const threadMutationSeqRef = useRef(0);
  const lastThreadMutationAtRef = useRef(0);
  const bumpThreadMutation = (reason: string) => {
    threadMutationSeqRef.current += 1;
    lastThreadMutationAtRef.current = Date.now();
    if (reason) {
      logInfo("[useChatInit] thread mutation", {
        reason,
        seq: threadMutationSeqRef.current,
      });
    }
  };

  const lastDispatchedThreadRef = useRef<{ id: string; at: number }>({
    id: "",
    at: 0,
  });
  const THREAD_EVENT_DEDUPE_MS = 650;

  const dispatchThreadEvent = (
    threadId: string,
    reason: string,
    source?: "event" | "storage" | "direct" | "unknown",
  ) => {
    const tid = String(threadId ?? "").trim();
    if (!tid) return;

    const now = Date.now();
    const last = lastDispatchedThreadRef.current;

    if (last.id === tid && now - last.at <= THREAD_EVENT_DEDUPE_MS) return;
    lastDispatchedThreadRef.current = { id: tid, at: now };

    try {
      if (typeof window !== "undefined") {
        const detail: Record<string, unknown> = { threadId: tid, id: tid, reason };
        const out = source ? { ...detail, source } : detail;
        window.dispatchEvent(new CustomEvent("hopy:select-thread", { detail: out }));
      }
    } catch {}
  };

  const lastAuthEventRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const AUTH_EVENT_DEDUPE_MS = 400;
  const handledInitialSessionRef = useRef(false);

  const lastResumeAtRef = useRef(0);
  const resumeInFlightRef = useRef(false);
  const RESUME_DEDUPE_MS = 900;

  useEffect(() => {
    let alive = true;
    const isAlive = () => alive;

    const clearInitialActiveSelection = () => {
      try {
        clearActiveThreadId();
      } catch {}
      setActiveThreadIdSafe(null);
    };

    const reset = () => {
      const p = paramsRef.current;

      initSeqRef.current += 1;
      lastUserIdRef.current = null;

      initRunningRef.current = false;
      lastInitAtRef.current = 0;

      try {
        const t = initDebounceTimerRef.current;
        if (t != null) {
          initDebounceTimerRef.current = null;
          window.clearTimeout(t);
        }
      } catch {}

      forceCreateNextThreadRef.current = false;
      pendingInitRef.current = null;

      lastCreateEventAtRef.current = 0;
      createInFlightRef.current = false;

      createRequestRef.current = { id: "", at: 0 };
      lastDispatchedThreadRef.current = { id: "", at: 0 };

      threadMutationSeqRef.current = 0;
      lastThreadMutationAtRef.current = 0;

      handledInitialSessionRef.current = false;

      lastResumeAtRef.current = 0;
      resumeInFlightRef.current = false;

      p.setEmail("");
      p.setMessages([]);
      p.setThreads([]);
      setActiveThreadIdSafe(null);
      p.setLastFailed(null);

      p.setUserState(null);
      p.setUserStateErr(null);

      try {
        clearActiveThreadId();
      } catch {}
    };

    const softAuthLost = () => {
      const p = paramsRef.current;

      initSeqRef.current += 1;

      initRunningRef.current = false;
      lastInitAtRef.current = 0;

      try {
        const t = initDebounceTimerRef.current;
        if (t != null) {
          initDebounceTimerRef.current = null;
          window.clearTimeout(t);
        }
      } catch {}

      forceCreateNextThreadRef.current = false;
      pendingInitRef.current = null;

      lastCreateEventAtRef.current = 0;
      createInFlightRef.current = false;

      handledInitialSessionRef.current = false;

      lastResumeAtRef.current = 0;
      resumeInFlightRef.current = false;

      try {
        p.setEmail("");
      } catch {}
      try {
        p.setUserState(null);
      } catch {}
      try {
        p.setUserStateErr(null);
      } catch {}
      try {
        p.setLastFailed(null);
      } catch {}
    };

    const onThreadsRefresh = createThreadsRefreshHandler({
      isAlive,
      supabase,
      paramsRef,
      bumpThreadMutation,
    });

    const onSelectThreadBase = createSelectThreadHandler({
      isAlive,
      bumpThreadMutation,
    });

    const onSelectThread = (event: Event) => {
      try {
        const detail = (event as CustomEvent)?.detail;
        const selectedThreadId = readThreadEventId(detail);
        if (selectedThreadId) {
          syncActiveThreadShadow(selectedThreadId);
        }
      } catch {}
      onSelectThreadBase(event);
    };

    const controller = createInitController<TState>({
      isAlive,

      supabase,
      uiLang: paramsRef.current.uiLang,

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
    });

    (async () => {
      try {
        const session = await waitForStableSession({ isAlive, supabase });
        if (!isAlive()) return;

        if (session) {
          logInfo("[useChatInit] mount stable session -> init(keep active thread selection)");
          controller.init(false, session);
          return;
        }

        clearInitialActiveSelection();

        logInfo("[useChatInit] mount no stable session -> guest idle");
      } catch (e) {
        logWarn("[useChatInit] mount bootstrap failed", errText(e));
        clearInitialActiveSelection();
      }
    })();

    const resumeInit = (reason: "visibilitychange" | "pageshow" | "focus") => {
      const now = Date.now();
      const lastResumeAt = lastResumeAtRef.current;

      if (lastResumeAt > 0 && now - lastResumeAt <= RESUME_DEDUPE_MS) {
        logInfo("[useChatInit] resume skipped (deduped)", {
          reason,
          sinceMs: now - lastResumeAt,
        });
        return;
      }

      lastResumeAtRef.current = now;

      try {
        logInfo("[useChatInit] resume -> init (direct)", { reason });
        controller.init(false, null);
      } catch (e) {
        logWarn("[useChatInit] resume failed", {
          reason,
          err: errText(e),
        });
      }
    };

    const onVisibilityChange = () => {
      try {
        if (typeof document === "undefined") return;
        if (document.visibilityState !== "visible") return;
      } catch {
        return;
      }

      resumeInit("visibilitychange");
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      resumeInit("pageshow");
    };

    const onFocus = () => {
      resumeInit("focus");
    };

    const onOnline = () => {
      (async () => {
        if (!isAlive()) return;

        const session = await waitForStableSession({ isAlive, supabase });
        if (!isAlive()) return;

        if (!session) {
          logInfo("[useChatInit] online -> init (session pending)");
          controller.init(false, null);
          return;
        }

        logInfo("[useChatInit] online -> init");
        controller.init(false, session);
      })().catch((e) => {
        logWarn("[useChatInit] online resume failed", errText(e));
      });
    };

    try {
      window.addEventListener("online", onOnline as any);
    } catch {}
    try {
      document.addEventListener("visibilitychange", onVisibilityChange as any);
    } catch {}
    try {
      window.addEventListener("pageshow", onPageShow as any);
    } catch {}
    try {
      window.addEventListener("focus", onFocus as any);
    } catch {}

    try {
      window.addEventListener("hopy:create-thread", controller.onCreateThread);
    } catch {}
    try {
      window.addEventListener("hopy:threads-refresh", onThreadsRefresh);
    } catch {}
    try {
      window.addEventListener("hopy:select-thread", onSelectThread);
    } catch {}

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;

      const evName = String(event ?? "").trim();

      if (evName === "SIGNED_OUT") {
        reset();
        return;
      }

      const recentResumeAge = Date.now() - lastResumeAtRef.current;
      const resumedRecently =
        lastResumeAtRef.current > 0 &&
        recentResumeAge >= 0 &&
        recentResumeAge <= RESUME_DEDUPE_MS + 1200;

      if (!session) {
        if (resumedRecently) {
          logInfo("[useChatInit] auth change (null session after resume) -> init");
          controller.init(false, null);
          return;
        }

        logInfo("[useChatInit] auth change (null session) -> keep current state");
        return;
      }

      if (evName === "TOKEN_REFRESHED") {
        if (resumedRecently) {
          logInfo("[useChatInit] auth change (token refreshed after resume) -> init");
          controller.init(false, session);
          return;
        }

        logInfo("[useChatInit] auth change (token refreshed) -> keep current state");
        return;
      }

      if (evName === "SIGNED_IN") {
        if (resumedRecently) {
          logInfo("[useChatInit] auth change (signed in after resume) -> init");
          controller.init(false, session);
          return;
        }

        logInfo("[useChatInit] auth change (signed in) -> keep current state");
        return;
      }

      const ok = shouldHandleAuthEventWithRefs(
        { handledInitialSessionRef, lastAuthEventRef, AUTH_EVENT_DEDUPE_MS },
        evName,
        session,
      );
      if (!ok) return;

      logInfo("[useChatInit] auth change", { event: evName });
      controller.init(false, session);
    });

    return () => {
      alive = false;

      controller.clearInitDebounceTimer();

      try {
        window.removeEventListener("online", onOnline as any);
      } catch {}
      try {
        document.removeEventListener("visibilitychange", onVisibilityChange as any);
      } catch {}
      try {
        window.removeEventListener("pageshow", onPageShow as any);
      } catch {}
      try {
        window.removeEventListener("focus", onFocus as any);
      } catch {}

      try {
        window.removeEventListener("hopy:create-thread", controller.onCreateThread);
      } catch {}
      try {
        window.removeEventListener("hopy:threads-refresh", onThreadsRefresh);
      } catch {}
      try {
        window.removeEventListener("hopy:select-thread", onSelectThread);
      } catch {}
      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, [supabase, uiLang]);
}

/*
このファイルの正式役割
Chat 初期化・認証変化・再開時再同期の親フック。
初期化開始、auth 変化、必要最小限の workspace 再開を管理する。
このファイルは本文表示の所有者ではない。
thread 切替本文の採用判定や HOPY唯一の正の再判定は持たない。
workspace 再開入口と、正式な select-thread 観測だけを扱う。
*/

/*
【今回このファイルで修正したこと】
1. tab復帰入口 resumeInit に最小限の dedupe を戻しました。
2. visibilitychange / focus / pageshow が短時間に重なっても、controller.init(false, null) を1回だけ流すようにしました。
3. 再同期入口の二重起動だけを止め、下流の createInitController 本線は触っていません。
4. confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5、本文採用判定、DB保存/復元仕様には触っていません。
*/

/* /components/chat/lib/useChatInit.ts */