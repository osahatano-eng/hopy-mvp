// /app/api/chat/_lib/route/guest.ts
import OpenAI from "openai";

import {
  createInitialNotificationState,
  incrementNotification,
} from "../state/notification";
import { decideBadgeFromAssistantReply } from "../state/notificationPolicy";
import type { Lang } from "../router/simpleRouter";
import type { PromptBundle } from "./promptBundle";
import { buildPromptBundle } from "./promptBundle";
import { generateAssistantReply } from "./openai";
import { systemCorePrompt } from "../system/system";
import { attachDebugPayload } from "./debugPayload";
import { resolveClientRequestIdFromBody } from "./requestBody";

type HandleGuestChatParams = {
  openai: OpenAI;
  modelName: string;
  body: any;
  userText: string;
  uiLang: Lang;
  replyLang: Lang;
  routedLang: Lang | null;
  buildSig: string;
  debugSave: boolean;
  openaiTimeoutMs: number;
  memoryExtractTimeoutMs: number;
  memoryMinIntervalSec: number;
};

type HandleGuestChatResult = {
  payload: any;
};

export async function handleGuestChat(
  params: HandleGuestChatParams,
): Promise<HandleGuestChatResult> {
  const {
    openai,
    modelName,
    body,
    userText,
    uiLang,
    replyLang,
    routedLang,
    buildSig,
    debugSave,
    openaiTimeoutMs,
    memoryExtractTimeoutMs,
    memoryMinIntervalSec,
  } = params;

  const resolvedPlan = "free" as const;

  const promptBundle: PromptBundle = buildPromptBundle({
    resolvedPlan,
    coreSystemPrompt: systemCorePrompt,
    uiLang,
    replyLang,
    stateForSystem: null,
    memoryBlock: "",
    userText,
    conversationId: "",
  });

  const guestReply = await generateAssistantReply({
    openai,
    modelName,
    promptBundle,
    history: [],
    userText,
    replyLang,
    phaseForParams: 1,
    openaiTimeoutMs,
  });

  const assistantText = guestReply.assistantText;
  const openai_ok = guestReply.openai_ok;
  const openai_error = guestReply.openai_error;

  let notification = createInitialNotificationState();
  const decision = decideBadgeFromAssistantReply(assistantText);
  if (decision.inc) {
    notification = incrementNotification({
      state: notification,
      amount: decision.amount,
      reason: decision.reason,
    });
  }

  const payload: any = {
    ok: true,
    reply: assistantText,
    state: null,
    notification,
    guest: true,
  };

  if (debugSave) {
    attachDebugPayload({
      payload,
      buildSig,
      openaiTimeoutMs,
      contextLimit: 0,
      memoryExtractTimeoutMs,
      memoryMinIntervalSec,
      memoryCleanEnabled: false,
      memoryCleanLimit: 0,
      enforceThreadOwnership: false,
      missingThreadReuseWindowSec: 0,
      openai_ok,
      openai_error,
      userMessageId: "",
      insUserOk: false,
      assistantMessageId: "",
      insAsstOk: false,
      replyLang,
      resolvedPlan,
      memoryInjected: false,
      memoryBlock: "",
      ctxRes: { ok: true, items: [] },
      mem_write_attempted: false,
      mem_write_allowed: false,
      mem_write_inserted: 0,
      mem_write_reason: "guest_mode",
      mem_items_count: 0,
      mem_parse_ok: null,
      mem_extract_preview: null,
      mem_used_heuristic: false,
      st: { ok: false, guest: true },
      audit_ok: null,
      audit_error: null,
      precheck_not_found: false,
      auto_title_ok: null,
      auto_title_updated: null,
      auto_title_reason: "guest_mode",
      auto_title_title: null,
      server_created_thread: false,
      server_created_thread_title: null,
      server_reused_recent_thread: false,
      server_reused_recent_thread_title: null,
      clientRequestIdIn: resolveClientRequestIdFromBody(body),
      server_created_client_request_id: null,
      accessToken: "",
      uiLang,
      routedLang,
      userText,
      response_generation_log_ok: null,
      response_generation_log_error: null,
      state_transition_signal_ok: null,
      state_transition_signal_error: null,
    });
  }

  return {
    payload,
  };
}

export default handleGuestChat;

/*
このファイルの正式役割
guest 経路のチャット処理専用ファイル。
未ログイン時の prompt 構築、OpenAI 呼び出し、通知決定、debug payload 添付を行い、
guest 用の最終 payload を返す。
*/

/*
【今回このファイルで修正したこと】
- buildPromptBundle に required の resolvedPlan を追加した。
- guest 経路の plan を free として固定した。
- attachDebugPayload に resolvedPlan を追加した。
- attachDebugPayload の引数を現在の DebugPayloadArgs に合わせた。
- guest 経路で boolean 必須の insUserOk / insAsstOk を false にそろえた。
- 不要な mem_write_ok / mem_write_error を削除した。
- required の response_generation_log_* / state_transition_signal_* を null で追加した。
*/
// このファイルの正式役割: guest 経路のチャット処理専用ファイル