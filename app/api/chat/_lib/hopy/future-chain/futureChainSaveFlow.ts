// /app/api/chat/_lib/hopy/future-chain/futureChainSaveFlow.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  checkFutureChainSavePreconditions,
  type HopyFutureChainPrecheckResult,
} from "./futureChainCheck";
import { buildFutureChainCandidate } from "./futureChainCandidate";
import {
  persistFutureChainCandidate,
  type PersistFutureChainCandidateResult,
} from "./futureChainPersist";
import type {
  HopyFutureChainSaveCheckResult,
  HopyFutureChainSourceContext,
} from "./futureChainTypes";

export type FutureChainSaveFlowStage = "precheck" | "candidate" | "persist";

export type ExecuteFutureChainSaveFlowParams = {
  supabase: SupabaseClient;
  sourceContext: HopyFutureChainSourceContext;
};

export type ExecuteFutureChainSaveFlowResult = {
  ok: boolean;
  skipped: boolean;
  stage: FutureChainSaveFlowStage;
  reason: string;
  precheck: HopyFutureChainPrecheckResult;
  saveCheck: HopyFutureChainSaveCheckResult | null;
  persist: PersistFutureChainCandidateResult | null;
  patternId: string | null;
  bridgeEventId: string | null;
  error: string | null;
};

export async function executeFutureChainSaveFlow({
  supabase,
  sourceContext,
}: ExecuteFutureChainSaveFlowParams): Promise<ExecuteFutureChainSaveFlowResult> {
  const precheck = checkFutureChainSavePreconditions({
    sourceContext,
  });

  if (precheck.decision !== "continue") {
    return {
      ok: true,
      skipped: true,
      stage: "precheck",
      reason: precheck.reason,
      precheck,
      saveCheck: null,
      persist: null,
      patternId: null,
      bridgeEventId: null,
      error: null,
    };
  }

  const saveCheck = buildFutureChainCandidate({
    sourceContext,
    precheck,
  });

  if (saveCheck.decision !== "save") {
    return {
      ok: true,
      skipped: true,
      stage: "candidate",
      reason: saveCheck.reason,
      precheck,
      saveCheck,
      persist: null,
      patternId: null,
      bridgeEventId: null,
      error: null,
    };
  }

  const persist = await persistFutureChainCandidate({
    supabase,
    saveCheck,
  });

  if (!persist.ok) {
    return {
      ok: false,
      skipped: false,
      stage: "persist",
      reason: persist.reason,
      precheck,
      saveCheck,
      persist,
      patternId: persist.patternId,
      bridgeEventId: persist.bridgeEventId,
      error: persist.error,
    };
  }

  return {
    ok: true,
    skipped: persist.skipped,
    stage: "persist",
    reason: persist.reason,
    precheck,
    saveCheck,
    persist,
    patternId: persist.patternId,
    bridgeEventId: persist.bridgeEventId,
    error: null,
  };
}

export default executeFutureChainSaveFlow;

/*
【このファイルの正式役割】
HOPY Future Chain v3 の保存フロー接続だけを担当する。
checkFutureChainSavePreconditions(...)、
buildFutureChainCandidate(...)、
persistFutureChainCandidate(...) を順番に呼び出し、
保存前チェック、candidate生成、DB保存の結果をまとめて返す。

このファイルは HOPY回答再要約、Compass再要約、Future Chain意味生成、
state_changed再判定、state_level再判定、current_phase再判定、
Compass表示可否判定、HOPY回答○判定、UI表示判定、recipient_support検索、
DB insert の中身を担当しない。

【今回このファイルで修正したこと】
- 新規ファイルとして Future Chain v3 の保存フロー接続を作成した。
- 保存前チェック → candidate生成 → DB保存の順番を1本に固定した。
- precheck で skip された場合は candidate生成へ進まない形にした。
- candidate生成で skip された場合は DB保存へ進まない形にした。
- DB保存結果の patternId / bridgeEventId / error をそのまま返す形にした。
- HOPY回答全文、Compass全文、ユーザー発話生文を読む処理は入れていない。

/app/api/chat/_lib/hopy/future-chain/futureChainSaveFlow.ts
*/