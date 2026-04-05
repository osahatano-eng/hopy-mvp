// /app/api/chat/_lib/route/authState.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import { envInt } from "../env";
import { errorText } from "../infra/text";
import type { Lang } from "../router/simpleRouter";
import { stabilizedDelta } from "../state/score";
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

function resolvePhaseByDelta(params: {
  prevPhase: 1 | 2 | 3 | 4 | 5;
  deltaApplied: number;
}): 1 | 2 | 3 | 4 | 5 {
  const prevPhase = normalizePhase(params.prevPhase);

  if (params.deltaApplied > 0) {
    return normalizePhase(prevPhase + 1);
  }

  if (params.deltaApplied < 0) {
    return normalizePhase(prevPhase - 1);
  }

  return prevPhase;
}

function computeConversationStateUpdate(params: {
  prevPhase: 1 | 2 | 3 | 4 | 5;
  prevUpdatedAt: string | null;
  uiLang: Lang;
  userText: string;
}): {
  ok: true;
  skipped: boolean;
  reason: string | null;
  applied: {
    deltaApplied: number;
    nextPhase: 1 | 2 | 3 | 4 | 5;
  };
} {
  const minIntervalSec = envInt("USER_STATE_MIN_INTERVAL_SEC", 12);

  const delta = stabilizedDelta({
    text: String(params.userText ?? "").trim(),
    uiLang: params.uiLang,
    updatedAt: params.prevUpdatedAt,
    minIntervalSec,
    negStreakPrev: 0,
  });

  if (delta.is_cooldown) {
    return {
      ok: true,
      skipped: true,
      reason: "cooldown",
      applied: {
        deltaApplied: 0,
        nextPhase: params.prevPhase,
      },
    };
  }

  const nextPhase = resolvePhaseByDelta({
    prevPhase: params.prevPhase,
    deltaApplied: delta.delta_applied,
  });

  return {
    ok: true,
    skipped: false,
    reason: null,
    applied: {
      deltaApplied: delta.delta_applied,
      nextPhase,
    },
  };
}

export function resolveConversationPhaseFromStateUpdate(params: {
  prevConversationPhase: 1 | 2 | 3 | 4 | 5;
  stateUpdateResult: any;
}): 1 | 2 | 3 | 4 | 5 {
  const prevConversationPhase = normalizePhase(params.prevConversationPhase);
  const st = params.stateUpdateResult;

  if (!st?.ok) {
    return prevConversationPhase;
  }

  if (st.skipped) {
    return prevConversationPhase;
  }

  const appliedNextPhase = st?.applied?.nextPhase;
  if (appliedNextPhase != null) {
    return normalizePhase(appliedNextPhase);
  }

  const appliedCurrentPhase = st?.applied?.currentPhase;
  if (appliedCurrentPhase != null) {
    return normalizePhase(appliedCurrentPhase);
  }

  const afterConversationPhase =
    st?.state?.current_phase ??
    st?.state?.state_level ??
    st?.current_phase ??
    st?.state_level;
  if (afterConversationPhase != null) {
    return normalizePhase(afterConversationPhase);
  }

  return prevConversationPhase;
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

  const fallbackStateUpdate = computeConversationStateUpdate({
    prevPhase,
    prevUpdatedAt: conversationStateBefore?.created_at ?? null,
    uiLang,
    userText,
  });

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

  const st = userStateUpdate?.ok ? userStateUpdate : fallbackStateUpdate;

  const currentPhase = resolveConversationPhaseFromStateUpdate({
    prevConversationPhase: prevPhase,
    stateUpdateResult: st,
  });

  const currentStateLevel = toConversationStateLevel(currentPhase);
  const stateChanged =
    currentPhase !== prevPhase || currentStateLevel !== prevStateLevel;

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
会話ごとの直近 assistant 状態を読み取り、今回の userText に対する会話状態の更新結果を正規化して返す状態決定層。
*/

/*
【今回このファイルで修正したこと】
- normalizeAssistantStateRow(...) で current_phase を優先して current 値を正規化するように修正しました。
- normalizeAssistantStateRow(...) で prev_phase を優先して prev 値を正規化するように修正しました。
- resolveConversationState(...) で prevPhase / prevStateLevel の起点を直近 assistant の current 状態に固定しました。
- resolveConversationState(...) で今回ターンの state update 結果として fallbackStateUpdate 固定ではなく、updateUserStateFromMessage(...) の実更新結果を優先採用するように修正しました。
- これにより、今回ターンの prev/current が fallback 側で潰れて 3→3 になる経路をこのファイル内で止めました。
*/

/* /app/api/chat/_lib/route/authState.ts */