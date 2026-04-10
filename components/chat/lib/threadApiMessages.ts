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

/**
 * ✅ loadMessages:
 * 1) loadMessages(supabase, threadId) -> Promise<ChatMsg[]>
 * 2) loadMessages({ supabase, threadId, ... }) -> Promise<ChatMsg[]>
 *
 * このファイルは messages を取得して返すだけに固定する。
 * UI更新(setMessages / setVisibleCount / scrollToBottom)はここで行わない。
 */
export async function loadMessages(supabase: SupabaseClient, threadId: string): Promise<ChatMsg[]>;
export async function loadMessages(args: LoadMessagesStateArgs): Promise<ChatMsg[]>;
export async function loadMessages(a1: any, a2?: any): Promise<ChatMsg[]> {
  const isStateMode = typeof a1 === "object" && a1 && "supabase" in a1 && "threadId" in a1;

  const supabase: SupabaseClient = isStateMode ? (a1.supabase as SupabaseClient) : (a1 as SupabaseClient);
  const threadId: string = isStateMode ? String(a1.threadId ?? "") : String(a2 ?? "");

  const tid = String(threadId ?? "").trim();

  if (!tid) {
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

Compass 観点でこのファイルの意味
このファイルは、送信直後に client message へ積まれた Compass 情報を、
スレッド再読込時にも DB から復元して assistant message へ戻す場所である。
*/

/*
【今回このファイルで修正したこと】
1. loadMessages() の state mode に残っていた setMessages / setVisibleCount / scrollToBottom の実行責務を削除しました。
2. tid 空時の setMessages([]) / setVisibleCount(200) / scrollToBottom("auto") も削除し、このファイルを取得専用に戻しました。
3. current_phase / state_level / prev_phase / prev_state_level / state_changed / compass / hopy_confirmed_payload の復元ロジックには触っていません。
*/

/* /components/chat/lib/threadApiMessages.ts */