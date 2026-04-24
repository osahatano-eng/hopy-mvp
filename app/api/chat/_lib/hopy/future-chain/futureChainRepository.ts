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

function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildFutureChainInsertPayload(
  candidate: HopyFutureChainCandidate,
): Record<string, unknown> {
  return {
    pattern_key: candidate.pattern_key,
    language: candidate.language,
    from_state_level: candidate.from_state_level,
    to_state_level: candidate.to_state_level,
    transition_kind: candidate.transition_kind,
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

export async function insertFutureChainPattern(
  params: InsertFutureChainPatternParams,
): Promise<HopyFutureChainInsertResult> {
  const { supabase, candidate } = params;

  const existingPatternId = await findExistingFutureChainPatternId({
    supabase,
    candidate,
  });

  if (existingPatternId) {
    return {
      ok: true,
      patternId: existingPatternId,
    };
  }

  const payload = buildFutureChainInsertPayload(candidate);

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

    if (fallbackExistingPatternId) {
      return {
        ok: true,
        patternId: fallbackExistingPatternId,
      };
    }

    return {
      ok: false,
      error,
    };
  }

  return {
    ok: true,
    patternId: data?.id ?? null,
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain DB の保存処理だけを担当する。
生成済みの Future Chain candidate を hopy_future_chain_patterns へ保存し、保存結果の id を返す。
同じ pattern_key + language の既存行がある場合は、重複insertせず既存 id を返す。
このファイルは保存前チェック、candidate生成、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- pattern_key + language の既存Future Chainパターンを確認する findExistingFutureChainPatternId(...) を追加した。
- insert 前に同じ pattern_key + language が既にある場合は、DB保存失敗扱いにせず既存 patternId を返すようにした。
- insert 失敗時にも既存行を再確認し、同一パターンが存在する場合は既存 patternId を返すようにした。
- candidate生成、下降文言、保存前チェック、DB制約、UI、状態判定、Compass、HOPY回答○には触れていない。

/app/api/chat/_lib/hopy/future-chain/futureChainRepository.ts
*/