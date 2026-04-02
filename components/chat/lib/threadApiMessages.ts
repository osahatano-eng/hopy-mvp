// /components/chat/lib/threadApiMessages.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dispatch, SetStateAction } from "react";

import type { ChatMsg } from "./chatTypes";

import { logInfo, logWarn, microtask, normMsg, sleep } from "./threadApiSupport";
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

// ✅ 一時的な揺れだけ拾う（過剰リトライで固まらないよう最小限）
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

function normalizeMergeText(v: any): string {
  return String(v ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
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

function buildAssistantMergeSignature(msg: ChatMsg): string {
  const raw = msg as any;

  const role = String(raw?.role ?? "").trim();
  const content = normalizeMergeText(
    raw?.content ??
      raw?.reply ??
      raw?.hopy_confirmed_payload?.reply ??
      "",
  );

  return JSON.stringify({
    role,
    content,
  });
}

function buildAssistantSignatureKey(msg: ChatMsg): string | null {
  const raw = msg as any;
  if (String(raw?.role ?? "").trim() !== "assistant") return null;

  const stableId = resolveMessageStableId(msg);
  if (stableId) {
    return `assistant-id:${stableId}`;
  }

  return `assistant:${buildAssistantMergeSignature(msg)}`;
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

function mapRowsToMessages(rows: any[]): ChatMsg[] {
  const raw = Array.isArray(rows) ? rows : [];

  const mapped = raw.map((r: any) => {
    const id = String(r?.id ?? "").trim();
    const roleRaw = String(r?.role ?? "").trim();
    const role = roleRaw === "assistant" ? "assistant" : "user";
    const content = String(r?.content ?? "");
    const lang = r?.lang === "en" ? "en" : "ja";
    const created_at = String(r?.created_at ?? "").trim() || undefined;

    const out: any = { role, content, lang };
    if (id) out.id = id;
    if (created_at) out.created_at = created_at;

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

function buildMessageIdentityKey(msg: ChatMsg, index: number): string {
  const stableId = resolveMessageStableId(msg);
  if (stableId) return `id:${stableId}`;

  const raw = msg as any;
  const role = String(raw?.role ?? "").trim();
  const content = String(raw?.content ?? "");
  const createdAt = String(raw?.created_at ?? "").trim();
  return `fallback:${index}:${role}:${createdAt}:${content}`;
}

function buildMessageMergeKey(msg: ChatMsg, index: number): string {
  const stableId = resolveMessageStableId(msg);
  if (stableId) return `id:${stableId}`;

  const raw = msg as any;

  if (String(raw?.role ?? "").trim() === "assistant") {
    return `assistant:${buildAssistantMergeSignature(msg)}`;
  }

  return `fallback:${index}:${buildMessageIdentityKey(msg, index)}`;
}

function mergePreferRicherMessage(prevMsg: ChatMsg, nextMsg: ChatMsg): ChatMsg {
  const prevRaw = prevMsg as any;
  const nextRaw = nextMsg as any;

  const merged: any = {
    ...prevRaw,
    ...nextRaw,
  };

  const nextCompassText = resolveCompassText(nextRaw);
  const nextCompassPrompt = resolveCompassPrompt(nextRaw);
  const prevCompassText = resolveCompassText(prevRaw);
  const prevCompassPrompt = resolveCompassPrompt(prevRaw);

  const resolvedCompassText = nextCompassText ?? prevCompassText;
  const resolvedCompassPrompt = nextCompassPrompt ?? prevCompassPrompt;

  if (resolvedCompassText || resolvedCompassPrompt) {
    merged.compass = {
      ...(resolvedCompassText ? { text: resolvedCompassText } : {}),
      ...(resolvedCompassPrompt ? { prompt: resolvedCompassPrompt } : {}),
    };

    if (resolvedCompassText) {
      merged.compass_text = resolvedCompassText;
    } else {
      delete merged.compass_text;
    }

    if (resolvedCompassPrompt) {
      merged.compass_prompt = resolvedCompassPrompt;
    } else {
      delete merged.compass_prompt;
    }
  } else {
    delete merged.compass;
    delete merged.compass_text;
    delete merged.compass_prompt;
  }

  const nextConfirmed = nextRaw?.hopy_confirmed_payload;
  const prevConfirmed = prevRaw?.hopy_confirmed_payload;

  if (!nextConfirmed && prevConfirmed) {
    merged.hopy_confirmed_payload = prevConfirmed;
  } else if (nextConfirmed || prevConfirmed) {
    merged.hopy_confirmed_payload = {
      ...(prevConfirmed ?? {}),
      ...(nextConfirmed ?? {}),
    };

    if (resolvedCompassText || resolvedCompassPrompt) {
      merged.hopy_confirmed_payload.compass = {
        ...(resolvedCompassText ? { text: resolvedCompassText } : {}),
        ...(resolvedCompassPrompt ? { prompt: resolvedCompassPrompt } : {}),
      };
    }

    const resolvedState =
      nextRaw?.state ??
      nextRaw?.assistant_state ??
      nextRaw?.hopy_state ??
      nextConfirmed?.state ??
      prevRaw?.state ??
      prevRaw?.assistant_state ??
      prevRaw?.hopy_state ??
      prevConfirmed?.state;

    if (resolvedState) {
      merged.hopy_confirmed_payload.state = resolvedState;
    }

    const resolvedReply =
      safeTextOrNull(nextRaw?.content) ??
      safeTextOrNull(nextRaw?.reply) ??
      safeTextOrNull(nextConfirmed?.reply) ??
      safeTextOrNull(prevRaw?.content) ??
      safeTextOrNull(prevRaw?.reply) ??
      safeTextOrNull(prevConfirmed?.reply);

    if (resolvedReply) {
      merged.hopy_confirmed_payload.reply = resolvedReply;
    }

    const resolvedAssistantMessageId =
      safeTextOrNull(nextConfirmed?.assistant_message_id) ??
      safeTextOrNull(nextRaw?.assistant_message_id) ??
      safeTextOrNull(nextRaw?.id) ??
      safeTextOrNull(prevConfirmed?.assistant_message_id) ??
      safeTextOrNull(prevRaw?.assistant_message_id) ??
      safeTextOrNull(prevRaw?.id);

    if (resolvedAssistantMessageId) {
      merged.hopy_confirmed_payload.assistant_message_id = resolvedAssistantMessageId;
      merged.hopy_confirmed_payload.thread_summary = {
        ...(prevConfirmed?.thread_summary ?? {}),
        ...(nextConfirmed?.thread_summary ?? {}),
        latest_reply_id: resolvedAssistantMessageId,
      };
    }
  }

  if (!nextRaw?.state && prevRaw?.state) {
    merged.state = prevRaw.state;
  }
  if (!nextRaw?.assistant_state && prevRaw?.assistant_state) {
    merged.assistant_state = prevRaw.assistant_state;
  }
  if (!nextRaw?.hopy_state && prevRaw?.hopy_state) {
    merged.hopy_state = prevRaw.hopy_state;
  }

  if (!resolveMessageStableId(nextMsg)) {
    const prevStableId = resolveMessageStableId(prevMsg);
    if (prevStableId && !merged.id) {
      merged.id = prevStableId;
    }
  }

  if (!nextRaw?.created_at && prevRaw?.created_at) {
    merged.created_at = prevRaw.created_at;
  }

  return merged as ChatMsg;
}

function reconcileLoadedMessages(prev: ChatMsg[], next: ChatMsg[]): ChatMsg[] {
  const prevList = dedupeLoadedMessages(Array.isArray(prev) ? prev : []);
  const nextList = dedupeLoadedMessages(Array.isArray(next) ? next : []);

  if (prevList.length <= 0) return nextList;
  if (nextList.length <= 0) return prevList;

  const prevMap = new Map<string, ChatMsg>();
  const prevAssistantSigMap = new Map<string, ChatMsg>();
  const matchedPrevKeys = new Set<string>();

  prevList.forEach((msg, index) => {
    const primaryKey = buildMessageMergeKey(msg, index);
    prevMap.set(primaryKey, msg);

    const assistantSigKey = buildAssistantSignatureKey(msg);
    if (assistantSigKey) {
      prevAssistantSigMap.set(assistantSigKey, msg);
    }
  });

  const mergedNext = nextList.map((msg, index) => {
    const primaryKey = buildMessageMergeKey(msg, index);
    const assistantSigKey = buildAssistantSignatureKey(msg);

    const matchedPrev =
      prevMap.get(primaryKey) ??
      (assistantSigKey ? prevAssistantSigMap.get(assistantSigKey) : undefined);

    if (!matchedPrev) return msg;

    matchedPrevKeys.add(buildRenderedMessageSignature(matchedPrev));
    return mergePreferRicherMessage(matchedPrev, msg);
  });

  const remainingPrev = prevList.filter((msg) => {
    const sig = buildRenderedMessageSignature(msg);
    return !matchedPrevKeys.has(sig);
  });

  const reconciled = dedupeLoadedMessages([...remainingPrev, ...mergedNext]);

  reconciled.sort((a, b) => {
    const aRaw = a as any;
    const bRaw = b as any;

    const aCreated = String(aRaw?.created_at ?? "").trim();
    const bCreated = String(bRaw?.created_at ?? "").trim();

    if (aCreated && bCreated && aCreated !== bCreated) {
      return aCreated.localeCompare(bCreated);
    }

    const aId = String(resolveMessageStableId(a) ?? "").trim();
    const bId = String(resolveMessageStableId(b) ?? "").trim();

    if (aId && bId && aId !== bId) {
      return aId.localeCompare(bId);
    }

    return 0;
  });

  return reconciled;
}

/**
 * ✅ loadMessages: 2つの呼び出し形を正式サポート
 * 1) loadMessages(supabase, threadId) -> Promise<ChatMsg[]>
 * 2) loadMessages({supabase, threadId, setMessages, setVisibleCount, scrollToBottom}) -> Promise<ChatMsg[]>
 */
export async function loadMessages(supabase: SupabaseClient, threadId: string): Promise<ChatMsg[]>;
export async function loadMessages(args: LoadMessagesStateArgs): Promise<ChatMsg[]>;
export async function loadMessages(a1: any, a2?: any): Promise<ChatMsg[]> {
  const isStateMode = typeof a1 === "object" && a1 && "supabase" in a1 && "threadId" in a1;

  const supabase: SupabaseClient = isStateMode ? (a1.supabase as SupabaseClient) : (a1 as SupabaseClient);
  const threadId: string = isStateMode ? String(a1.threadId ?? "") : String(a2 ?? "");

  const setMessages: Dispatch<SetStateAction<ChatMsg[]>> | null = isStateMode ? (a1.setMessages as any) : null;
  const setVisibleCountSafe: Dispatch<SetStateAction<number>> | null = isStateMode ? (a1.setVisibleCount as any) : null;
  const scrollToBottom: ((b?: ScrollBehavior | "auto" | "smooth") => void) | null = isStateMode ? a1.scrollToBottom : null;

  const tid = String(threadId ?? "").trim();

  if (!tid) {
    if (isStateMode) {
      try {
        setMessages?.([]);
      } catch {}
      try {
        setVisibleCountSafe?.(200);
      } catch {}
      try {
        microtask(() => scrollToBottom?.("auto"));
      } catch {}
      return [];
    }
    return [];
  }

  logInfo("[threadApi] loadMessages:start", { threadId: tid, mode: isStateMode ? "state" : "pure" });

  const SELECT_COLUMNS = [
    "id",
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
      .order("created_at", { ascending: true })
      .limit(200);
  };

  const runQueryBasic = async () => {
    return await supabase
      .from("messages")
      .select("id, role, content, lang, created_at")
      .eq("conversation_id", tid)
      .order("created_at", { ascending: true })
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
      logWarn("[threadApi] loadMessages:conversation_id missing", { threadId: tid, reason });
      throw new Error(reason || "messages_conversation_id_missing");
    }

    if (error) {
      const reason = normMsg(error);
      logWarn("[threadApi] loadMessages:failed", { threadId: tid, reason, fk: "conversation_id" });
      if (isAuthNotReadyError(error)) {
        throw new Error("auth_not_ready");
      }
      throw new Error(reason || "messages_load_failed");
    }

    const fixed = mapRowsToMessages(Array.isArray(rows) ? rows : []);

    logInfo("[threadApi] loadMessages:ok", {
      threadId: tid,
      fk: "conversation_id",
      rows: Array.isArray(rows) ? rows.length : 0,
      fixed: fixed.length,
    });

    if (isStateMode) {
      try {
        setMessages?.((prev) =>
          reconcileLoadedMessages(Array.isArray(prev) ? prev : [], fixed),
        );
      } catch {}
      try {
        setVisibleCountSafe?.(Math.max(200, fixed.length));
      } catch {}
      try {
        microtask(() => scrollToBottom?.("auto"));
      } catch {}
    }

    return fixed;
  };

  const delays = [0, 200, 600];

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
クライアント描画用の ChatMsg[] に戻す。

このファイルが受け取るもの
supabase
threadId
setMessages
setVisibleCount
scrollToBottom

このファイルが渡すもの
再読込後の ChatMsg[]
- content
- state 系
- compass
- compass_text
- compass_prompt
- hopy_confirmed_payload

Compass 観点でこのファイルの意味
このファイルは、送信直後に client message へ積まれた Compass 情報を、
スレッド再読込時にも DB から復元して assistant message へ戻す場所である。
*/

/*
【今回このファイルで修正したこと】
- DB 復元時に current_phase と state_level、prev_phase と prev_state_level を
  同じ値へ潰さず、それぞれ別キーのまま復元するように修正した。
- これにより、hopy_confirmed_payload.state の唯一の正を、
  再読込後も current_phase / state_level / prev_phase / prev_state_level の
  4項目としてそのまま保持できるようにした。
- 既存の assistant 同一判定や Compass 復元ロジックには触れていない。
*/
// このファイルの正式役割: スレッド再読込時の messages 復元ファイル

/* このファイルの正式役割 */