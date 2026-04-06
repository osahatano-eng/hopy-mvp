// /app/api/chat/_lib/route/authState.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import { errorText } from "../infra/text";
import type { Lang } from "../router/simpleRouter";
import { updateUserStateFromMessage } from "../state/update";

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizePhase(v: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return clampInt(Math.round(n), 1, 5) as 1 | 2 | 3 | 4 | 5;
}

export function toConversationStateLevel(
  currentPhase: number | null | undefined,
): 1 | 2 | 3 | 4 | 5 {
  return normalizePhase(currentPhase);
}

export type CanonicalConversationState = {
  current_phase: 1 | 2 | 3 | 4 | 5;
  state_level: 1 | 2 | 3 | 4 | 5;
  prev_phase: 1 | 2 | 3 | 4 | 5;
  prev_state_level: 1 | 2 | 3 | 4 | 5;
  state_changed: boolean;
};

export function buildCanonicalConversationState(params: {
  currentPhase: 1 | 2 | 3 | 4 | 5;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
  prevPhase: 1 | 2 | 3 | 4 | 5;
  prevStateLevel: 1 | 2 | 3 | 4 | 5;
  stateChanged: boolean;
}): CanonicalConversationState {
  const {
    currentPhase,
    currentStateLevel,
    prevPhase,
    prevStateLevel,
    stateChanged,
  } = params;

  return {
    current_phase: currentPhase,
    state_level: currentStateLevel,
    prev_phase: prevPhase,
    prev_state_level: prevStateLevel,
    state_changed: stateChanged,
  };
}

export function normalizeStateForPayload(
  state: any,
  currentPhase: 1 | 2 | 3 | 4 | 5,
  currentStateLevel: 1 | 2 | 3 | 4 | 5,
  prevPhase: 1 | 2 | 3 | 4 | 5,
  prevStateLevel: 1 | 2 | 3 | 4 | 5,
  stateChanged: boolean,
): CanonicalConversationState {
  const canonical = buildCanonicalConversationState({
    currentPhase,
    currentStateLevel,
    prevPhase,
    prevStateLevel,
    stateChanged,
  });

  if (!state || typeof state !== "object") {
    return canonical;
  }

  return {
    ...canonical,
  };
}

function normalizeIsoString(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export type ConversationAssistantState = {
  current_phase: 1 | 2 | 3 | 4 | 5;
  state_level: 1 | 2 | 3 | 4 | 5;
  prev_phase: 1 | 2 | 3 | 4 | 5;
  prev_state_level: 1 | 2 | 3 | 4 | 5;
  state_changed: boolean;
  created_at?: string;
} | null;

export type ConversationStateOutcome = {
  stateBefore: any;
  st: any;
  stateUpdateOk: boolean;
  stateUpdateError: string | null;
  prevPhase: 1 | 2 | 3 | 4 | 5;
  prevStateLevel: 1 | 2 | 3 | 4 | 5;
  currentPhase: 1 | 2 | 3 | 4 | 5;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
  stateChanged: boolean;
  normalizedStateForPayload: CanonicalConversationState;
};

function normalizeAssistantStateRow(data: any): ConversationAssistantState {
  if (!data) return null;

  const normalizedCurrent = normalizePhase(
    data.current_phase ?? data.state_level ?? 1,
  );

  const normalizedPrev = normalizePhase(
    data.prev_phase ?? data.prev_state_level ?? normalizedCurrent,
  );

  const state_changed = !!data.state_changed;
  const created_at = normalizeIsoString(data.created_at) ?? undefined;

  return {
    current_phase: normalizedCurrent,
    state_level: normalizedCurrent,
    prev_phase: normalizedPrev,
    prev_state_level: normalizedPrev,
    state_changed,
    created_at,
  };
}

export async function loadLatestAssistantStateForConversation({
  supabase,
  conversationId,
}: {
  supabase: SupabaseClient;
  conversationId: string;
}): Promise<ConversationAssistantState> {
  const cid = String(conversationId ?? "").trim();
  if (!cid) return null;

  const { data, error } = await supabase
    .from("messages")
    .select(
      "current_phase, state_level, prev_phase, prev_state_level, state_changed, created_at",
    )
    .eq("conversation_id", cid)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return normalizeAssistantStateRow(data);
}

async function updateConversationStateLevel(params: {
  supabase: SupabaseClient;
  authedUserId: string;
  resolvedConversationId: string;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
}): Promise<{ ok: true } | { ok: false; error: any }> {
  const { supabase, authedUserId, resolvedConversationId, currentStateLevel } =
    params;

  const cid = String(resolvedConversationId ?? "").trim();
  if (!cid) {
    return { ok: false, error: "conversation_id_missing" };
  }

  const { error } = await supabase
    .from("conversations")
    .update({
      state_level: currentStateLevel,
    })
    .eq("id", cid)
    .eq("user_id", authedUserId);

  if (error) {
    return { ok: false, error };
  }

  return { ok: true };
}

export async function resolveConversationState(params: {
  supabase: SupabaseClient;
  authedUserId: string;
  resolvedConversationId: string;
  uiLang: Lang;
  userText: string;
}): Promise<ConversationStateOutcome> {
  const { supabase, authedUserId, resolvedConversationId, uiLang, userText } =
    params;

  const conversationStateBefore = await loadLatestAssistantStateForConversation({
    supabase,
    conversationId: resolvedConversationId,
  });

  const stateBefore = conversationStateBefore;
  let stateUpdateOk = true;
  let stateUpdateError: string | null = null;

  const prevPhase = normalizePhase(
    conversationStateBefore?.current_phase ??
      conversationStateBefore?.state_level ??
      1,
  );
  const prevStateLevel = prevPhase;

  const userStateUpdate = await updateUserStateFromMessage({
    supabase,
    userId: authedUserId,
    uiLang,
    text: userText,
  });

  if (!userStateUpdate?.ok) {
    stateUpdateOk = false;
    stateUpdateError = errorText(userStateUpdate?.error);
  }

  const st = userStateUpdate;

  const rawCurrentPhase =
    userStateUpdate?.state?.current_phase ??
    userStateUpdate?.applied?.nextPhase ??
    prevPhase;

  const currentPhase = normalizePhase(rawCurrentPhase);
  const currentStateLevel = currentPhase;
  const stateChanged = currentPhase !== prevPhase;

  const conversationUpdateRes = await updateConversationStateLevel({
    supabase,
    authedUserId,
    resolvedConversationId,
    currentStateLevel,
  });

  if (!conversationUpdateRes.ok) {
    stateUpdateOk = false;
    stateUpdateError = errorText(conversationUpdateRes.error);
  }

  const normalizedStateForPayload = normalizeStateForPayload(
    null,
    currentPhase,
    currentStateLevel,
    prevPhase,
    prevStateLevel,
    stateChanged,
  );

  return {
    stateBefore,
    st,
    stateUpdateOk,
    stateUpdateError,
    prevPhase,
    prevStateLevel,
    currentPhase,
    currentStateLevel,
    stateChanged,
    normalizedStateForPayload,
  };
}

/*
このファイルの正式役割：
会話ごとの直近 assistant 状態を読み取り、
今回ターンで使う会話状態の前後差分を正規化して返す前段層。
この層は DB保存済みの直近 assistant 状態と
updateUserStateFromMessage(...) の結果を受け取り、
確定意味ペイロードへ渡す state の土台を整える。
*/

/*
【今回このファイルで修正したこと】
- resolveConversationState(...) で UserState 型に存在しない state_level 参照を削除しました。
- updateUserStateFromMessage(...) の返却値は current_phase を優先し、なければ applied.nextPhase を使う形にそろえました。
- state値は 1..5 / 5段階 のまま normalizePhase(...) で統一しています。
- HOPY回答○ の唯一の正そのものはこのファイルで再定義せず、前段の型エラーだけを止めました。
*/

/*
/app/api/chat/_lib/route/authState.ts
*/