// /app/api/chat/_lib/hopy/future-chain/futureChainRepository.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  HopyFutureChainCandidate,
  HopyFutureChainInsertResult,
} from "./futureChainTypes";

type InsertFutureChainPatternParams = {
  supabase: SupabaseClient;
  candidate: HopyFutureChainCandidate;
};

type FutureChainPatternInsertRow = {
  id: string | null;
};

type FutureChainBridgeEventInsertRow = {
  id: string | null;
};

type FutureChainBridgeEventCandidate = NonNullable<
  HopyFutureChainCandidate["bridge_event"]
>;

function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildFutureChainPatternInsertPayload(
  candidate: HopyFutureChainCandidate,
): Record<string, unknown> {
  return {
    pattern_key: candidate.pattern_key,
    language: candidate.language,
    from_state_level: candidate.from_state_level,
    to_state_level: candidate.to_state_level,
    transition_kind: candidate.transition_kind,
    transition_meaning: candidate.transition_meaning,
    support_shape_key: candidate.support_shape_key,
    major_category: candidate.major_category ?? null,
    minor_category: candidate.minor_category ?? null,
    change_trigger_key: candidate.change_trigger_key ?? null,
    delivery_target_state_level: candidate.delivery_target_state_level ?? null,
    delivery_usage: candidate.delivery_usage ?? null,
    abstract_context: candidate.abstract_context,
    transition_reason: candidate.transition_reason,
    effective_support: candidate.effective_support,
    user_progress_signal: candidate.user_progress_signal,
    future_support_hint: candidate.future_support_hint,
    bridge_summary: candidate.bridge_summary ?? null,
    compass_basis: normalizeNullableText(candidate.compass_basis),
    safety_notes: normalizeNullableText(candidate.safety_notes),
    avoidance_notes: normalizeNullableText(candidate.avoidance_notes),
    evidence_count: candidate.evidence_count,
    weight: candidate.weight,
    confidence_score: candidate.confidence_score,
    reuse_scope: candidate.reuse_scope,
    status: candidate.status,
    metadata: candidate.metadata,
    source_transition_signal_id:
      candidate.source_transition_signal_id ?? null,
    source_response_learning_id:
      candidate.source_response_learning_id ?? null,
    source_learning_insight_id:
      candidate.source_learning_insight_id ?? null,
  };
}

function buildFutureChainBridgeEventInsertPayload(params: {
  patternId: string | null;
  candidate: HopyFutureChainCandidate;
  bridgeEvent: FutureChainBridgeEventCandidate;
}): Record<string, unknown> {
  const { patternId, candidate, bridgeEvent } = params;

  return {
    pattern_id: patternId ?? bridgeEvent.pattern_id ?? null,
    language: bridgeEvent.language,
    from_state_level: bridgeEvent.from_state_level,
    to_state_level: bridgeEvent.to_state_level,
    transition_kind: bridgeEvent.transition_kind,
    transition_meaning: bridgeEvent.transition_meaning,
    major_category: bridgeEvent.major_category ?? candidate.major_category ?? null,
    minor_category: bridgeEvent.minor_category ?? candidate.minor_category ?? null,
    change_trigger_key:
      bridgeEvent.change_trigger_key ?? candidate.change_trigger_key ?? null,
    support_shape_key:
      bridgeEvent.support_shape_key ?? candidate.support_shape_key ?? null,
    delivery_target_state_level:
      bridgeEvent.delivery_target_state_level ??
      candidate.delivery_target_state_level ??
      null,
    delivery_usage: bridgeEvent.delivery_usage ?? candidate.delivery_usage ?? null,
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
    compass_basis: normalizeNullableText(bridgeEvent.compass_basis),
    safety_notes: normalizeNullableText(bridgeEvent.safety_notes),
    avoidance_notes: normalizeNullableText(bridgeEvent.avoidance_notes),
    source_transition_signal_id:
      bridgeEvent.source_transition_signal_id ?? null,
    source_assistant_message_id: bridgeEvent.source_assistant_message_id,
    source_trigger_message_id: bridgeEvent.source_trigger_message_id ?? null,
    confidence_score: bridgeEvent.confidence_score,
    reuse_scope: bridgeEvent.reuse_scope,
    status: bridgeEvent.status,
    metadata: bridgeEvent.metadata,
  };
}

async function findExistingFutureChainPatternId(
  params: InsertFutureChainPatternParams,
): Promise<string | null> {
  const { supabase, candidate } = params;

  const { data, error } = await supabase
    .from("hopy_future_chain_patterns")
    .select("id")
    .eq("pattern_key", candidate.pattern_key)
    .eq("language", candidate.language)
    .limit(1);

  if (error) {
    return null;
  }

  const rows = Array.isArray(data)
    ? (data as FutureChainPatternInsertRow[])
    : [];

  return rows[0]?.id ?? null;
}

async function findExistingFutureChainBridgeEventId(params: {
  supabase: SupabaseClient;
  sourceAssistantMessageId: string;
}): Promise<string | null> {
  const { supabase, sourceAssistantMessageId } = params;

  const { data, error } = await supabase
    .from("hopy_future_chain_bridge_events")
    .select("id")
    .eq("source_assistant_message_id", sourceAssistantMessageId)
    .limit(1);

  if (error) {
    return null;
  }

  const rows = Array.isArray(data)
    ? (data as FutureChainBridgeEventInsertRow[])
    : [];

  return rows[0]?.id ?? null;
}

async function insertFutureChainBridgeEvent(params: {
  supabase: SupabaseClient;
  patternId: string | null;
  candidate: HopyFutureChainCandidate;
  bridgeEvent: FutureChainBridgeEventCandidate;
}): Promise<{
  ok: true;
  bridgeEventId: string | null;
} | {
  ok: false;
  error: unknown;
}> {
  const { supabase, patternId, candidate, bridgeEvent } = params;

  const existingBridgeEventId = await findExistingFutureChainBridgeEventId({
    supabase,
    sourceAssistantMessageId: bridgeEvent.source_assistant_message_id,
  });

  if (existingBridgeEventId) {
    return {
      ok: true,
      bridgeEventId: existingBridgeEventId,
    };
  }

  const payload = buildFutureChainBridgeEventInsertPayload({
    patternId,
    candidate,
    bridgeEvent,
  });

  const { data, error } = await supabase
    .from("hopy_future_chain_bridge_events")
    .insert(payload)
    .select("id")
    .single<FutureChainBridgeEventInsertRow>();

  if (error) {
    const fallbackExistingBridgeEventId =
      await findExistingFutureChainBridgeEventId({
        supabase,
        sourceAssistantMessageId: bridgeEvent.source_assistant_message_id,
      });

    if (fallbackExistingBridgeEventId) {
      return {
        ok: true,
        bridgeEventId: fallbackExistingBridgeEventId,
      };
    }

    return {
      ok: false,
      error,
    };
  }

  return {
    ok: true,
    bridgeEventId: data?.id ?? null,
  };
}

export async function insertFutureChainPattern(
  params: InsertFutureChainPatternParams,
): Promise<HopyFutureChainInsertResult> {
  const { supabase, candidate } = params;

  const existingPatternId = await findExistingFutureChainPatternId({
    supabase,
    candidate,
  });

  let patternId = existingPatternId;

  if (!patternId) {
    const payload = buildFutureChainPatternInsertPayload(candidate);

    const { data, error } = await supabase
      .from("hopy_future_chain_patterns")
      .insert(payload)
      .select("id")
      .single<FutureChainPatternInsertRow>();

    if (error) {
      const fallbackExistingPatternId = await findExistingFutureChainPatternId({
        supabase,
        candidate,
      });

      if (!fallbackExistingPatternId) {
        return {
          ok: false,
          error,
        };
      }

      patternId = fallbackExistingPatternId;
    } else {
      patternId = data?.id ?? null;
    }
  }

  if (!candidate.bridge_event) {
    return {
      ok: true,
      patternId,
      bridgeEventId: null,
    };
  }

  const bridgeResult = await insertFutureChainBridgeEvent({
    supabase,
    patternId,
    candidate,
    bridgeEvent: candidate.bridge_event,
  });

  if (!bridgeResult.ok) {
    return {
      ok: false,
      error: bridgeResult.error,
    };
  }

  return {
    ok: true,
    patternId,
    bridgeEventId: bridgeResult.bridgeEventId,
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain DB の保存処理だけを担当する。
生成済みの Future Chain candidate を hopy_future_chain_patterns へ保存し、必要な場合は candidate.bridge_event を hopy_future_chain_bridge_events へ保存し、保存結果の id を返す。
同じ pattern_key + language の既存行がある場合は、重複insertせず既存 id を返す。
同じ source_assistant_message_id の bridge_event がある場合は、重複insertせず既存 id を返す。
このファイルは保存前チェック、candidate生成、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- hopy_future_chain_patterns 保存payloadに transition_meaning / support_shape_key / major_category / minor_category / change_trigger_key / delivery_target_state_level / delivery_usage を追加した。
- candidate.bridge_event がある場合に hopy_future_chain_bridge_events へ保存する insertFutureChainBridgeEvent(...) を追加した。
- source_assistant_message_id の既存 bridge_event を確認し、重複insertせず既存 bridgeEventId を返すようにした。
- pattern 保存後に bridge_event を保存し、HopyFutureChainInsertResult で bridgeEventId も返せるようにした。
- 保存前チェック、candidate生成、下降文言、DB制約、UI、状態判定、Compass、HOPY回答○には触れていない。

/app/api/chat/_lib/hopy/future-chain/futureChainRepository.ts
*/