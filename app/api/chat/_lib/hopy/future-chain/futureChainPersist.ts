// /app/api/chat/_lib/hopy/future-chain/futureChainPersist.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  HopyFutureChainCandidate,
  HopyFutureChainSaveCheckResult,
} from "./futureChainTypes";

type FutureChainPersistStage =
  | "input"
  | "pattern_lookup"
  | "pattern_insert"
  | "bridge_event_insert";

type FutureChainBridgeEventCandidate = {
  language: string;

  from_state_level: number;
  to_state_level: number;

  transition_kind: string;
  transition_meaning: string;

  major_category: string;
  minor_category: string;
  change_trigger_key: string;
  support_shape_key: string;

  user_signal_summary: string;
  hopy_support_summary: string;
  transition_reason: string;
  future_support_hint: string;

  bridge_insight: string;
  bridge_hint: string;
  bridge_flow: string;
  bridge_reason: string;

  owner_visible_summary: string;
  future_visible_summary: string;

  handoff_message_snapshot: string;

  compass_basis: string | null;
  safety_notes: string | null;
  avoidance_notes: string | null;

  source_transition_signal_id: string | null;
  source_assistant_message_id: string;
  source_trigger_message_id: string | null;

  confidence_score: number;
  reuse_scope: string;
  status: string;

  metadata: Record<string, unknown>;
};

type FutureChainCandidateWithBridge = HopyFutureChainCandidate & {
  transition_meaning: string;
  support_shape_key: string;
  major_category: string;
  minor_category: string;
  change_trigger_key: string;
  bridge_event?: FutureChainBridgeEventCandidate | null;
};

export type PersistFutureChainCandidateResult =
  | {
      ok: true;
      skipped: true;
      reason: string;
      patternId: string | null;
      bridgeEventId: null;
    }
  | {
      ok: true;
      skipped: false;
      reason: string;
      patternId: string;
      bridgeEventId: string;
    }
  | {
      ok: false;
      skipped: false;
      reason: string;
      stage: FutureChainPersistStage;
      error: string;
      patternId: string | null;
      bridgeEventId: null;
    };

export type PersistFutureChainCandidateParams = {
  supabase: SupabaseClient;
  saveCheck: HopyFutureChainSaveCheckResult;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readErrorMessage(error: unknown): string {
  const record = asRecord(error);
  const message = normalizeText(record?.message);
  if (message) return message;

  const details = normalizeText(record?.details);
  if (details) return details;

  return "unknown_error";
}

function isDuplicateError(error: unknown): boolean {
  const record = asRecord(error);
  return normalizeText(record?.code) === "23505";
}

function readInsertedId(data: unknown): string | null {
  const record = asRecord(data);
  const id = normalizeText(record?.id);
  return id || null;
}

function getSaveCandidate(
  saveCheck: HopyFutureChainSaveCheckResult,
): FutureChainCandidateWithBridge | null {
  if (saveCheck.decision !== "save") return null;

  const record = asRecord(saveCheck);
  if (!record) return null;

  const candidate = record.candidate as FutureChainCandidateWithBridge | null;
  if (!candidate) return null;

  return candidate;
}

function safeMetadata(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) return {};
  return record;
}

async function findExistingPatternId(params: {
  supabase: SupabaseClient;
  patternKey: string;
  language: string;
}): Promise<{
  ok: boolean;
  id: string | null;
  error: string | null;
}> {
  const { data, error } = await params.supabase
    .from("hopy_future_chain_patterns")
    .select("id")
    .eq("pattern_key", params.patternKey)
    .eq("language", params.language)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      id: null,
      error: readErrorMessage(error),
    };
  }

  return {
    ok: true,
    id: readInsertedId(data),
    error: null,
  };
}

async function insertPattern(params: {
  supabase: SupabaseClient;
  candidate: FutureChainCandidateWithBridge;
}): Promise<{
  ok: boolean;
  id: string | null;
  error: string | null;
}> {
  const candidate = params.candidate;

  const row = {
    pattern_key: candidate.pattern_key,
    language: candidate.language,

    from_state_level: candidate.from_state_level,
    to_state_level: candidate.to_state_level,

    transition_kind: candidate.transition_kind,
    transition_meaning: candidate.transition_meaning,
    support_shape_key: candidate.support_shape_key,

    major_category: candidate.major_category,
    minor_category: candidate.minor_category,
    change_trigger_key: candidate.change_trigger_key,

    delivery_target_state_level: candidate.delivery_target_state_level ?? null,
    delivery_usage: candidate.delivery_usage ?? "owner_handoff",

    evidence_count: candidate.evidence_count ?? 1,
    weight: candidate.weight ?? 1,
    confidence_score: candidate.confidence_score ?? 0.5,

    reuse_scope: candidate.reuse_scope ?? "experimental",
    status: candidate.status ?? "active",

    metadata: safeMetadata(candidate.metadata),
  };

  const { data, error } = await params.supabase
    .from("hopy_future_chain_patterns")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      id: null,
      error: readErrorMessage(error),
    };
  }

  const id = readInsertedId(data);

  if (!id) {
    return {
      ok: false,
      id: null,
      error: "pattern_id_not_returned",
    };
  }

  return {
    ok: true,
    id,
    error: null,
  };
}

async function resolvePatternId(params: {
  supabase: SupabaseClient;
  candidate: FutureChainCandidateWithBridge;
}): Promise<{
  ok: boolean;
  id: string | null;
  stage: FutureChainPersistStage;
  error: string | null;
}> {
  const existing = await findExistingPatternId({
    supabase: params.supabase,
    patternKey: params.candidate.pattern_key,
    language: params.candidate.language,
  });

  if (!existing.ok) {
    return {
      ok: false,
      id: null,
      stage: "pattern_lookup",
      error: existing.error,
    };
  }

  if (existing.id) {
    return {
      ok: true,
      id: existing.id,
      stage: "pattern_lookup",
      error: null,
    };
  }

  const inserted = await insertPattern({
    supabase: params.supabase,
    candidate: params.candidate,
  });

  if (!inserted.ok) {
    return {
      ok: false,
      id: null,
      stage: "pattern_insert",
      error: inserted.error,
    };
  }

  return {
    ok: true,
    id: inserted.id,
    stage: "pattern_insert",
    error: null,
  };
}

async function insertBridgeEvent(params: {
  supabase: SupabaseClient;
  patternId: string;
  bridgeEvent: FutureChainBridgeEventCandidate;
}): Promise<{
  ok: boolean;
  skipped: boolean;
  id: string | null;
  error: string | null;
}> {
  const bridgeEvent = params.bridgeEvent;

  const row = {
    pattern_id: params.patternId,

    language: bridgeEvent.language,

    from_state_level: bridgeEvent.from_state_level,
    to_state_level: bridgeEvent.to_state_level,

    transition_kind: bridgeEvent.transition_kind,
    transition_meaning: bridgeEvent.transition_meaning,

    major_category: bridgeEvent.major_category,
    minor_category: bridgeEvent.minor_category,
    change_trigger_key: bridgeEvent.change_trigger_key,
    support_shape_key: bridgeEvent.support_shape_key,

    user_signal_summary: bridgeEvent.user_signal_summary,
    hopy_support_summary: bridgeEvent.hopy_support_summary,
    transition_reason: bridgeEvent.transition_reason,
    future_support_hint: bridgeEvent.future_support_hint,

    bridge_insight: bridgeEvent.bridge_insight,
    bridge_hint: bridgeEvent.bridge_hint,
    bridge_flow: bridgeEvent.bridge_flow,
    bridge_reason: bridgeEvent.bridge_reason,

    owner_visible_summary: bridgeEvent.owner_visible_summary,
    future_visible_summary: bridgeEvent.future_visible_summary,

    handoff_message_snapshot: bridgeEvent.handoff_message_snapshot,

    compass_basis: bridgeEvent.compass_basis,
    safety_notes: bridgeEvent.safety_notes,
    avoidance_notes: bridgeEvent.avoidance_notes,

    source_transition_signal_id: bridgeEvent.source_transition_signal_id,
    source_assistant_message_id: bridgeEvent.source_assistant_message_id,
    source_trigger_message_id: bridgeEvent.source_trigger_message_id,

    confidence_score: bridgeEvent.confidence_score,
    reuse_scope: bridgeEvent.reuse_scope,
    status: bridgeEvent.status,

    metadata: safeMetadata(bridgeEvent.metadata),
  };

  const { data, error } = await params.supabase
    .from("hopy_future_chain_bridge_events")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    if (isDuplicateError(error)) {
      return {
        ok: true,
        skipped: true,
        id: null,
        error: "source_assistant_message_id の bridge_event は既に存在する",
      };
    }

    return {
      ok: false,
      skipped: false,
      id: null,
      error: readErrorMessage(error),
    };
  }

  const id = readInsertedId(data);

  if (!id) {
    return {
      ok: false,
      skipped: false,
      id: null,
      error: "bridge_event_id_not_returned",
    };
  }

  return {
    ok: true,
    skipped: false,
    id,
    error: null,
  };
}

export async function persistFutureChainCandidate({
  supabase,
  saveCheck,
}: PersistFutureChainCandidateParams): Promise<PersistFutureChainCandidateResult> {
  if (saveCheck.decision !== "save") {
    return {
      ok: true,
      skipped: true,
      reason: saveCheck.reason,
      patternId: null,
      bridgeEventId: null,
    };
  }

  const candidate = getSaveCandidate(saveCheck);

  if (!candidate) {
    return {
      ok: false,
      skipped: false,
      reason: "save candidate が存在しない",
      stage: "input",
      error: "candidate_missing",
      patternId: null,
      bridgeEventId: null,
    };
  }

  const bridgeEvent = candidate.bridge_event;

  if (!bridgeEvent) {
    return {
      ok: false,
      skipped: false,
      reason: "bridge_event candidate が存在しない",
      stage: "input",
      error: "bridge_event_missing",
      patternId: null,
      bridgeEventId: null,
    };
  }

  const pattern = await resolvePatternId({
    supabase,
    candidate,
  });

  if (!pattern.ok || !pattern.id) {
    return {
      ok: false,
      skipped: false,
      reason: "Future Chain pattern の保存に失敗したため bridge_event は保存しない",
      stage: pattern.stage,
      error: pattern.error ?? "pattern_save_failed",
      patternId: null,
      bridgeEventId: null,
    };
  }

  const bridge = await insertBridgeEvent({
    supabase,
    patternId: pattern.id,
    bridgeEvent,
  });

  if (!bridge.ok) {
    return {
      ok: false,
      skipped: false,
      reason: "Future Chain bridge_event の保存に失敗した",
      stage: "bridge_event_insert",
      error: bridge.error ?? "bridge_event_insert_failed",
      patternId: pattern.id,
      bridgeEventId: null,
    };
  }

  if (bridge.skipped) {
    return {
      ok: true,
      skipped: true,
      reason: bridge.error ?? "Future Chain bridge_event は既に保存済み",
      patternId: pattern.id,
      bridgeEventId: null,
    };
  }

  if (!bridge.id) {
    return {
      ok: false,
      skipped: false,
      reason: "Future Chain bridge_event の id が返らなかった",
      stage: "bridge_event_insert",
      error: "bridge_event_id_missing",
      patternId: pattern.id,
      bridgeEventId: null,
    };
  }

  return {
    ok: true,
    skipped: false,
    reason: "Future Chain bridge_event を保存した",
    patternId: pattern.id,
    bridgeEventId: bridge.id,
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain v3.1 の DB保存だけを担当する。
保存前チェックと candidate 生成を通過した結果を受け取り、
hopy_future_chain_patterns の既存確認または作成、
hopy_future_chain_bridge_events への insert、
保存結果の返却だけを行う。

このファイルは HOPY回答再要約、Compass再要約、Future Chain意味生成、
state_changed再判定、state_level再判定、current_phase再判定、
Compass表示可否判定、HOPY回答○判定、UI表示判定、recipient_support検索を担当しない。

【今回このファイルで修正したこと】
- bridge_event insert row に handoff_message_snapshot を追加しました。
- 現在確認済みの DB カラム実態に合わせ、hopy_future_chain_bridge_events に存在しない owner_user_id / delivery_eligible は insert しない形にしました。
- source_assistant_message_id の重複skip処理、pattern lookup / insert、bridge_event insert の順序は維持しました。
- candidate生成、保存前チェック、UI判定、recipient_support検索、delivery_event保存には触れていません。

/app/api/chat/_lib/hopy/future-chain/futureChainPersist.ts
*/