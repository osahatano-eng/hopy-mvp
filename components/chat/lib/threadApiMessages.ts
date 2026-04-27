// /components/chat/lib/threadApiMessages.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dispatch, SetStateAction } from "react";

import type { ChatMsg } from "./chatTypes";

import { logInfo, logWarn, normMsg, sleep } from "./threadApiSupport";
import {
  isAuthNotReadyError,
  isConversationIdMissingError,
  isMissingColumnError,
} from "./threadApiErrors";
import { waitForAuthReady } from "./threadApiAuth";

export type LoadMessagesStateArgs = {
  supabase: SupabaseClient;
  threadId: string;
  setMessages: Dispatch<SetStateAction<ChatMsg[]>>;
  setVisibleCount: Dispatch<SetStateAction<number>>;
  scrollToBottom: (behavior?: ScrollBehavior | "auto" | "smooth") => void;
};

type FutureChainBridgeEventRow = {
  id?: string | null;
  source_assistant_message_id?: string | null;
  handoff_message_snapshot?: string | null;
  transition_kind?: string | null;
  transition_meaning?: string | null;
  major_category?: string | null;
  minor_category?: string | null;
  change_trigger_key?: string | null;
  support_shape_key?: string | null;
  status?: string | null;
};

type FutureChainDeliveryEventRow = {
  id?: string | null;
  recipient_assistant_message_id?: string | null;
  bridge_event_id?: string | null;
  pattern_id?: string | null;
  recipient_plan?: string | null;
  display_mode?: string | null;
  recipient_state_level?: number | null;
  major_category?: string | null;
  minor_category?: string | null;
  change_trigger_key?: string | null;
  display_title?: string | null;
  display_hint?: string | null;
  display_flow?: string | null;
  delivery_reason?: string | null;
  status?: string | null;
};

function shouldRetryLoadMessages(err: any) {
  const s = String(err?.message ?? err ?? "").toLowerCase();
  if (!s) return false;

  if (s.includes("auth_not_ready")) return true;
  if (s.includes("401") || s.includes("403")) return true;
  if (s.includes("unauthorized") || s.includes("forbidden")) return true;
  if (s.includes("jwt") || s.includes("token") || s.includes("refresh")) return true;

  if (s.includes("failed to fetch")) return true;
  if (s.includes("network")) return true;
  if (s.includes("timeout")) return true;
  if (s.includes("temporar")) return true;
  if (s.includes("503")) return true;
  if (s.includes("502")) return true;
  if (s.includes("504")) return true;
  if (s.includes("429")) return true;

  return false;
}

function safePhase1to5(v: any): 1 | 2 | 3 | 4 | 5 | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 1 || i > 5) return null;
  return i as 1 | 2 | 3 | 4 | 5;
}

function safeBoolOrNull(v: any): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1" || v === "true") return true;
  if (v === 0 || v === "0" || v === "false") return false;
  return null;
}

function safeTextOrNull(v: any): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

function isRecord(value: any): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveMessageStableId(msg: ChatMsg): string | null {
  const raw = msg as any;

  const candidates = [
    raw?.id,
    raw?.message_id,
    raw?.assistant_message_id,
    raw?.server_message_id,
    raw?.hopy_confirmed_payload?.assistant_message_id,
    raw?.hopy_confirmed_payload?.thread_summary?.latest_reply_id,
  ];

  for (const v of candidates) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }

  return null;
}

function resolveCurrentPhase(raw: any): 1 | 2 | 3 | 4 | 5 | null {
  return safePhase1to5(
    raw?.current_phase ??
      raw?.assistant_state?.current_phase ??
      raw?.state?.current_phase ??
      raw?.hopy_state?.current_phase ??
      raw?.hopy_confirmed_payload?.state?.current_phase ??
      raw?.state_level ??
      raw?.assistant_state?.state_level ??
      raw?.state?.state_level ??
      raw?.hopy_state?.state_level ??
      raw?.hopy_confirmed_payload?.state?.state_level,
  );
}

function resolvePrevPhase(raw: any): 1 | 2 | 3 | 4 | 5 | null {
  return safePhase1to5(
    raw?.prev_phase ??
      raw?.assistant_state?.prev_phase ??
      raw?.state?.prev_phase ??
      raw?.hopy_state?.prev_phase ??
      raw?.hopy_confirmed_payload?.state?.prev_phase ??
      raw?.prev_state_level ??
      raw?.assistant_state?.prev_state_level ??
      raw?.state?.prev_state_level ??
      raw?.hopy_state?.prev_state_level ??
      raw?.hopy_confirmed_payload?.state?.prev_state_level,
  );
}

function resolveStateChanged(raw: any): boolean | null {
  return safeBoolOrNull(
    raw?.state_changed ??
      raw?.assistant_state?.state_changed ??
      raw?.state?.state_changed ??
      raw?.hopy_state?.state_changed ??
      raw?.hopy_confirmed_payload?.state?.state_changed,
  );
}

function resolveCompassText(raw: any): string | null {
  return safeTextOrNull(
    raw?.compass_text ??
      raw?.compass?.text ??
      raw?.hopy_confirmed_payload?.compass?.text,
  );
}

function resolveCompassPrompt(raw: any): string | null {
  return safeTextOrNull(
    raw?.compass_prompt ??
      raw?.compass?.prompt ??
      raw?.hopy_confirmed_payload?.compass?.prompt,
  );
}

function buildRenderedMessageSignature(msg: ChatMsg): string {
  const raw = msg as any;

  const role = String(raw?.role ?? "").trim();
  const content = String(raw?.content ?? "");
  const createdAt = String(raw?.created_at ?? "").trim();

  const currentPhase = resolveCurrentPhase(raw);
  const prevPhase = resolvePrevPhase(raw);
  const stateChanged = resolveStateChanged(raw);

  const compassText = resolveCompassText(raw);
  const compassPrompt = resolveCompassPrompt(raw);

  return JSON.stringify({
    role,
    content,
    createdAt,
    currentPhase,
    prevPhase,
    stateChanged,
    compassText,
    compassPrompt,
  });
}

function dedupeLoadedMessages(messages: ChatMsg[]): ChatMsg[] {
  const list = Array.isArray(messages) ? messages : [];
  if (list.length <= 1) return list;

  const seenIds = new Set<string>();
  const seenRenderedSigs = new Set<string>();
  const out: ChatMsg[] = [];

  for (const msg of list) {
    const raw = msg as any;
    const stableId = resolveMessageStableId(msg);

    if (stableId) {
      if (seenIds.has(stableId)) continue;
      seenIds.add(stableId);
    }

    const sig = buildRenderedMessageSignature(msg);

    if (raw?.role === "assistant") {
      if (seenRenderedSigs.has(sig)) continue;
      seenRenderedSigs.add(sig);
    }

    out.push(msg);
  }

  return out;
}

function mapRowsToMessages(rows: any[], threadId: string): ChatMsg[] {
  const raw = Array.isArray(rows) ? rows : [];

  const mapped = raw.map((r: any) => {
    const id = String(r?.id ?? "").trim();
    const roleRaw = String(r?.role ?? "").trim();
    const role = roleRaw === "assistant" ? "assistant" : "user";
    const content = String(r?.content ?? "");
    const lang = r?.lang === "en" ? "en" : "ja";
    const created_at = String(r?.created_at ?? "").trim() || undefined;
    const conversation_id =
      String(r?.conversation_id ?? threadId ?? "").trim() || undefined;

    const out: any = { role, content, lang };
    if (id) out.id = id;
    if (created_at) out.created_at = created_at;
    if (conversation_id) {
      out.conversation_id = conversation_id;
      out.thread_id = conversation_id;
    }

    const currentPhase = safePhase1to5(r?.current_phase);
    const stateLevel = safePhase1to5(r?.state_level);
    const prevPhase = safePhase1to5(r?.prev_phase);
    const prevStateLevel = safePhase1to5(r?.prev_state_level);
    const resolvedChanged = safeBoolOrNull(r?.state_changed);

    if (currentPhase != null) {
      out.current_phase = currentPhase;
    }

    if (stateLevel != null) {
      out.state_level = stateLevel;
    }

    if (resolvedChanged != null) {
      out.state_changed = resolvedChanged;
    }

    if (prevPhase != null) {
      out.prev_phase = prevPhase;
    }

    if (prevStateLevel != null) {
      out.prev_state_level = prevStateLevel;
    }

    const assistantState =
      currentPhase != null ||
      stateLevel != null ||
      resolvedChanged != null ||
      prevPhase != null ||
      prevStateLevel != null
        ? {
            ...(currentPhase != null ? { current_phase: currentPhase } : {}),
            ...(stateLevel != null ? { state_level: stateLevel } : {}),
            ...(resolvedChanged != null ? { state_changed: resolvedChanged } : {}),
            ...(prevPhase != null ? { prev_phase: prevPhase } : {}),
            ...(prevStateLevel != null ? { prev_state_level: prevStateLevel } : {}),
          }
        : null;

    if (assistantState) {
      out.state = assistantState;
      out.assistant_state = assistantState;
      out.hopy_state = assistantState;
    }

    const compassText = safeTextOrNull(r?.compass_text);
    const compassPrompt = safeTextOrNull(r?.compass_prompt);

    const resolvedCompass =
      compassText || compassPrompt
        ? {
            ...(compassText ? { text: compassText } : {}),
            ...(compassPrompt ? { prompt: compassPrompt } : {}),
          }
        : null;

    if (resolvedCompass) {
      out.compass = resolvedCompass;

      if (compassText) {
        out.compass_text = compassText;
      }

      if (compassPrompt) {
        out.compass_prompt = compassPrompt;
      }
    }

    if (role === "assistant" && (assistantState || resolvedCompass || content || id)) {
      out.hopy_confirmed_payload = {
        ...(id ? { assistant_message_id: id } : {}),
        ...(content ? { reply: content } : {}),
        ...(assistantState ? { state: assistantState } : {}),
        ...(resolvedCompass ? { compass: resolvedCompass } : {}),
        ...(id
          ? {
              thread_summary: {
                latest_reply_id: id,
              },
            }
          : {}),
      };
    }

    return out as ChatMsg;
  });

  return dedupeLoadedMessages(mapped);
}

function getAssistantMessageIds(messages: ChatMsg[]): string[] {
  const ids = new Set<string>();

  for (const msg of messages) {
    const raw = msg as any;
    if (raw?.role !== "assistant") continue;

    const id = resolveMessageStableId(msg);
    if (id) ids.add(id);
  }

  return Array.from(ids);
}

async function loadFutureChainBridgeEventMap(params: {
  supabase: SupabaseClient;
  messages: ChatMsg[];
  threadId: string;
}): Promise<Map<string, FutureChainBridgeEventRow>> {
  const assistantIds = getAssistantMessageIds(params.messages);
  const out = new Map<string, FutureChainBridgeEventRow>();

  if (assistantIds.length === 0) {
    return out;
  }

  const { data, error } = await params.supabase
    .from("hopy_future_chain_bridge_events")
    .select(
      [
        "id",
        "source_assistant_message_id",
        "handoff_message_snapshot",
        "transition_kind",
        "transition_meaning",
        "major_category",
        "minor_category",
        "change_trigger_key",
        "support_shape_key",
        "status",
        "deleted_at",
        "created_at",
      ].join(", "),
    )
    .in("source_assistant_message_id", assistantIds)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    logWarn("[threadApi] loadMessages:future chain bridge restore skipped", {
      threadId: params.threadId,
      reason: normMsg(error),
    });

    return out;
  }

  const rows = Array.isArray(data)
    ? (data as unknown as FutureChainBridgeEventRow[])
    : [];

  for (const row of rows) {
    const assistantId = String(row?.source_assistant_message_id ?? "").trim();
    const snapshot = safeTextOrNull(row?.handoff_message_snapshot);

    if (!assistantId || !snapshot) continue;
    if (out.has(assistantId)) continue;

    out.set(assistantId, row);
  }

  return out;
}

async function loadFutureChainDeliveryEventMap(params: {
  supabase: SupabaseClient;
  messages: ChatMsg[];
  threadId: string;
}): Promise<Map<string, FutureChainDeliveryEventRow>> {
  const assistantIds = getAssistantMessageIds(params.messages);
  const out = new Map<string, FutureChainDeliveryEventRow>();

  if (assistantIds.length === 0) {
    return out;
  }

  const { data, error } = await params.supabase
    .from("hopy_future_chain_delivery_events")
    .select(
      [
        "id",
        "recipient_assistant_message_id",
        "bridge_event_id",
        "pattern_id",
        "recipient_plan",
        "display_mode",
        "recipient_state_level",
        "major_category",
        "minor_category",
        "change_trigger_key",
        "display_title",
        "display_hint",
        "display_flow",
        "delivery_reason",
        "status",
        "deleted_at",
        "created_at",
      ].join(", "),
    )
    .in("recipient_assistant_message_id", assistantIds)
    .eq("status", "shown")
    .eq("display_mode", "recipient_support")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    logWarn("[threadApi] loadMessages:future chain delivery restore skipped", {
      threadId: params.threadId,
      reason: normMsg(error),
    });

    return out;
  }

  const rows = Array.isArray(data)
    ? (data as unknown as FutureChainDeliveryEventRow[])
    : [];

  for (const row of rows) {
    const assistantId = String(row?.recipient_assistant_message_id ?? "").trim();
    const snapshot = safeTextOrNull(row?.display_hint);

    if (!assistantId || !snapshot) continue;
    if (out.has(assistantId)) continue;

    out.set(assistantId, row);
  }

  return out;
}

function attachFutureChainBridgeEventsToMessages(params: {
  messages: ChatMsg[];
  bridgeEventsByAssistantId: Map<string, FutureChainBridgeEventRow>;
}): ChatMsg[] {
  if (params.bridgeEventsByAssistantId.size === 0) {
    return params.messages;
  }

  return params.messages.map((msg) => {
    const raw = msg as any;
    if (raw?.role !== "assistant") return msg;

    const assistantId = resolveMessageStableId(msg);
    if (!assistantId) return msg;

    const bridgeEvent = params.bridgeEventsByAssistantId.get(assistantId);
    const handoffMessageSnapshot = safeTextOrNull(
      bridgeEvent?.handoff_message_snapshot,
    );

    if (!bridgeEvent || !handoffMessageSnapshot) {
      return msg;
    }

    const next: any = { ...raw };

    const confirmedPayload: Record<string, any> = isRecord(
      raw?.hopy_confirmed_payload,
    )
      ? { ...raw.hopy_confirmed_payload }
      : {};

    const existingFutureChainContext = isRecord(
      confirmedPayload.future_chain_context,
    )
      ? { ...confirmedPayload.future_chain_context }
      : {};

    confirmedPayload.future_chain_context = {
      ...existingFutureChainContext,
      delivery_mode: "owner_handoff",
      major_category:
        safeTextOrNull(bridgeEvent.major_category) ??
        existingFutureChainContext.major_category ??
        null,
      minor_category:
        safeTextOrNull(bridgeEvent.minor_category) ??
        existingFutureChainContext.minor_category ??
        null,
      change_trigger_key:
        safeTextOrNull(bridgeEvent.change_trigger_key) ??
        existingFutureChainContext.change_trigger_key ??
        null,
      transition_kind:
        safeTextOrNull(bridgeEvent.transition_kind) ??
        existingFutureChainContext.transition_kind ??
        null,
      transition_meaning:
        safeTextOrNull(bridgeEvent.transition_meaning) ??
        existingFutureChainContext.transition_meaning ??
        null,
      support_shape_key:
        safeTextOrNull(bridgeEvent.support_shape_key) ??
        existingFutureChainContext.support_shape_key ??
        "handoff_message_snapshot",
      handoff_message_snapshot: handoffMessageSnapshot,
      source_assistant_message_id: assistantId,
      bridge_event_id: safeTextOrNull(bridgeEvent.id),
    };

    if (!confirmedPayload.assistant_message_id) {
      confirmedPayload.assistant_message_id = assistantId;
    }

    if (!confirmedPayload.reply && typeof raw?.content === "string") {
      confirmedPayload.reply = raw.content;
    }

    next.hopy_confirmed_payload = confirmedPayload;

    return next as ChatMsg;
  });
}

function attachFutureChainDeliveryEventsToMessages(params: {
  messages: ChatMsg[];
  deliveryEventsByAssistantId: Map<string, FutureChainDeliveryEventRow>;
}): ChatMsg[] {
  if (params.deliveryEventsByAssistantId.size === 0) {
    return params.messages;
  }

  return params.messages.map((msg) => {
    const raw = msg as any;
    if (raw?.role !== "assistant") return msg;

    const assistantId = resolveMessageStableId(msg);
    if (!assistantId) return msg;

    const deliveryEvent = params.deliveryEventsByAssistantId.get(assistantId);
    const handoffMessageSnapshot = safeTextOrNull(deliveryEvent?.display_hint);

    if (!deliveryEvent || !handoffMessageSnapshot) {
      return msg;
    }

    const next: any = { ...raw };

    const confirmedPayload: Record<string, any> = isRecord(
      raw?.hopy_confirmed_payload,
    )
      ? { ...raw.hopy_confirmed_payload }
      : {};

    const displayTitle =
      safeTextOrNull(deliveryEvent.display_title) ??
      "過去のユーザーさんから Future Chain が届いています";

    const futureChainDisplay = {
      kind: "recipient_support",
      shouldDisplay: true,
      plan: safeTextOrNull(deliveryEvent.recipient_plan) ?? "pro",
      placement: "below_reply",
      detailLevel: "full",
      title: displayTitle,
      description:
        "過去の本物の会話から生まれたHOPYの言葉が、今のあなたへ届いています。",
      handoffMessageSnapshot,
      bridgeEventId: safeTextOrNull(deliveryEvent.bridge_event_id),
      deliveryEventId: safeTextOrNull(deliveryEvent.id),
      delivery_event_id: safeTextOrNull(deliveryEvent.id),
    };

    next.future_chain_display = futureChainDisplay;
    next.futureChainDisplay = futureChainDisplay;

    confirmedPayload.future_chain_display = futureChainDisplay;

    if (!confirmedPayload.assistant_message_id) {
      confirmedPayload.assistant_message_id = assistantId;
    }

    if (!confirmedPayload.reply && typeof raw?.content === "string") {
      confirmedPayload.reply = raw.content;
    }

    next.hopy_confirmed_payload = confirmedPayload;

    return next as ChatMsg;
  });
}

async function restoreFutureChainBridgeEvents(params: {
  supabase: SupabaseClient;
  messages: ChatMsg[];
  threadId: string;
}): Promise<ChatMsg[]> {
  const bridgeEventsByAssistantId = await loadFutureChainBridgeEventMap({
    supabase: params.supabase,
    messages: params.messages,
    threadId: params.threadId,
  });

  return attachFutureChainBridgeEventsToMessages({
    messages: params.messages,
    bridgeEventsByAssistantId,
  });
}

async function restoreFutureChainDeliveryEvents(params: {
  supabase: SupabaseClient;
  messages: ChatMsg[];
  threadId: string;
}): Promise<ChatMsg[]> {
  const deliveryEventsByAssistantId = await loadFutureChainDeliveryEventMap({
    supabase: params.supabase,
    messages: params.messages,
    threadId: params.threadId,
  });

  return attachFutureChainDeliveryEventsToMessages({
    messages: params.messages,
    deliveryEventsByAssistantId,
  });
}

export async function loadMessages(
  supabase: SupabaseClient,
  threadId: string,
): Promise<ChatMsg[]>;
export async function loadMessages(
  args: LoadMessagesStateArgs,
): Promise<ChatMsg[]>;
export async function loadMessages(a1: any, a2?: any): Promise<ChatMsg[]> {
  const isStateMode =
    typeof a1 === "object" && a1 && "supabase" in a1 && "threadId" in a1;

  const supabase: SupabaseClient = isStateMode
    ? (a1.supabase as SupabaseClient)
    : (a1 as SupabaseClient);
  const threadId: string = isStateMode
    ? String(a1.threadId ?? "")
    : String(a2 ?? "");

  const tid = String(threadId ?? "").trim();

  if (!tid) {
    return [];
  }

  logInfo("[threadApi] loadMessages:start", {
    threadId: tid,
    mode: isStateMode ? "state" : "pure",
  });

  const SELECT_COLUMNS = [
    "id",
    "conversation_id",
    "role",
    "content",
    "lang",
    "created_at",
    "state_level",
    "current_phase",
    "state_changed",
    "prev_phase",
    "prev_state_level",
    "compass_text",
    "compass_prompt",
  ].join(", ");

  const runQuery = async () => {
    return await supabase
      .from("messages")
      .select(SELECT_COLUMNS)
      .eq("conversation_id", tid)
      .order("created_at", { ascending: false })
      .limit(200);
  };

  const runQueryBasic = async () => {
    return await supabase
      .from("messages")
      .select("id, conversation_id, role, content, lang, created_at")
      .eq("conversation_id", tid)
      .order("created_at", { ascending: false })
      .limit(200);
  };

  const queryOnce = async (): Promise<ChatMsg[]> => {
    const auth = await waitForAuthReady(supabase);
    if (!auth.ok) {
      throw new Error("auth_not_ready");
    }

    let rows: any[] | null = null;
    let error: any = null;

    const first = await runQuery();
    rows = first.data as any[] | null;
    error = first.error;

    if (error && isMissingColumnError(error) && !isConversationIdMissingError(error)) {
      logWarn(
        "[threadApi] loadMessages:state/compass columns unavailable on conversation_id query; fallback basic select",
        {
          threadId: tid,
          reason: normMsg(error),
        },
      );

      const basic = await runQueryBasic();
      rows = basic.data as any[] | null;
      error = basic.error;
    }

    if (error && isConversationIdMissingError(error)) {
      const reason = normMsg(error);
      logWarn("[threadApi] loadMessages:conversation_id missing", {
        threadId: tid,
        reason,
      });
      throw new Error(reason || "messages_conversation_id_missing");
    }

    if (error) {
      const reason = normMsg(error);
      logWarn("[threadApi] loadMessages:failed", {
        threadId: tid,
        reason,
        fk: "conversation_id",
      });

      if (isAuthNotReadyError(error)) {
        throw new Error("auth_not_ready");
      }

      throw new Error(reason || "messages_load_failed");
    }

    const orderedRows = Array.isArray(rows) ? rows.slice().reverse() : [];
    const fixed = mapRowsToMessages(orderedRows, tid);
    const withOwnerHandoff = await restoreFutureChainBridgeEvents({
      supabase,
      messages: fixed,
      threadId: tid,
    });
    const restored = await restoreFutureChainDeliveryEvents({
      supabase,
      messages: withOwnerHandoff,
      threadId: tid,
    });

    logInfo("[threadApi] loadMessages:ok", {
      threadId: tid,
      fk: "conversation_id",
      rows: Array.isArray(rows) ? rows.length : 0,
      fixed: restored.length,
    });

    return restored;
  };

  const delays = [0, 250, 800, 1600, 3200];

  let lastErr: any = null;
  for (let i = 0; i < delays.length; i++) {
    try {
      if (delays[i] > 0) await sleep(delays[i]);
      return await queryOnce();
    } catch (e) {
      lastErr = e;
      if (i < delays.length - 1 && shouldRetryLoadMessages(e)) {
        continue;
      }
      break;
    }
  }

  const reason = normMsg(lastErr);
  logWarn("[threadApi] loadMessages:exception", { threadId: tid, reason });

  throw new Error(reason || "messages_load_failed");
}

export default loadMessages;

/*
このファイルの正式役割
スレッド再読込時の messages 復元ファイル。
DB の messages テーブルから必要な列を取り、
クライアント描画用の ChatMsg[] に戻して返す。
このファイルは取得だけを担当し、UI更新は担当しない。

このファイルが受け取るもの
supabase
threadId

このファイルが渡すもの
再読込後の ChatMsg[]
- content
- state 系
- compass
- compass_text
- compass_prompt
- hopy_confirmed_payload
- conversation_id
- thread_id
- hopy_confirmed_payload.future_chain_context
- future_chain_display / futureChainDisplay
- hopy_confirmed_payload.future_chain_display

【今回このファイルで修正したこと】
hopy_future_chain_bridge_events から owner_handoff を復元するときに、
major_category / minor_category / change_trigger_key も取得し、
hopy_confirmed_payload.future_chain_context へ戻す処理を追加した。
hopy_future_chain_delivery_events から recipient_support 表示履歴を復元する処理は維持した。
messages.hopy_confirmed_payload カラムは存在しないため select していない。
Future Chain の保存可否、state_changed、state_level、Compass、HOPY回答○は再判定していない。
既存の state 1..5、Compass復元、本文復元、取得順、dedupe、UI更新しない方針は維持した。

/components/chat/lib/threadApiMessages.ts
*/