// /components/chat/lib/useThreadSwitch.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction, RefObject } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadMessages, renameThread as renameThreadApi } from "./threadApi";
import type { ChatMsg, Thread } from "./chatTypes";

const IS_DEV =
  (() => {
    try {
      return process.env.NODE_ENV !== "production";
    } catch {
      return true;
    }
  })() ?? true;

function isDebugLogEnabled(): boolean {
  if (IS_DEV) return true;
  try {
    return typeof window !== "undefined" && localStorage.getItem("hopy_debug") === "1";
  } catch {
    return false;
  }
}

function logInfo(...args: any[]) {
  if (!isDebugLogEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.info(...args);
  } catch {}
}

function logWarn(...args: any[]) {
  if (!isDebugLogEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.warn(...args);
  } catch {}
}

function errText(x: any) {
  const s = String(x?.message ?? x ?? "").trim();
  return s || "unknown error";
}

function microtask(fn: () => void) {
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

type SwitchSource = "direct" | "event" | "unknown";

function normalizeSource(v: any): SwitchSource | null {
  const s = String(v ?? "").trim();
  if (s === "direct" || s === "event" || s === "unknown") return s;
  return null;
}

function inferSourceFromDetail(detail: any, fallback: SwitchSource): SwitchSource {
  const s = normalizeSource(detail?.source);
  if (s) return s;

  const reason = String(detail?.reason ?? "").trim();
  if (reason === "ui" || reason.startsWith("ui:")) return "direct";

  return fallback;
}

function hasThreadId(list: Thread[] | null | undefined, id: string): boolean {
  const tid = String(id ?? "").trim();
  if (!tid) return false;
  const arr = Array.isArray(list) ? list : [];
  for (const t of arr) {
    const x = String((t as any)?.id ?? "").trim();
    if (x === tid) return true;
  }
  return false;
}

function isUuidLikeThreadId(value: string) {
  const v = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function isTemporaryGuestThreadId(value: string) {
  const v = String(value ?? "").trim();
  if (!v) return false;
  if (isUuidLikeThreadId(v)) return false;

  const lower = v.toLowerCase();
  if (
    lower.startsWith("guest") ||
    lower.startsWith("guest_") ||
    lower.startsWith("guest-") ||
    lower.startsWith("local") ||
    lower.startsWith("local_") ||
    lower.startsWith("local-") ||
    lower.startsWith("temp") ||
    lower.startsWith("temp_") ||
    lower.startsWith("temp-") ||
    lower.startsWith("draft") ||
    lower.startsWith("draft_") ||
    lower.startsWith("draft-") ||
    lower.startsWith("tmp_") ||
    lower.startsWith("tmp-") ||
    lower.startsWith("cr_") ||
    lower.startsWith("cli_")
  ) {
    return true;
  }

  return true;
}

export function useThreadSwitch(params: {
  supabase: SupabaseClient<any>;
  activeThreadId: string | null;
  setActiveThreadId: (v: string | null) => void;
  setThreadBusy: (v: boolean) => void;
  setMessages: Dispatch<SetStateAction<ChatMsg[]>>;
  setVisibleCount: Dispatch<SetStateAction<number>>;
  scrollToBottom: (behavior?: ScrollBehavior | "auto" | "smooth") => void;
  threads: Thread[];
  setLastFailed?: (v: any | null) => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  setUserStateErr?: (v: string | null) => void;
}) {
  const {
    supabase,
    activeThreadId,
    setActiveThreadId,
    setThreadBusy,
    setMessages,
    setVisibleCount,
    scrollToBottom,
    threads,
    setLastFailed,
    inputRef,
    setUserStateErr,
  } = params;

  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const hasSessionRef = useRef(false);
  useEffect(() => {
    let alive = true;

    const sync = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        hasSessionRef.current = Boolean(data.session?.user);
      } catch {
        if (!alive) return;
        hasSessionRef.current = false;
      }
    };

    void sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      hasSessionRef.current = Boolean(session?.user);
    });

    return () => {
      alive = false;
      try {
        subscription.unsubscribe();
      } catch {}
    };
  }, [supabase]);

  const switchSeqRef = useRef(0);
  const lastGoodThreadIdRef = useRef<string | null>(null);
  const [retrySeq, setRetrySeq] = useState(0);

  const activeThreadIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  const threadsRef = useRef<Thread[]>([]);
  useEffect(() => {
    threadsRef.current = Array.isArray(threads) ? threads : [];
  }, [threads]);

  const lastSwitchSourceRef = useRef<SwitchSource>("unknown");
  const renameSeqByThreadRef = useRef<Record<string, number>>({});

  const canAcceptThreadSelection = useCallback((id: string, source: SwitchSource) => {
    const tid = String(id ?? "").trim();
    if (!tid) return false;

    if (isTemporaryGuestThreadId(tid)) {
      logInfo("[useThreadSwitch] reject temporary thread id", { tid, source });
      return false;
    }

    if (!isUuidLikeThreadId(tid)) {
      logInfo("[useThreadSwitch] reject non-uuid thread id", { tid, source });
      return false;
    }

    return true;
  }, []);

  const selectThread = useCallback(
    (id: string, source: SwitchSource = "direct") => {
      const nextId = String(id ?? "").trim();
      if (!nextId) return;

      if (!canAcceptThreadSelection(nextId, source)) return;

      const prev = String(activeThreadIdRef.current ?? "").trim();

      if (nextId === prev) {
        const lastGood = String(lastGoodThreadIdRef.current ?? "").trim();
        const needsRetry = lastGood !== nextId;

        if (!needsRetry) {
          logInfo("[useThreadSwitch] already active thread", { nextId, source });
          return;
        }

        logInfo("[useThreadSwitch] retry active thread load", {
          nextId,
          source,
          lastGood: lastGood || null,
        });

        lastSwitchSourceRef.current = source;

        try {
          setRetrySeq((v) => v + 1);
        } catch {}

        return;
      }

      lastSwitchSourceRef.current = source;
      activeThreadIdRef.current = nextId;

      try {
        setActiveThreadId(nextId);
      } catch {}
    },
    [canAcceptThreadSelection, setActiveThreadId]
  );

  const renameThread = useCallback(
    async (threadId: string, nextTitle: string, prevTitle?: string) => {
      const id = String(threadId ?? "").trim();
      const titleRaw = String(nextTitle ?? "").trim();
      const prev = String(prevTitle ?? "").trim();

      if (!id) return;
      if (!titleRaw) return;
      if (!hasSessionRef.current) return;
      if (isTemporaryGuestThreadId(id)) return;

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
          try {
            if (typeof window !== "undefined") {
              const payload = prev
                ? { reason: "rename-rollback", id, threadId: id, title: prev, prevTitle: prev }
                : { reason: "rename-failed", id, threadId: id };
              window.dispatchEvent(new CustomEvent("hopy:threads-refresh", { detail: payload }));
            }
          } catch {}
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
          const msg = String((r as any)?.error ?? "rename failed").trim() || "rename failed";

          try {
            if (typeof window !== "undefined") {
              const payload = prev
                ? { reason: "rename-rollback", id, threadId: id, title: prev, prevTitle: prev }
                : { reason: "rename-failed", id, threadId: id };
              window.dispatchEvent(new CustomEvent("hopy:threads-refresh", { detail: payload }));
            }
          } catch {}

          setUserStateErr?.(`rename failed: ${msg}`);
          return;
        }

        const th: any = (r as any).thread ?? null;
        const outId = String(th?.id ?? id).trim();
        const outTitle = String(th?.title ?? title).trim();
        const outUpdated = String(th?.updated_at ?? "").trim();

        try {
          if (typeof window !== "undefined") {
            const payload: any = {
              reason: "rename",
              id: outId,
              threadId: outId,
              title: outTitle,
            };
            if (outUpdated) payload.updated_at = outUpdated;
            window.dispatchEvent(new CustomEvent("hopy:threads-refresh", { detail: payload }));
          }
        } catch {}
      } catch (e) {
        if (renameSeqByThreadRef.current[id] !== nextSeq) return;

        try {
          if (typeof window !== "undefined") {
            const payload = prev
              ? { reason: "rename-rollback", id, threadId: id, title: prev, prevTitle: prev }
              : { reason: "rename-failed", id, threadId: id };
            window.dispatchEvent(new CustomEvent("hopy:threads-refresh", { detail: payload }));
          }
        } catch {}

        setUserStateErr?.(`rename failed: ${errText(e)}`);
      } finally {
        if (renameSeqByThreadRef.current[id] === nextSeq) {
          try {
            setThreadBusy(false);
          } catch {}
        }
      }
    },
    [supabase, setThreadBusy, setUserStateErr]
  );

  const selectThreadRef = useRef<((id: string, source?: SwitchSource) => void) | null>(null);
  useEffect(() => {
    selectThreadRef.current = (id, source) => selectThread(id, (source ?? "direct") as SwitchSource);
  }, [selectThread]);

  const renameThreadRef = useRef<typeof renameThread | null>(null);
  useEffect(() => {
    renameThreadRef.current = renameThread;
  }, [renameThread]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const accept = (raw: any, via: SwitchSource) => {
      const id = String(raw ?? "").trim();
      if (!id) return;

      if (!canAcceptThreadSelection(id, via)) return;

      lastSwitchSourceRef.current = via;
      selectThreadRef.current?.(id, via);
    };

    const onSelectThread = (e: any) => {
      try {
        const d = e?.detail ?? {};
        const via = inferSourceFromDetail(d, "event");
        accept(d.threadId ?? d.id, via);
      } catch {}
    };

    const onThread = (e: any) => {
      try {
        const d = e?.detail ?? {};
        const via = inferSourceFromDetail(d, "event");
        const id = String(d.threadId ?? d.id ?? "").trim();
        if (!id) return;

        const current = String(activeThreadIdRef.current ?? "").trim();
        const existsInCurrentList = hasThreadId(threadsRef.current, id);

        if (!current && via !== "direct" && existsInCurrentList) {
          logInfo("[useThreadSwitch] ignore passive thread event while hero/no-selection", {
            id,
            via,
            reason: String(d.reason ?? "").trim() || null,
          });
          return;
        }

        accept(id, via);
      } catch {}
    };

    const onRenameThread = (e: any) => {
      try {
        if (!hasSessionRef.current) return;

        const d = e?.detail ?? {};
        const id = String(d.threadId ?? d.id ?? "").trim();
        const title = String(d.title ?? "").trim();

        const prevTitle = String(
          d.prevTitle ??
            d.previousTitle ??
            d.prev ??
            d.prev_title ??
            d.previous_title ??
            d.beforeTitle ??
            d.before_title ??
            ""
        ).trim();

        if (!id || !title) return;
        void renameThreadRef.current?.(id, title, prevTitle || undefined);
      } catch {}
    };

    try {
      window.addEventListener("hopy:select-thread", onSelectThread as any);
      window.addEventListener("hopy:thread", onThread as any);
      window.addEventListener("hopy:rename-thread", onRenameThread as any);
    } catch {}

    return () => {
      try {
        window.removeEventListener("hopy:select-thread", onSelectThread as any);
        window.removeEventListener("hopy:thread", onThread as any);
        window.removeEventListener("hopy:rename-thread", onRenameThread as any);
      } catch {}
    };
  }, [canAcceptThreadSelection]);

  useEffect(() => {
    const p = paramsRef.current;

    const nextId = String(p.activeThreadId ?? "").trim();
    if (!nextId) return;

    if (isTemporaryGuestThreadId(nextId)) {
      logInfo("[useThreadSwitch] skip loadMessages for temporary guest thread id", {
        nextId,
      });
      return;
    }

    activeThreadIdRef.current = nextId;

    let disposed = false;
    const seq = ++switchSeqRef.current;
    const source = lastSwitchSourceRef.current;

    const isAlive = () => !disposed && seq === switchSeqRef.current;
    const isCurrentSelection = () => String(activeThreadIdRef.current ?? "").trim() === nextId;
    const canCommitCurrentThread = () => isAlive() && isCurrentSelection();

    const run = async () => {
      const prevGood = String(lastGoodThreadIdRef.current ?? "").trim();

      try {
        p.setThreadBusy(true);
      } catch {}

      try {
        const { data: sess } = await p.supabase.auth.getSession();
        const user = sess.session?.user;
        if (!user) {
          logWarn("[useThreadSwitch] no session user; ignore switch", { nextId, seq });
          return;
        }

        p.setLastFailed?.(null);
        p.setUserStateErr?.(null);

        const t0 =
          typeof performance !== "undefined" && typeof performance.now === "function"
            ? performance.now()
            : Date.now();

        let loadedMessages: ChatMsg[] = [];

        try {
          loadedMessages = await loadMessages(p.supabase, nextId);
        } catch (e) {
          const reason = `messages load failed: ${errText(e)}`;
          logWarn("[useThreadSwitch] loadMessages failed", {
            nextId,
            prevGood: prevGood || null,
            reason,
            seq,
          });

          if (canCommitCurrentThread()) {
            const canRollback =
              prevGood &&
              prevGood !== nextId &&
              !isTemporaryGuestThreadId(prevGood) &&
              hasThreadId(threadsRef.current, prevGood);

            if (canRollback) {
              lastSwitchSourceRef.current = "event";
              activeThreadIdRef.current = prevGood;

              try {
                p.setActiveThreadId(prevGood);
              } catch {}
            }

            p.setUserStateErr?.(reason);
          }
          return;
        }

        const t1 =
          typeof performance !== "undefined" && typeof performance.now === "function"
            ? performance.now()
            : Date.now();

        if (!canCommitCurrentThread()) {
          logInfo("[useThreadSwitch] ignore stale thread payload", {
            source,
            nextId,
            currentActiveThreadId: String(activeThreadIdRef.current ?? "").trim(),
            seq,
          });
          return;
        }

        try {
          p.setMessages(loadedMessages);
        } catch {}

        try {
          p.setVisibleCount(Math.max(200, loadedMessages.length));
        } catch {}

        microtask(() => {
          if (!canCommitCurrentThread()) return;
          try {
            p.scrollToBottom("auto");
          } catch {}
        });

        lastGoodThreadIdRef.current = nextId;

        logInfo("[useThreadSwitch] switched", {
          source,
          nextId,
          ms: Math.round(t1 - t0),
          seq,
        });

        microtask(() => {
          if (!canCommitCurrentThread()) return;
          p.inputRef?.current?.focus?.();
        });
      } finally {
        if (canCommitCurrentThread()) {
          try {
            p.setThreadBusy(false);
          } catch {}

          lastSwitchSourceRef.current = "unknown";
        }
      }
    };

    void run();

    return () => {
      disposed = true;
    };
  }, [activeThreadId, retrySeq]);

  return { selectThread };
}

/*
このファイルの正式役割
スレッド切替の親フック。
選択イベント受付、activeThreadId 更新、メッセージ再読込、rename 連携、切替失敗時の復元を担う。
*/

/*
【今回このファイルで修正したこと】
1. 本文同期に不要だった inflightThreadIdRef の重複抑止責務を削除しました。
2. 本文採用の正を switchSeqRef と activeThreadId 一致へ寄せ、採用フローを軽くしました。
3. 読込失敗時の復元分岐を最小限に整理し、不要な再セット経路を削除しました。
4. HOPY回答○、Compass、state_changed、confirmed payload、DB保存、DB復元の唯一の正には触っていません。
*/

/* /components/chat/lib/useThreadSwitch.ts */