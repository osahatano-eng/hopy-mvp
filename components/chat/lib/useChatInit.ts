// /components/chat/lib/useChatInit.ts
"use client";

import { useEffect, useRef } from "react";
import type { Session } from "@supabase/supabase-js";

import { clearActiveThreadId } from "./threadStore";

import {
  logInfo,
  logWarn,
  errText,
  type PendingInit,
  type UseChatInitParams,
  createThreadsRefreshHandler,
  createSelectThreadHandler,
  createThreadObservedHandler,
  createInitController,
  shouldHandleAuthEventWithRefs,
} from "./useChatInitParts";

export function useChatInit<TState>(params: UseChatInitParams<TState>) {
  const { supabase, uiLang } = params;

  const paramsRef = useRef<UseChatInitParams<TState>>(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const initSeqRef = useRef(0);
  const lastUserIdRef = useRef<string | null>(null);

  const activeThreadIdShadowRef = useRef<string | null>(null);
  const setActiveThreadIdSafe = (v: string | null) => {
    const p = paramsRef.current;
    const tid = String(v ?? "").trim();
    const out = tid ? tid : null;
    activeThreadIdShadowRef.current = out;
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
    if (reason) logInfo("[useChatInit] thread mutation", { reason, seq: threadMutationSeqRef.current });
  };

  const lastDispatchedThreadRef = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const THREAD_EVENT_DEDUPE_MS = 650;

  const dispatchThreadEvent = (
    threadId: string,
    reason: string,
    source?: "event" | "storage" | "direct" | "unknown"
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
        window.dispatchEvent(new CustomEvent("hopy:thread", { detail: out }));
      }
    } catch {}
  };

  const lastAuthEventRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const AUTH_EVENT_DEDUPE_MS = 400;
  const handledInitialSessionRef = useRef(false);

  const lastResumeAtRef = useRef(0);
  const resumeInFlightRef = useRef(false);
  const RESUME_DEDUPE_MS = 900;

  const waitForStableSession = async (alive: () => boolean): Promise<Session | null> => {
    const waits = [0, 80, 160, 260, 420, 650, 900];
    for (const ms of waits) {
      if (!alive()) return null;
      if (ms > 0) {
        await new Promise((r) => setTimeout(r, ms));
      }
      if (!alive()) return null;

      try {
        const { data } = await supabase.auth.getSession();
        const s = (data?.session ?? null) as Session | null;
        const ok = Boolean(s?.user?.id) && Boolean(String(s?.access_token ?? "").trim());
        if (ok) return s;
      } catch {}
    }
    return null;
  };

  useEffect(() => {
    let alive = true;
    const isAlive = () => alive;

    const shouldResumeWorkspace = () => {
      const hasActive = Boolean(String(activeThreadIdShadowRef.current ?? "").trim());
      const hasPending = Boolean(pendingInitRef.current);
      const creating = Boolean(createInFlightRef.current);
      const forced = Boolean(forceCreateNextThreadRef.current);
      return hasActive || hasPending || creating || forced;
    };

    const clearInitialActiveSelection = () => {
      try {
        clearActiveThreadId();
      } catch {}
      try {
        setActiveThreadIdSafe(null);
      } catch {}
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

      activeThreadIdShadowRef.current = null;

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

    const onThreadsRefresh = createThreadsRefreshHandler<TState>({
      isAlive,
      supabase,
      paramsRef,
      bumpThreadMutation,
    });
    const onSelectThread = createSelectThreadHandler({ isAlive, bumpThreadMutation });
    const onThreadObserved = createThreadObservedHandler({ isAlive, bumpThreadMutation });

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
        const session = await waitForStableSession(isAlive);
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
        try {
          clearInitialActiveSelection();
        } catch {}
      }
    })();

    const onVis = () => {
      try {
        if (typeof document === "undefined") return;
        if (document.visibilityState !== "visible") return;
        if (!shouldResumeWorkspace()) return;
        controller.resumeRefresh("visibility").catch(() => {});
      } catch {}
    };
    const onPageShow = () => {
      if (!shouldResumeWorkspace()) return;
      controller.resumeRefresh("pageshow").catch(() => {});
    };
    const onFocus = () => {
      if (!shouldResumeWorkspace()) return;
      controller.resumeRefresh("focus").catch(() => {});
    };
    const onOnline = () => {
      if (!shouldResumeWorkspace()) return;
      controller.resumeRefresh("online").catch(() => {});
    };

    try {
      if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis as any);
    } catch {}
    try {
      window.addEventListener("pageshow", onPageShow as any);
    } catch {}
    try {
      window.addEventListener("focus", onFocus as any);
    } catch {}
    try {
      window.addEventListener("online", onOnline as any);
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
    try {
      window.addEventListener("hopy:thread", onThreadObserved);
    } catch {}

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;

      const evName = String(event ?? "").trim();

      if (evName === "SIGNED_OUT") {
        reset();
        return;
      }

      if (!session) {
        logInfo("[useChatInit] auth change (null session) -> keep current state");
        return;
      }

      if (evName === "TOKEN_REFRESHED") {
        const userId = session.user?.id;

        if (userId && shouldResumeWorkspace()) {
          logInfo("[useChatInit] auth change (token refreshed) -> resume workspace");
          controller.init(false, session);
        }
        return;
      }

      const ok = shouldHandleAuthEventWithRefs(
        { handledInitialSessionRef, lastAuthEventRef, AUTH_EVENT_DEDUPE_MS },
        evName,
        session as Session | null
      );
      if (!ok) return;

      if (evName === "SIGNED_IN") {
        logInfo("[useChatInit] auth change (signed in) -> keep active thread selection");
      }

      logInfo("[useChatInit] auth change", { event: evName });
      controller.init(false, session as Session);
    });

    return () => {
      alive = false;

      controller.clearInitDebounceTimer();

      try {
        if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis as any);
      } catch {}
      try {
        window.removeEventListener("pageshow", onPageShow as any);
      } catch {}
      try {
        window.removeEventListener("focus", onFocus as any);
      } catch {}
      try {
        window.removeEventListener("online", onOnline as any);
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
        window.removeEventListener("hopy:thread", onThreadObserved);
      } catch {}
      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, [supabase, uiLang]);
}