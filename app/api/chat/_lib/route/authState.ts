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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readDeltaAppliedCandidateFromRecord(
  value: Record<string, unknown>,
): number | null {
  const candidates: unknown[] = [
    value.deltaApplied,
    value.delta_applied,
    value.deltaAppliedFinal,
    value.delta_applied_final,
  ];

  for (const candidate of candidates) {
    const n = Number(candidate);
    if (Number.isFinite(n)) {
      return Math.trunc(n);
    }
  }

  return null;
}

function resolveDeltaAppliedFromStateUpdate(value: unknown): number {
  if (!isRecord(value)) return 0;

  const queue: Array<Record<string, unknown>> = [value];
  const seen = new Set<Record<string, unknown>>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    const directDelta = readDeltaAppliedCandidateFromRecord(current);
    if (directDelta !== null) {
      return directDelta;
    }

    const nestedCandidates: unknown[] = [
      current.applied,
      current.data,
      current.result,
      current.payload,
      current.update,
    ];

    for (const nested of nestedCandidates) {
      if (isRecord(nested)) {
        queue.push(nested);
      }
    }
  }

  return 0;
}

function resolveConversationPhaseFromStateUpdate(params: {
  stateUpdate: unknown;
  previousConfirmedPhase: 1 | 2 | 3 | 4 | 5;
}): 1 | 2 | 3 | 4 | 5 {
  const deltaApplied = resolveDeltaAppliedFromStateUpdate(params.stateUpdate);

  if (deltaApplied > 0) {
    return normalizePhase(params.previousConfirmedPhase + 1);
  }

  if (deltaApplied < 0) {
    return normalizePhase(params.previousConfirmedPhase - 1);
  }

  return params.previousConfirmedPhase;
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
  const hasPreviousAssistantState = !!conversationStateBefore;

  let stateUpdateOk = true;
  let stateUpdateError: string | null = null;

  const previousConfirmedPhase = normalizePhase(
    conversationStateBefore?.current_phase ??
      conversationStateBefore?.state_level ??
      1,
  );

  const previousConfirmedStateLevel =
    toConversationStateLevel(previousConfirmedPhase);

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

  /**
   * HOPY回答○ の唯一の正は回答確定後の hopy_confirmed_payload.state.state_changed。
   * ここは回答確定前の暫定文脈だけを整える層。
   *
   * user_state はユーザー全体の長期状態であり、
   * 会話スレッド固有の current_phase / state_level そのものではない。
   *
   * そのため updateUserStateFromMessage(...) の戻り値から
   * state.current_phase / applied.nextPhase のような全体状態を採用しない。
   * 会話ごとの状態は、直前 assistant 状態を基準に、
   * 今回ターンの deltaApplied の符号だけで最大1段動かす。
   *
   * 新規チャット1発話目では前回 assistant 状態が存在しないため、
   * スレッド固有の状態として prev=current=1 に揃え、
   * stateChanged=false で固定する。
   */
  const resolvedCurrentPhase = hasPreviousAssistantState
    ? resolveConversationPhaseFromStateUpdate({
        stateUpdate: st,
        previousConfirmedPhase,
      })
    : previousConfirmedPhase;

  const resolvedCurrentStateLevel = hasPreviousAssistantState
    ? toConversationStateLevel(resolvedCurrentPhase)
    : previousConfirmedStateLevel;

  const prevPhase = previousConfirmedPhase;
  const prevStateLevel = previousConfirmedStateLevel;

  const currentPhase = resolvedCurrentPhase;
  const currentStateLevel = resolvedCurrentStateLevel;

  const stateChanged = hasPreviousAssistantState
    ? currentPhase !== prevPhase || currentStateLevel !== prevStateLevel
    : false;

  /**
   * 回答確定前に conversations.state_level を先回り更新しない。
   * 正式な会話状態の保存は、確定後の assistant 結果に委ねる。
   */
  void updateConversationStateLevel;

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
【このファイルの正式役割】
会話ごとの直近 assistant 状態を読み取り、
今回ターンで使う会話状態の前後差分を正規化して返す前段層。
この層は DB保存済みの直近 assistant 状態と
updateUserStateFromMessage(...) の結果を受け取り、
確定意味ペイロードへ渡す state の土台を整える。
ただし HOPY回答○ の唯一の正そのものは作らない。

【今回このファイルで修正したこと】
- updateUserStateFromMessage(...) の戻り値から state.current_phase / applied.nextPhase / user_state.current_phase を会話状態として採用しないようにした。
- 会話ごとの currentPhase / currentStateLevel は、直前 assistant 状態を基準に applied.deltaApplied の符号だけで最大1段動かすようにした。
- 新規チャット1発話目では、引き続き currentPhase / currentStateLevel / prevPhase / prevStateLevel を 1 に揃え、stateChanged=false に固定した。
- これにより、ユーザー全体状態が5の場合でも、2会話目以降の軽い入力でスレッド状態が 1 から 5 へ飛ばないようにした。
- state_changed・Compass・○表示・DB保存復元・回答保存処理には触れていない。

/app/api/chat/_lib/route/authState.ts
*/