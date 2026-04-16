// /components/chat/lib/chatSendRequestExecution.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMsg, Lang } from "./chatTypes";
import {
  classifyError,
  formatErrorText,
  getChatEndpoint,
  logWarn,
  mkTempId,
  safePersistActiveThreadId,
  safeReadJson,
} from "./chatSendShared";
import { resolveAuthContextForSend } from "./chatSendAuth";
import {
  normalizeAssistantStatePayload,
  pickThread,
  pickThreadId,
  type ApiThread,
} from "./chatSendState";
import {
  resolveConfirmedCompassPrompt,
  resolveConfirmedCompassText,
} from "./chatSendCompass";
import {
  attachThreadIdToMessage,
  buildConfirmedAssistantMessage,
  type ConfirmedAssistantApiResponse,
} from "./chatSendConfirmedAssistantMessage";

const AUTH_CONTEXT_TIMEOUT_MS = 12000;
const FETCH_TIMEOUT_MS = 90000;

export type ChatSendRequestExecutionUiStrings = {
  emptyReply: string;
};

export type ChatSendRequestExecutionApiResponse<TState> =
  ConfirmedAssistantApiResponse<TState> & {
    thread?: ApiThread;
    thread_id?: string;
    conversation_id?: string;
    conversationId?: string;
  };

type ConfirmedPayloadLike<TState> = NonNullable<
  ChatSendRequestExecutionApiResponse<TState>["hopy_confirmed_payload"]
>;

export type ChatSendRequestExecutionResult<TState> = {
  isLoggedIn: boolean;
  conversationId: string;
  payload: ChatSendRequestExecutionApiResponse<TState>;
  confirmedPayload: ConfirmedPayloadLike<TState> | null;
  reply: string;
  normalizedAssistantState: unknown;
  confirmedThreadSummary: ConfirmedPayloadLike<TState>["thread_summary"] | null;
  legacyThread: ApiThread | null;
  threadIdForReload: string;
  confirmedAssistantMessage: ChatMsg;
  hasConfirmedState: boolean;
  hasLegacyState: boolean;
};

async function resolveAuthContextForSendWithTimeout(
  supabase: SupabaseClient
): Promise<Awaited<ReturnType<typeof resolveAuthContextForSend>>> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      resolveAuthContextForSend(supabase),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("[Auth/Timeout] auth_context_timeout"));
        }, AUTH_CONTEXT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer != null) {
      try {
        clearTimeout(timer);
      } catch {}
    }
  }
}

export async function runChatSendRequestExecution<TState>(args: {
  supabase: SupabaseClient;
  uiLang: Lang;
  ui: ChatSendRequestExecutionUiStrings;
  text: string;
  conversationIdSeed: string | null;
  clientRequestId?: string;
  getMemoryBlock?: () => string;
}) {
  const {
    supabase,
    uiLang,
    ui,
    text,
    conversationIdSeed,
    clientRequestId,
    getMemoryBlock,
  } = args;

  let cid = String(conversationIdSeed ?? "").trim();

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer =
    controller && typeof window !== "undefined"
      ? window.setTimeout(() => {
          try {
            controller.abort();
          } catch {}
        }, FETCH_TIMEOUT_MS)
      : null;

  try {
    const authContext = await resolveAuthContextForSendWithTimeout(supabase);
    const isLoggedIn = authContext.isLoggedIn;
    const accessToken = authContext.accessToken;

    if (isLoggedIn) {
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

    const body: Record<string, unknown> = {
      text,
      lang: uiLang,
      memory_block,
    };

    const normalizedClientRequestId = String(clientRequestId ?? "").trim();

    if (isLoggedIn && normalizedClientRequestId) {
      body.client_request_id = normalizedClientRequestId;
    }

    if (isLoggedIn && cid) {
      body.thread_id = cid;
    }

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

    const payload =
      (await safeReadJson(
        res
      )) as ChatSendRequestExecutionApiResponse<TState> | null;

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
        __conversationId: cid,
      });
    }

    const confirmedPayload = payload.hopy_confirmed_payload ?? null;

    const reply = String(
      confirmedPayload?.reply ?? payload.reply ?? payload.text ?? ""
    ).trim();

    if (!reply) {
      const errText = formatErrorText("Validation", ui.emptyReply, 400);
      throw Object.assign(new Error(errText), {
        __kind: "Validation",
        __status: 400,
        __conversationId: cid,
      });
    }

    const normalizedAssistantState =
      confirmedPayload?.state != null
        ? confirmedPayload.state
        : normalizeAssistantStatePayload(payload);

    let compassText: string | null = null;
    let compassPrompt: string | null = null;

    try {
      compassText = resolveConfirmedCompassText(payload, confirmedPayload);
      compassPrompt = resolveConfirmedCompassPrompt(payload, confirmedPayload);
    } catch (e) {
      logWarn("[chatSendRequestExecution] resolve confirmed compass failed", {
        reason: String((e as any)?.message ?? e ?? ""),
        hasPayloadCompass: Boolean(payload.compass),
        hasConfirmedPayloadCompass: Boolean(confirmedPayload?.compass),
      });
    }

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

    const confirmedAssistantMessage = buildConfirmedAssistantMessage({
      message: attachThreadIdToMessage(
        {
          id: mkTempId(),
          role: "assistant",
          content: "",
          lang: uiLang,
          created_at: new Date().toISOString(),
        } as ChatMsg,
        threadIdForReload || null
      ),
      payload,
      reply,
      requestLang: uiLang,
      normalizedAssistantState,
      confirmedPayload,
      compassText,
      compassPrompt,
      resolvedThreadId: threadIdForReload,
    });

    const hasConfirmedState = confirmedPayload?.state != null;
    const hasLegacyState =
      Object.prototype.hasOwnProperty.call(payload, "state") ||
      payload.state_available === true ||
      payload.state_updated === true;

    return {
      isLoggedIn,
      conversationId: cid,
      payload,
      confirmedPayload,
      reply,
      normalizedAssistantState,
      confirmedThreadSummary,
      legacyThread,
      threadIdForReload,
      confirmedAssistantMessage,
      hasConfirmedState,
      hasLegacyState,
    } satisfies ChatSendRequestExecutionResult<TState>;
  } finally {
    if (timer != null) {
      try {
        window.clearTimeout(timer);
      } catch {}
    }
  }
}

/*
このファイルの正式役割
useChatSend 親ファイルから分離した、API送信実行責務の子ファイル。
認証解決、送信リクエスト組み立て、fetch 実行、payload 検証、reply 解決、
threadId 解決、confirmed assistant message の生成前提をまとめて返す。
UI反映、messages 反映、loading 制御、retry入口制御は持たない。
HOPY唯一の正を再判定せず、受け取った confirmed payload をそのまま使う。
*/

/*
【今回このファイルで修正したこと】
1. useChatSend.ts に残っていた API送信実行責務を、この新規子ファイルへ受け皿として切り出しました。
2. resolveAuthContextForSendWithTimeout をこの子へ移し、認証タイムアウト責務を親から外せる形にしました。
3. auth 解決、endpoint / headers / body 組み立て、fetch、payload 検証、reply 解決、threadId 解決をこの子へ集約しました。
4. confirmed payload / state_changed / Compass / 1..5 の意味判定は再生成せず、そのまま受け取って返す形に固定しました。
*/

/* /components/chat/lib/chatSendRequestExecution.ts */