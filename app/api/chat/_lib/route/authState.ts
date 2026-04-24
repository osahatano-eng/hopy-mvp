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

function readPhaseCandidateFromRecord(
  value: Record<string, unknown>,
): 1 | 2 | 3 | 4 | 5 | null {
  const candidates: unknown[] = [
    value.current_phase,
    value.currentPhase,
    value.state_level,
    value.stateLevel,
    value.phase_after,
    value.phaseAfter,
    value.after_state_level,
    value.afterStateLevel,
    value.next_phase,
    value.nextPhase,
    value.next_state_level,
    value.nextStateLevel,
  ];

  for (const candidate of candidates) {
    const n = Number(candidate);
    if (Number.isFinite(n)) {
      return normalizePhase(n);
    }
  }

  return null;
}

function resolvePhaseFromStateUpdate(
  value: unknown,
  fallback: 1 | 2 | 3 | 4 | 5,
): 1 | 2 | 3 | 4 | 5 {
  if (!isRecord(value)) return fallback;

  const queue: Array<Record<string, unknown>> = [value];
  const seen = new Set<Record<string, unknown>>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    const directPhase = readPhaseCandidateFromRecord(current);
    if (directPhase !== null) {
      return directPhase;
    }

    const nestedCandidates: unknown[] = [
      current.data,
      current.state,
      current.result,
      current.payload,
      current.update,
      current.user_state,
      current.userState,
    ];

    for (const nested of nestedCandidates) {
      if (isRecord(nested)) {
        queue.push(nested);
      }
    }
  }

  return fallback;
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
   * 新規チャット1発話目では前回 assistant 状態が存在しないため、
   * 仮置きの 1 と今回推定 current を比較して擬似差分を作ってはいけない。
   * そのため初回は prev=current に揃え、stateChanged=false で固定する。
   */
  const resolvedCurrentPhase = resolvePhaseFromStateUpdate(
    st,
    previousConfirmedPhase,
  );
  const resolvedCurrentStateLevel =
    toConversationStateLevel(resolvedCurrentPhase);

  const prevPhase = hasPreviousAssistantState
    ? previousConfirmedPhase
    : resolvedCurrentPhase;

  const prevStateLevel = hasPreviousAssistantState
    ? previousConfirmedPhase
    : resolvedCurrentStateLevel;

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
- updateUserStateFromMessage(...) の返り値から phase を読む処理を、トップレベルだけでなくネストした object まで辿れる形へ修正した。
- current_phase / state_level / phase_after / after_state_level / next_phase / next_state_level を、wrapper配下でも拾えるようにした。
- 新規チャット1発話目では、前回 assistant 状態が存在しないため、prev=current に揃えて stateChanged=false に固定するよう修正した。
- これにより、初回発話で仮置き prev=1 と current の比較から擬似的な状態変化が立つのを防ぐ。
- resolveConversationState(...) の役割、DB更新停止方針、HOPY回答○ の唯一の正そのものには触れていない。

/app/api/chat/_lib/route/authState.ts
*/