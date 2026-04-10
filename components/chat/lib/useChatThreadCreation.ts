// /components/chat/lib/useChatThreadCreation.ts
"use client";

import { useCallback, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMsg } from "./chatTypes";
import { loadMessages } from "./threadApi";
import { mergeLoadedMessagesPreservingAssistantState } from "./chatMessageState";
import { isTemporaryGuestThreadId, microtask } from "./chatThreadIdentity";
import { resolveMessagesOwnerThreadId } from "./chatClientMessageMeta";

type Params = {
  displayLoggedIn: boolean;
  activeThreadIdRef: MutableRefObject<string | null>;
  messagesRef: MutableRefObject<ChatMsg[]>;
  setThreadBusy: Dispatch<SetStateAction<boolean>>;
  setUserStateErr: Dispatch<SetStateAction<string | null>>;
  ensureThreadExists: (threadId: string) => void;
  noteThreadDecision: (tid: string, reason: string) => void;
  guardedSetMessages: Dispatch<SetStateAction<ChatMsg[]>>;
  supabase: SupabaseClient;
  scrollToBottom: (behavior?: ScrollBehavior | "auto" | "smooth") => void;
  setActiveThreadId: (v: string | null) => void;
  setVisibleCount: Dispatch<SetStateAction<number>>;
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
  const lastResolvedThreadIdRef = useRef<string>("");
  const resolvingThreadMessagesRef = useRef<Set<string>>(new Set());

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
    const currentMessages = Array.isArray(messagesRef.current) ? messagesRef.current : [];
    const lastResolved = String(lastResolvedThreadIdRef.current ?? "").trim();
    const currentCanBeUsed =
      Boolean(current) &&
      !isTemporaryGuestThreadId(current) &&
      (currentMessages.length > 0 || current === lastResolved);

    if (currentCanBeUsed) {
      return current;
    }

    if (current && isTemporaryGuestThreadId(current)) {
      return null;
    }

    if (ensureThreadInflightRef.current) {
      const got = await waitForActiveThreadId(30, 20);
      const latestMessages = Array.isArray(messagesRef.current) ? messagesRef.current : [];
      const latestResolved = String(lastResolvedThreadIdRef.current ?? "").trim();
      const gotCanBeUsed =
        typeof got === "string" &&
        got.length > 0 &&
        !isTemporaryGuestThreadId(got) &&
        (latestMessages.length > 0 || got === latestResolved);

      if (gotCanBeUsed) return got;
      return null;
    }

    ensureThreadInflightRef.current = true;

    try {
      setThreadBusy(true);

      const pre = await waitForActiveThreadId(8, 18);
      const latestMessages = Array.isArray(messagesRef.current) ? messagesRef.current : [];
      const latestResolved = String(lastResolvedThreadIdRef.current ?? "").trim();
      const preCanBeUsed =
        typeof pre === "string" &&
        pre.length > 0 &&
        !isTemporaryGuestThreadId(pre) &&
        (latestMessages.length > 0 || pre === latestResolved);

      if (preCanBeUsed) return pre;

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
  }, [
    displayLoggedIn,
    activeThreadIdRef,
    messagesRef,
    setThreadBusy,
    setUserStateErr,
    waitForActiveThreadId,
  ]);

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
        noteThreadDecision(tid, "onThreadIdResolved:setActiveThreadId");
      } catch {}

      const currentMessagesSnapshot = Array.isArray(messagesRef.current) ? messagesRef.current : [];
      const snapshotOwnerThreadId = String(
        resolveMessagesOwnerThreadId(currentMessagesSnapshot) ?? ""
      ).trim();

      const preserveCurrentMessages =
        current === tid ||
        (isTemporaryGuestThreadId(current) &&
          Boolean(snapshotOwnerThreadId) &&
          snapshotOwnerThreadId === current);

      try {
        activeThreadIdRef.current = tid;
      } catch {}

      try {
        setActiveThreadId(tid);
      } catch {}

      try {
        window.dispatchEvent(
          new CustomEvent("hopy:thread", {
            detail: { threadId: tid, id: tid, reason: "send:resolved", source: "event" },
          })
        );
      } catch {}

      if (resolvingThreadMessagesRef.current.has(tid)) return;
      resolvingThreadMessagesRef.current.add(tid);

      microtask(() => {
        (async () => {
          try {
            const nextMessages = await loadMessages(supabase, tid);

            if (String(activeThreadIdRef.current ?? "").trim() !== tid) return;
            if (!Array.isArray(nextMessages)) return;

            const committedMessages =
              nextMessages.length > 0
                ? preserveCurrentMessages
                  ? mergeLoadedMessagesPreservingAssistantState(currentMessagesSnapshot, nextMessages)
                  : nextMessages
                : preserveCurrentMessages
                  ? currentMessagesSnapshot
                  : [];

            guardedSetMessages(committedMessages);
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

/*
このファイルの正式役割：
新規スレッド作成後に確定した thread_id を active として採用し、
その thread に属する messages だけを現在表示へ反映するためのフック。
*/

/*
【今回このファイルで修正したこと】
1. onThreadIdResolved 直後に activeThreadIdRef.current へ tid を同期反映するように修正しました。
2. これにより、同じ処理内の loadMessages 採用判定が旧 activeThreadId のままで落ちる経路を止めました。
3. build を止めていた null narrowing 修正はそのまま維持しました。
4. HOPY回答○、Compass、confirmed payload、DB保存/復元、useThreadSwitch.ts には触っていません。
*/

/*
/components/chat/lib/useChatThreadCreation.ts
*/