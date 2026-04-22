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

export async function insertFutureChainPattern(
  params: InsertFutureChainPatternParams,
): Promise<HopyFutureChainInsertResult> {
  const { supabase, candidate } = params;

  const payload = buildFutureChainInsertPayload(candidate);

  const { data, error } = await supabase
    .from("hopy_future_chain_patterns")
    .insert(payload)
    .select("id")
    .single<FutureChainPatternInsertRow>();

  if (error) {
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
HOPY Future Chain DB の DB insert だけを担当する。
生成済みの Future Chain candidate を hopy_future_chain_patterns へ保存し、保存結果の id を返す。
このファイルは保存前チェック、candidate生成、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- Future Chain 専用フォルダ内に、DB insert 専用 repository ファイルを新規作成した。
- hopy_future_chain_patterns へ candidate を insert し、保存後の id を返す処理を作成した。
- nullable でよい text 系カラムは空文字を null に寄せるようにした。
- source_transition_signal_id は v1 では null のまま保存できる構造にした。
- 保存前チェック、candidate生成、既存Learning処理への接続はまだ実装していない。

/app/api/chat/_lib/hopy/future-chain/futureChainRepository.ts
*/