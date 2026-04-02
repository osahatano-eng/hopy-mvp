// /components/chat/lib/useChatThreadCreation.ts
"use client";

import { useCallback, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMsg } from "./chatTypes";
import { loadMessages } from "./threadApi";
import { mergeLoadedMessagesPreservingAssistantState } from "./chatMessageState";
import { isTemporaryGuestThreadId, microtask } from "./chatThreadIdentity";

type Params = {
  displayLoggedIn: boolean;
  activeThreadIdRef: React.MutableRefObject<string | null>;
  messagesRef: React.MutableRefObject<ChatMsg[]>;
  setThreadBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setUserStateErr: React.Dispatch<React.SetStateAction<string | null>>;
  ensureThreadExists: (threadId: string) => void;
  noteThreadDecision: (tid: string, reason: string) => void;
  guardedSetMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
  supabase: SupabaseClient;
  scrollToBottom: (behavior?: ScrollBehavior | "auto" | "smooth") => void;
  setActiveThreadId: React.Dispatch<React.SetStateAction<string | null>>;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
};

export function useChatThreadCreation({
  displayLoggedIn,
  activeThreadIdRef,
  messagesRef,
  setThreadBusy,
  setUserStateErr,
  ensureThreadExists,
  noteThreadDecision,
  guardedSetMessages,
  supabase,
  scrollToBottom,
  setActiveThreadId,
  setVisibleCount,
}: Params) {
  const ensureThreadInflightRef = useRef(false);

  const waitForActiveThreadId = useCallback(
    async (tries: number, delayMs: number): Promise<string | null> => {
      for (let i = 0; i < tries; i++) {
        await new Promise((r) => setTimeout(r, delayMs));
        const now = String(activeThreadIdRef.current ?? "").trim();
        if (now) return now;
      }
      return null;
    },
    [activeThreadIdRef]
  );

  const ensureThreadId = useCallback(async (): Promise<string | null> => {
    if (!displayLoggedIn) return null;

    const current = String(activeThreadIdRef.current ?? "").trim();
    if (current && !isTemporaryGuestThreadId(current)) return current;

    if (current && isTemporaryGuestThreadId(current)) {
      return null;
    }

    if (ensureThreadInflightRef.current) {
      const got = await waitForActiveThreadId(30, 20);
      if (got && !isTemporaryGuestThreadId(got)) return got;
      return null;
    }

    ensureThreadInflightRef.current = true;

    try {
      setThreadBusy(true);

      const pre = await waitForActiveThreadId(8, 18);
      if (pre && !isTemporaryGuestThreadId(pre)) return pre;

      return null;
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "thread_create_failed").trim();
      setUserStateErr(msg || "thread_create_failed");
      return null;
    } finally {
      ensureThreadInflightRef.current = false;
      try {
        setThreadBusy(false);
      } catch {}
    }
  }, [displayLoggedIn, activeThreadIdRef, setThreadBusy, setUserStateErr, waitForActiveThreadId]);

  const lastResolvedThreadIdRef = useRef<string>("");
  const resolvingThreadMessagesRef = useRef<Set<string>>(new Set());

  const onThreadIdResolved = useCallback(
    (id: string) => {
      if (!displayLoggedIn) return;

      const tid = String(id ?? "").trim();
      if (!tid) return;

      const current = String(activeThreadIdRef.current ?? "").trim();

      if (lastResolvedThreadIdRef.current === tid && current === tid) return;
      lastResolvedThreadIdRef.current = tid;

      try {
        ensureThreadExists(tid);
      } catch {}

      try {
        window.dispatchEvent(
          new CustomEvent("hopy:thread", {
            detail: { threadId: tid, id: tid, reason: "send:resolved", source: "event" },
          })
        );
      } catch {}

      try {
        noteThreadDecision(tid, "onThreadIdResolved:setActiveThreadId");
      } catch {}

      try {
        setActiveThreadId(tid);
      } catch {}

      if (resolvingThreadMessagesRef.current.has(tid)) return;
      resolvingThreadMessagesRef.current.add(tid);

      microtask(() => {
        (async () => {
          try {
            const currentMessagesSnapshot = Array.isArray(messagesRef.current) ? messagesRef.current : [];
            const nextMessages = await loadMessages(supabase, tid);
            if (!Array.isArray(nextMessages) || nextMessages.length <= 0) return;

            if (String(activeThreadIdRef.current ?? "").trim() !== tid) return;

            const mergedMessages = mergeLoadedMessagesPreservingAssistantState(currentMessagesSnapshot, nextMessages);

            guardedSetMessages(mergedMessages);
            setVisibleCount(200);
            setUserStateErr(null);

            microtask(() => {
              try {
                scrollToBottom("auto");
              } catch {}
            });
          } catch {
          } finally {
            resolvingThreadMessagesRef.current.delete(tid);
          }
        })().catch(() => {
          resolvingThreadMessagesRef.current.delete(tid);
        });
      });
    },
    [
      displayLoggedIn,
      activeThreadIdRef,
      ensureThreadExists,
      noteThreadDecision,
      setActiveThreadId,
      messagesRef,
      supabase,
      guardedSetMessages,
      setVisibleCount,
      setUserStateErr,
      scrollToBottom,
    ]
  );

  return {
    ensureThreadId,
    onThreadIdResolved,
  };
}