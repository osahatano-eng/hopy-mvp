// /app/api/chat/_lib/route/guest.ts
import OpenAI from "openai";

import { createInitialNotificationState, incrementNotification } from "../state/notification";
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
  params: HandleGuestChatParams
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

  const promptBundle: PromptBundle = buildPromptBundle({
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
      insUserOk: null,
      assistantMessageId: "",
      insAsstOk: null,
      replyLang,
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
      mem_write_ok: null,
      mem_write_error: null,
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
    });
  }

  return {
    payload,
  };
}