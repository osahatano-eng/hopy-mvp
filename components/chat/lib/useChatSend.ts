// /components/chat/lib/useChatSend.ts
"use client";

import { useCallback, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMsg, Lang } from "./chatTypes";
import { attachThreadIdToMessage } from "./chatSendConfirmedAssistantMessage";
import { shouldBlockDuplicateSend } from "./chatSendDuplicateGuard";
import { isChatSendComposingNow } from "./chatSendComposingGuard";
import { applyUserStateFromSendResult } from "./chatSendApplyUserState";
import { handleChatSendFailure } from "./chatSendHandleFailure";
import { createPendingUserMessage } from "./chatSendPendingUserMessage";
import { prepareRetrySend } from "./chatSendRetryPreparation";
import { runSendThreadPostProcess } from "./chatSendThreadPostProcess";
import {
  runChatSendRequestExecution,
  type ChatSendFutureChainPersist,
} from "./chatSendRequestExecution";
import {
  genClientRequestId,
  microtask,
  normalizeForSend,
} from "./chatSendShared";
import { isTemporaryGuestThreadId } from "./chatThreadIdentity";
import type { ApiThread } from "./chatSendState";

export type FailedSend = {
  text: string;
  uiLang: Lang;
  conversationId: string;
  at: number;
  errorText: string;
  clientRequestId?: string;
};

type UiStrings = {
  emptyReply: string;
};

function normalizeConversationIdSeed(threadId: string | null | undefined) {
  const tid = String(threadId ?? "").trim();
  if (!tid) return null;
  if (isTemporaryGuestThreadId(tid)) return null;
  return tid;
}

export function useChatSend<TState>(params: {
  supabase: SupabaseClient;
  uiLang: Lang;
  ui: UiStrings;
  activeThreadId: string | null;
  ensureThreadId?: () => Promise<string | null>;
  onThreadIdResolved?: (threadId: string) => void;
  onThreadRenamed?: (thread: ApiThread) => void;
  onFutureChainPersist?: (
    futureChainPersist: ChatSendFutureChainPersist | null
  ) => void;
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  setMessages: Dispatch<SetStateAction<ChatMsg[]>>;
  setVisibleCount: Dispatch<SetStateAction<number>>;
  atBottomRef: MutableRefObject<boolean>;
  scrollToBottom: (mode?: "auto" | "smooth") => void;
  lastFailed: FailedSend | null;
  setLastFailed: Dispatch<SetStateAction<FailedSend | null>>;
  normalizeState: (s: any) => TState | null;
  setUserState: (s: TState | null) => void;
  setUserStateErr: (s: string | null) => void;
  clampText: (s: string, max?: number) => string;
  detectUserLang: (text: string) => Lang;
  loadMessages: (
    supabase: SupabaseClient,
    threadId: string
  ) => Promise<ChatMsg[]>;
  getMemoryBlock?: () => string;
  getIsComposing?: () => boolean;
}) {
  const {
    supabase,
    uiLang,
    ui,
    activeThreadId,
    onThreadIdResolved,
    onThreadRenamed,
    onFutureChainPersist,
    input,
    setInput,
    loading,
    setLoading,
    setMessages,
    setVisibleCount,
    atBottomRef,
    scrollToBottom,
    lastFailed,
    setLastFailed,
    normalizeState,
    setUserState,
    setUserStateErr,
    clampText,
    detectUserLang,
    loadMessages,
    getMemoryBlock,
    getIsComposing,
  } = params;

  const inflightRef = useRef(false);
  const autoRenameDoneRef = useRef<Set<string>>(new Set());
  const lastSigRef = useRef<{ sig: string; at: number } | null>(null);

  const sendCore = useCallback(
    async (opts: {
      text: string;
      conversationIdSeed: string | null;
      uiLangForFailed: Lang;
      clientRequestId?: string;
    }) => {
      const { text, conversationIdSeed, uiLangForFailed, clientRequestId } =
        opts;

      if (inflightRef.current) return;
      inflightRef.current = true;

      const normalizedSeed = normalizeConversationIdSeed(conversationIdSeed);

      if (
        shouldBlockDuplicateSend({
          text,
          conversationId: normalizedSeed,
          lastSigRef,
        })
      ) {
        inflightRef.current = false;
        return;
      }

      let cid = normalizedSeed;
      setUserStateErr(null);

      let userMsgId = "";

      try {
        const pendingUser = createPendingUserMessage({
          text,
          detectUserLang,
          displayThreadId: normalizedSeed,
        });

        userMsgId = pendingUser.userMsgId;

        setMessages((prev) => [...prev, pendingUser.message]);
        setVisibleCount((v) => Math.max(v, 200));
        setLoading(true);

        const executed = await runChatSendRequestExecution<TState>({
          supabase,
          uiLang,
          ui,
          text,
          conversationIdSeed: cid,
          clientRequestId,
          getMemoryBlock,
        });

        try {
          onFutureChainPersist?.(executed.futureChainPersist ?? null);
        } catch {}

        cid = String(executed.conversationId ?? "").trim() || null;

        const resolvedThreadId = normalizeConversationIdSeed(
          executed.threadIdForReload || null,
        );

        if (resolvedThreadId && executed.isLoggedIn) {
          try {
            onThreadIdResolved?.(resolvedThreadId);
          } catch {}
        }

        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === userMsgId
              ? attachThreadIdToMessage(m, resolvedThreadId)
              : m,
          );

          const confirmedAssistant = attachThreadIdToMessage(
            executed.confirmedAssistantMessage,
            resolvedThreadId,
          );

          return [...next, confirmedAssistant];
        });

        setLastFailed(null);

        applyUserStateFromSendResult({
          executed,
          normalizeState,
          setUserState,
        });

        await runSendThreadPostProcess({
          supabase,
          isLoggedIn: executed.isLoggedIn,
          threadIdForUi: resolvedThreadId,
          userText: text,
          confirmedThreadSummary: executed.confirmedThreadSummary,
          legacyThread: executed.legacyThread,
          renameGuardSet: autoRenameDoneRef.current,
          onThreadRenamed,
        });
      } catch (e: any) {
        handleChatSendFailure({
          err: e,
          text,
          conversationId: String(cid ?? "").trim(),
          uiLangForFailed,
          clientRequestId,
          setLastFailed,
          setUserStateErr,
        });
      } finally {
        inflightRef.current = false;
        setLoading(false);

        if (atBottomRef.current) {
          microtask(() => scrollToBottom("auto"));
        }
      }
    },
    [
      supabase,
      uiLang,
      ui,
      detectUserLang,
      getMemoryBlock,
      setMessages,
      setVisibleCount,
      setUserStateErr,
      setUserState,
      setLoading,
      atBottomRef,
      scrollToBottom,
      normalizeState,
      setLastFailed,
      onThreadIdResolved,
      onThreadRenamed,
      onFutureChainPersist,
    ],
  );

  const sendMessage = useCallback(
    async (textOverride?: string) => {
      if (loading) return;

      const clientRequestId = genClientRequestId();

      const base =
        typeof textOverride === "string" ? textOverride : String(input ?? "");
      const raw = clampText(base);
      const text = normalizeForSend(raw);
      if (!text) return;

      const conversationIdSeed = normalizeConversationIdSeed(activeThreadId);

      setInput("");

      await sendCore({
        text,
        conversationIdSeed,
        uiLangForFailed: uiLang,
        clientRequestId,
      });
    },
    [loading, input, clampText, activeThreadId, setInput, sendCore, uiLang],
  );

  const retryLastFailed = useCallback(
    async () => {
      if (isChatSendComposingNow({ getIsComposing })) return;
      if (loading) return;
      if (!lastFailed) return;

      const prepared = await prepareRetrySend({
        supabase,
        lastFailed,
        loadMessages,
        setUserStateErr,
        setLastFailed,
      });

      if (!prepared.ok) return;

      await sendCore({
        text: prepared.text,
        conversationIdSeed: prepared.conversationId,
        uiLangForFailed: prepared.uiLangForFailed,
        clientRequestId: prepared.clientRequestId,
      });
    },
    [
      getIsComposing,
      loading,
      lastFailed,
      loadMessages,
      supabase,
      sendCore,
      setUserStateErr,
      setLastFailed,
    ],
  );

  return { sendMessage, retryLastFailed };
}

/*
【このファイルの正式役割】
送信フロー全体を管理し、user message追加、assistant message確定反映、thread反映、retry をつなぐ親ファイル。
API送信実行本体は持たず、子へ渡して結果を受け取る。
pending user message生成本体は持たず、子へ渡して結果を受け取る。
送信後 userState反映本体は持たず、子へ渡して結果を受け取る。
送信後スレッド反映本体は持たず、子へ渡して結果を受け取る。
retry 前準備本体も持たず、子へ渡して結果を受け取る。
送信失敗処理本体は持たず、子へ渡して結果を受け取る。
重複送信判定本体は持たず、子へ渡して結果を受け取る。
IME composing 判定本体は持たず、子へ渡して結果を受け取る。
親は入口・中継・UI反映に寄せる。

【今回このファイルで修正したこと】
- onFutureChainPersist を任意callbackとして追加した。
- runChatSendRequestExecution(...) から受け取った executed.futureChainPersist を、再判定せず呼び出し元へ渡すようにした。
- Future Chain の保存可否、state_changed、state_level、Compass、HOPY回答○、DB保存、MEMORIES、DASHBOARD は再判定していない。
- ChatClient.tsx、ChatClientView.tsx、ChatFutureChainNotice.tsx には触れていない。

/components/chat/lib/useChatSend.ts
*/