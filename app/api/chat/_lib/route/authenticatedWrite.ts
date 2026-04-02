// /app/api/chat/_lib/route/authenticatedWrite.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import { maybeAutoRenameConversationTitle } from "../db/conversations";
import { saveMessage, saveMessageMaybeReturning } from "../db/messages";
import type { Lang } from "../router/simpleRouter";
import { buildDbErrorPayload } from "./authenticatedErrorPayload";
import type {
  SaveUserMessageOutcome,
  SaveAssistantMessageOutcome,
  AutoTitleOutcome,
  ConfirmedAssistantTurn,
} from "./authenticatedTypes";

export async function saveUserMessageOrError(params: {
  supabase: SupabaseClient;
  authedUserId: string;
  resolvedConversationId: string;
  userText: string;
  uiLang: Lang;
  debugSave: boolean;
  enforceThreadOwnership: boolean;
}): Promise<SaveUserMessageOutcome> {
  const {
    supabase,
    authedUserId,
    resolvedConversationId,
    userText,
    uiLang,
    debugSave,
    enforceThreadOwnership,
  } = params;

  const insUser = await saveMessage({
    supabase,
    userId: authedUserId,
    conversationId: resolvedConversationId,
    role: "user",
    content: userText,
    lang: uiLang,
  });

  if (!insUser.ok) {
    const { status, payload } = buildDbErrorPayload({
      error: (insUser as any).error,
      debugSave,
      enforceThreadOwnership,
      fkError: "thread_not_found",
      saveError: "user_save_failed",
    });
    return { ok: false, status, payload };
  }

  return {
    ok: true,
    userMessageId: insUser.id,
  };
}

export async function runAutoRename(params: {
  supabase: SupabaseClient;
  authedUserId: string;
  resolvedConversationId: string;
  userText: string;
  uiLang: Lang;
}): Promise<AutoTitleOutcome> {
  const { supabase, authedUserId, resolvedConversationId, userText, uiLang } =
    params;

  let auto_title_ok: boolean | null = null;
  let auto_title_updated: boolean | null = null;
  let auto_title_reason: string | null = null;
  let auto_title_title: string | null = null;

  try {
    const r = await maybeAutoRenameConversationTitle({
      supabase,
      userId: authedUserId,
      conversationId: resolvedConversationId,
      userText,
      maxLen: 30,
      defaults:
        uiLang === "ja" ? ["新しいチャット", "新規チャット"] : ["New chat"],
    });
    auto_title_ok = r.ok;
    auto_title_updated = r.updated;
    auto_title_reason = r.reason;
    auto_title_title = r.updated ? String(r.title ?? "").trim() || null : null;
  } catch {
    auto_title_ok = false;
    auto_title_updated = false;
    auto_title_reason = "exception";
    auto_title_title = null;
  }

  return {
    auto_title_ok,
    auto_title_updated,
    auto_title_reason,
    auto_title_title,
  };
}

export async function saveAssistantMessageOrError(params: {
  supabase: SupabaseClient;
  authedUserId: string;
  resolvedConversationId: string;
  confirmedTurn: ConfirmedAssistantTurn;
  replyLang: Lang;
  debugSave: boolean;
  enforceThreadOwnership: boolean;
}): Promise<SaveAssistantMessageOutcome> {
  const {
    supabase,
    authedUserId,
    resolvedConversationId,
    confirmedTurn,
    replyLang,
    debugSave,
    enforceThreadOwnership,
  } = params;

  const insAsst = await saveMessageMaybeReturning({
    supabase,
    userId: authedUserId,
    conversationId: resolvedConversationId,
    role: "assistant",
    content: confirmedTurn.assistantText,
    lang: replyLang,
    returnId: true,
    state_level: confirmedTurn.currentStateLevel,
    current_phase: confirmedTurn.currentPhase,
    state_changed: confirmedTurn.stateChanged,
    prev_phase: confirmedTurn.prevPhase,
    prev_state_level: confirmedTurn.prevStateLevel,
    compass_text:
      typeof confirmedTurn.compassText === "string"
        ? confirmedTurn.compassText
        : undefined,
    compass_prompt:
      typeof confirmedTurn.compassPrompt === "string"
        ? confirmedTurn.compassPrompt
        : undefined,
  });

  if (!insAsst.ok) {
    const { status, payload } = buildDbErrorPayload({
      error: (insAsst as any).error,
      debugSave,
      enforceThreadOwnership,
      fkError: "thread_not_found",
      saveError: "assistant_save_failed",
    });
    return { ok: false, status, payload };
  }

  const assistantMessageId = String((insAsst as any).id ?? "").trim();

  return {
    ok: true,
    assistantMessageId,
    insAsstOk: insAsst.ok,
  };
}

/*
このファイルの正式役割
authenticated 経路の message 保存呼び出しファイル。
user / assistant の保存関数を呼び分け、
assistant では本文と状態値に加えて Compass 保存値も DB 保存関数へ渡す。
*/

/*
【今回このファイルで修正したこと】
修正不要。
このファイルでは assistant 保存後に返ってきた id を assistantMessageId として返しているだけで、
assistant_message_id を保存 payload に載せる責務はまだ持っていないことが確認できた。
今回の直接原因候補はここで確定したが、このファイル単体では保存先の受け口が無いため、
ここだけ先に変えると未貼付ファイル側との整合が崩れる。
*/