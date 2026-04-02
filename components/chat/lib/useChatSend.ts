// /components/chat/lib/useChatSend.ts
"use client";

import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction, MutableRefObject } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMsg, Lang } from "./chatTypes";
import { renameThread } from "./threadApi";
import {
  buildAutoTitle,
  classifyError,
  formatErrorText,
  genClientRequestId,
  getChatEndpoint,
  isDefaultThreadTitle,
  isTemporaryGuestThreadId,
  logWarn,
  microtask,
  mkTempId,
  normalizeForSend,
  pickLang,
  pickReply,
  safeLoadPersistedActiveThreadId,
  safePersistActiveThreadId,
  safeReadJson,
} from "./chatSendShared";
import { resolveAuthContextForSend } from "./chatSendAuth";
import {
  mergeAssistantStateFields,
  normalizeAssistantStatePayload,
  pickThread,
  pickThreadId,
  type ApiThread,
} from "./chatSendState";
import {
  WAITING_MESSAGE_INTERVAL_MS,
  resolveWaitingMessage,
} from "./chatSendWaitingMessages";
import {
  mergeAssistantCompassFields,
  resolveConfirmedCompassPrompt,
  resolveConfirmedCompassText,
} from "./chatSendCompass";

export type FailedSend = {
  text: string;
  uiLang: Lang;
  conversationId: string;
  at: number;
  errorText: string;
  clientRequestId?: string;
};

type UiStrings = {
  loginAlert: string;
  emptyReply: string;
};

type ConfirmedStatePayload = {
  state_level?: number;
  current_phase?: number;
  prev_state_level?: number;
  prev_phase?: number;
  state_changed?: boolean;
};

type ConfirmedThreadSummaryPayload = {
  thread_id?: string;
  latest_reply_id?: string;
  latest_reply_at?: string;
  latest_confirmed_state?: ConfirmedStatePayload | null;
  title?: string;
  next_title?: string;
  title_updated?: boolean;
};

type ConfirmedCompassPayload = {
  text?: string | null;
  prompt?: string | null;
};

type ConfirmedMeaningPayload = {
  reply?: string;
  state?: ConfirmedStatePayload | null;
  thread_summary?: ConfirmedThreadSummaryPayload | null;
  memory_candidates?: unknown;
  dashboard_signals?: unknown;
  notification_signal?: unknown;
  ui_effects?: unknown;
  compass?: ConfirmedCompassPayload | null;
};

type ApiResponse<TState> = {
  ok: boolean;
  reply?: string;
  text?: string;
  lang?: Lang;
  uiLang?: Lang;
  thread?: ApiThread;
  thread_id?: string;
  conversation_id?: string;
  conversationId?: string;
  state?: TState | null;
  state_ok?: boolean;
  state_available?: boolean;
  state_updated?: boolean;
  state_error?: any | null;
  state_skipped?: boolean;
  state_skip_reason?: string | null;
  user_saved?: boolean;
  assistant_saved?: boolean;
  error?: string;
  message?: string;
  assistant_state?: any;
  assistantState?: any;
  hopy_confirmed_payload?: ConfirmedMeaningPayload | null;
  compass?: {
    text?: string | null;
    prompt?: string | null;
  } | null;
  compassText?: string | null;
  compassPrompt?: string | null;
  compass_text?: string | null;
  compass_prompt?: string | null;
};

function mergeConfirmedMeaningFields(
  message: ChatMsg,
  confirmedPayload: ConfirmedMeaningPayload | null
): ChatMsg {
  const next = { ...(message as any) };

  if (confirmedPayload) {
    next.hopy_confirmed_payload = confirmedPayload;
  } else {
    delete next.hopy_confirmed_payload;
  }

  return next as ChatMsg;
}

export function useChatSend<TState>(params: {
  supabase: SupabaseClient;
  uiLang: Lang;
  ui: UiStrings;
  activeThreadId: string | null;
  ensureThreadId?: () => Promise<string | null>;
  onThreadIdResolved?: (threadId: string) => void;
  onThreadRenamed?: (thread: ApiThread) => void;
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  setMessages: Dispatch<SetStateAction<ChatMsg[]>>;
  setVisibleCount: Dispatch<SetStateAction<number>>;
  atBottomRef: MutableRefObject<boolean>;
  setAtBottom: (v: boolean) => void;
  scrollToBottom: (mode?: "auto" | "smooth") => void;
  lastFailed: FailedSend | null;
  setLastFailed: (v: FailedSend | null) => void;
  normalizeState: (s: any) => TState | null;
  setUserState: (s: TState | null) => void;
  setUserStateErr: (s: string | null) => void;
  clampText: (s: string, max?: number) => string;
  detectUserLang: (text: string) => Lang;
  loadMessages: (supabase: SupabaseClient, threadId: string) => Promise<ChatMsg[]>;
  getMemoryBlock?: () => string;
  getIsComposing?: () => boolean;
}) {
  const {
    supabase,
    uiLang,
    ui,
    activeThreadId,
    ensureThreadId,
    onThreadIdResolved,
    onThreadRenamed,
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
  const sendGateRef = useRef(false);
  const autoRenameDoneRef = useRef<Set<string>>(new Set());
  const lastSigRef = useRef<{ sig: string; at: number } | null>(null);

  function shouldBlockDuplicate(text: string, conversationId: string | null) {
    const cid = String(conversationId ?? "").trim() || "no_thread";
    const sig = `${cid}::${text}`;
    const now = Date.now();
    const prev = lastSigRef.current;
    lastSigRef.current = { sig, at: now };
    if (!prev) return false;
    return prev.sig === sig && now - prev.at < 600;
  }

  const isComposingNow = () => {
    try {
      return typeof getIsComposing === "function" ? Boolean(getIsComposing()) : false;
    } catch {
      return false;
    }
  };

  const sendCore = useCallback(
    async (opts: {
      text: string;
      conversationIdSeed: string | null;
      uiLangForFailed: Lang;
      clientRequestId?: string;
    }) => {
      const { text, conversationIdSeed, uiLangForFailed, clientRequestId } = opts;

      if (isComposingNow()) return;
      if (inflightRef.current) return;
      inflightRef.current = true;

      if (shouldBlockDuplicate(text, conversationIdSeed)) {
        inflightRef.current = false;
        return;
      }

      let cid = String(conversationIdSeed ?? "").trim();

      setLoading(true);
      setUserStateErr(null);

      const msgLang = detectUserLang(text);
      const requestLang: Lang = uiLang;

      const userMsgId = mkTempId();
      const userMsg: ChatMsg = {
        id: userMsgId,
        role: "user",
        content: text,
        lang: msgLang,
        created_at: new Date().toISOString(),
      };

      const pendingId = mkTempId();
      const pendingStartedAt = Date.now();
      const pendingMsg: ChatMsg = {
        id: pendingId,
        role: "assistant",
        content: resolveWaitingMessage(requestLang, 0),
        lang: requestLang,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, pendingMsg]);
      setVisibleCount((v) => Math.max(v, 200));

      const pendingMessageTimer =
        typeof window !== "undefined"
          ? window.setInterval(() => {
              const nextText = resolveWaitingMessage(
                requestLang,
                Date.now() - pendingStartedAt
              );

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === pendingId
                    ? {
                        ...m,
                        content: nextText,
                      }
                    : m
                )
              );
            }, WAITING_MESSAGE_INTERVAL_MS)
          : null;

      const FETCH_TIMEOUT_MS = 90000;
      const controller =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller
        ? window.setTimeout(() => {
            try {
              controller.abort();
            } catch {}
          }, FETCH_TIMEOUT_MS)
        : null;

      try {
        const auth = await resolveAuthContextForSend(supabase);
        const isLoggedIn = auth.isLoggedIn;
        const accessToken = auth.accessToken;

        if (isLoggedIn) {
          if (!cid || isTemporaryGuestThreadId(cid)) {
            const current = String(activeThreadId ?? "").trim();
            if (current && !isTemporaryGuestThreadId(current)) {
              cid = current;
            } else {
              const persisted = String(
                safeLoadPersistedActiveThreadId() ?? ""
              ).trim();
              if (persisted && !isTemporaryGuestThreadId(persisted)) {
                cid = persisted;
              } else if (typeof ensureThreadId === "function") {
                const ensured = String((await ensureThreadId()) ?? "").trim();
                if (ensured && !isTemporaryGuestThreadId(ensured)) {
                  cid = ensured;
                } else {
                  cid = "";
                }
              } else {
                cid = "";
              }
            }
          }

          if (cid) {
            safePersistActiveThreadId(cid);
          }
        } else {
          cid = "";
        }

        const endpoint = getChatEndpoint();
        const memory_block =
          typeof getMemoryBlock === "function"
            ? String(getMemoryBlock() ?? "").trim()
            : "";

        const body: any = {
          text,
          lang: requestLang,
          memory_block,
        };

        const normalizedClientRequestId = String(clientRequestId ?? "").trim();

        if (isLoggedIn && normalizedClientRequestId) {
          body.client_request_id = normalizedClientRequestId;
        }

        if (isLoggedIn && cid) body.thread_id = cid;

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (isLoggedIn && accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller ? controller.signal : undefined,
        });

        const payload = (await safeReadJson(res)) as ApiResponse<TState> | null;

        if (!res.ok || !payload || !payload.ok) {
          const rawMsg = String(payload?.message || payload?.error || "api_error");
          const { kind, message } = classifyError({
            err: new Error(rawMsg),
            status: res.status,
            payload,
          });
          const errText = formatErrorText(kind, message, res.status);
          throw Object.assign(new Error(errText), {
            __kind: kind,
            __status: res.status,
          });
        }

        const confirmedPayload = payload.hopy_confirmed_payload ?? null;

        const reply = String(
          confirmedPayload?.reply ?? pickReply(payload) ?? ""
        ).trim();

        if (!reply) {
          const errText = formatErrorText("Validation", ui.emptyReply, 400);
          throw Object.assign(new Error(errText), {
            __kind: "Validation",
            __status: 400,
          });
        }

        const normalizedAssistantState =
          confirmedPayload?.state != null
            ? confirmedPayload.state
            : normalizeAssistantStatePayload(payload);

        const compassText = resolveConfirmedCompassText(payload, confirmedPayload);
        const compassPrompt = resolveConfirmedCompassPrompt(
          payload,
          confirmedPayload
        );

        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? mergeAssistantCompassFields(
                  mergeConfirmedMeaningFields(
                    mergeAssistantStateFields(
                      {
                        ...m,
                        content: reply,
                        lang: pickLang(payload, requestLang),
                      },
                      normalizedAssistantState
                        ? { ...payload, assistant_state: normalizedAssistantState }
                        : payload
                    ),
                    confirmedPayload
                  ),
                  compassText,
                  compassPrompt
                )
              : m
          )
        );

        const confirmedThreadSummary = confirmedPayload?.thread_summary ?? null;
        const legacyThread = pickThread(payload);

        const confirmedThreadId = String(
          confirmedThreadSummary?.thread_id ?? ""
        ).trim();
        const legacyThreadId = String(legacyThread?.id ?? "").trim();
        const payloadConversationId = String(
          payload.conversation_id ?? payload.conversationId ?? payload.thread_id ?? ""
        ).trim();

        const threadIdForReload =
          confirmedThreadId ||
          legacyThreadId ||
          payloadConversationId ||
          cid ||
          pickThreadId(payload);

        if (threadIdForReload && isLoggedIn) {
          try {
            await loadMessages(supabase, threadIdForReload);
          } catch (e) {
            logWarn("[useChatSend] loadMessages after confirmed assistant failed", {
              threadId: threadIdForReload,
              reason: String((e as any)?.message ?? e ?? ""),
            });
          }
        }

        setLastFailed(null);

        const hasConfirmedState = confirmedPayload?.state != null;
        const hasLegacyState =
          Object.prototype.hasOwnProperty.call(payload, "state") ||
          payload.state_available === true ||
          payload.state_updated === true;

        if (hasConfirmedState || hasLegacyState) {
          const normalized = normalizeState(
            hasConfirmedState
              ? confirmedPayload?.state
              : normalizedAssistantState ?? payload.state
          );
          setUserState(normalized);
        }

        if (isLoggedIn) {
          try {
            const serverTitle = String(
              confirmedThreadSummary?.next_title ??
                confirmedThreadSummary?.title ??
                legacyThread?.title ??
                ""
            ).trim();

            const threadIdForUi = threadIdForReload;

            if (threadIdForUi) {
              safePersistActiveThreadId(threadIdForUi);

              const cidNow = String(cid ?? "").trim();
              const needResolve =
                !cidNow || (threadIdForUi && cidNow && threadIdForUi !== cidNow);

              if (needResolve && typeof onThreadIdResolved === "function") {
                microtask(() => {
                  try {
                    onThreadIdResolved(threadIdForUi);
                  } catch {}
                });
              }

              const refreshPayload: any = {
                reason: "send:resolved",
                id: threadIdForUi,
                threadId: threadIdForUi,
                updated_at: new Date().toISOString(),
              };

              if (serverTitle) {
                refreshPayload.title = serverTitle;
              }

              try {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("hopy:threads-refresh", {
                      detail: refreshPayload,
                    })
                  );
                }
              } catch {}

              const autoTitle = buildAutoTitle(text);

              if (autoTitle && isDefaultThreadTitle(serverTitle)) {
                if (!autoRenameDoneRef.current.has(threadIdForUi)) {
                  autoRenameDoneRef.current.add(threadIdForUi);

                  if (typeof onThreadRenamed === "function") {
                    microtask(() => {
                      try {
                        onThreadRenamed({ id: threadIdForUi, title: autoTitle });
                      } catch {}
                    });
                  }

                  microtask(() => {
                    (async () => {
                      const r = await renameThread({
                        supabase,
                        threadId: threadIdForUi,
                        nextTitle: autoTitle,
                      });

                      if (r.ok) {
                        const savedTitle =
                          String((r.thread as any)?.title ?? autoTitle).trim() ||
                          autoTitle;
                        if (typeof onThreadRenamed === "function") {
                          microtask(() => {
                            try {
                              onThreadRenamed({
                                id: threadIdForUi,
                                title: savedTitle,
                              });
                            } catch {}
                          });
                        }
                        return;
                      }

                      autoRenameDoneRef.current.delete(threadIdForUi);
                      logWarn("[useChatSend] auto renameThread failed", {
                        threadId: threadIdForUi,
                        reason: r.error,
                      });
                    })().catch((e) => {
                      autoRenameDoneRef.current.delete(threadIdForUi);
                      logWarn("[useChatSend] auto renameThread exception", {
                        threadId: threadIdForUi,
                        reason: String(e?.message ?? e ?? ""),
                      });
                    });
                  });
                }
              } else if (serverTitle && typeof onThreadRenamed === "function") {
                microtask(() => {
                  try {
                    onThreadRenamed({ id: threadIdForUi, title: serverTitle });
                  } catch {}
                });
              }
            }
          } catch {}
        }
      } catch (e: any) {
        const pre = String(e?.message ?? "");
        let errText = pre.trim();

        if (!/^\[[A-Za-z\/]+/.test(errText)) {
          const { kind, message } = classifyError({ err: e });
          errText = formatErrorText(kind, message);
        }

        setMessages((prev) => prev.filter((m) => m.id !== pendingId));

        setLastFailed({
          text,
          uiLang: uiLangForFailed,
          conversationId: cid,
          at: Date.now(),
          errorText: errText,
          clientRequestId: String(clientRequestId ?? "").trim() || undefined,
        });

        setUserStateErr(errText);
      } finally {
        if (pendingMessageTimer != null) {
          try {
            window.clearInterval(pendingMessageTimer);
          } catch {}
        }

        if (timer != null) {
          try {
            window.clearTimeout(timer);
          } catch {}
        }

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
      ui.emptyReply,
      activeThreadId,
      ensureThreadId,
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
      onThreadRenamed,
      onThreadIdResolved,
      loadMessages,
    ]
  );

  const sendMessage = useCallback(
    async (textOverride?: string) => {
      if (isComposingNow()) return;
      if (loading) return;
      if (sendGateRef.current) return;
      sendGateRef.current = true;

      const clientRequestId = genClientRequestId();

      try {
        const base =
          typeof textOverride === "string" ? textOverride : String(input ?? "");
        const raw = clampText(base);

        const text = normalizeForSend(raw);
        if (!text) return;

        const conversationIdSeed = String(activeThreadId ?? "").trim() || null;

        setInput("");
        microtask(() => setInput(""));
        try {
          requestAnimationFrame(() => setInput(""));
        } catch {}

        await sendCore({
          text,
          conversationIdSeed,
          uiLangForFailed: uiLang,
          clientRequestId,
        });
      } finally {
        sendGateRef.current = false;
      }
    },
    [loading, input, clampText, setInput, sendCore, uiLang, activeThreadId]
  );

  const retryLastFailed = useCallback(
    async () => {
      if (isComposingNow()) return;
      if (loading) return;
      if (!lastFailed) return;

      const text = normalizeForSend(String(lastFailed.text ?? ""));
      if (!text) return;

      const clientRequestId =
        String(lastFailed.clientRequestId ?? "").trim() || genClientRequestId();

      const auth = await resolveAuthContextForSend(supabase);

      let conversationId = auth.isLoggedIn
        ? String(lastFailed.conversationId ?? "").trim() || null
        : null;

      if (
        auth.isLoggedIn &&
        conversationId &&
        isTemporaryGuestThreadId(conversationId)
      ) {
        conversationId = null;
      }

      if (auth.isLoggedIn && conversationId) {
        safePersistActiveThreadId(conversationId);

        try {
          await loadMessages(supabase, conversationId);
        } catch (e: any) {
          const { kind, message } = classifyError({ err: e });
          const errText = formatErrorText(kind, message);

          setUserStateErr(errText);
          setLastFailed((prev) =>
            prev
              ? {
                  ...prev,
                  at: Date.now(),
                  errorText: errText,
                  clientRequestId,
                }
              : prev
          );
          return;
        }
      }

      await sendCore({
        text,
        conversationIdSeed: conversationId,
        uiLangForFailed: lastFailed.uiLang,
        clientRequestId,
      });
    },
    [
      loading,
      lastFailed,
      loadMessages,
      supabase,
      sendCore,
      setUserStateErr,
      setLastFailed,
    ]
  );

  return { sendMessage, retryLastFailed };
}

/*
このファイルの正式役割
送信フロー全体を管理し、pending追加、API送信、assistant message確定反映、state反映、thread反映、retry をつなぐ親ファイル。
*/
/*
【今回このファイルで修正したこと】
- auth 解決関数とその型を親ファイルから削除しました。
- /components/chat/lib/chatSendAuth.ts を import し、親ファイルは auth 解決を呼ぶだけにしました。
- 送信本体、state反映、thread解決、retry、rename の責務には触れていません。
*/
/*
このファイルの正式役割
送信フロー全体を管理し、pending追加、API送信、assistant message確定反映、state反映、thread反映、retry をつなぐ親ファイル。
*/