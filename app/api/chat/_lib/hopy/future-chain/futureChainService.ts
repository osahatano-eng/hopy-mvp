// /app/api/chat/_lib/hopy/future-chain/futureChainService.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildFutureChainCandidate } from "./futureChainCandidate";
import { checkFutureChainSavePreconditions } from "./futureChainCheck";
import { insertFutureChainPattern } from "./futureChainRepository";
import type {
  HopyFutureChainInsertResult,
  HopyFutureChainSaveCheckResult,
  HopyFutureChainSourceContext,
} from "./futureChainTypes";

export type SaveFutureChainFromConfirmedPayloadResult =
  | {
      ok: true;
      decision: "save";
      reason: string;
      patternId: string | null;
      bridgeEventId: string | null;
      check: HopyFutureChainSaveCheckResult;
      insert: HopyFutureChainInsertResult;
    }
  | {
      ok: true;
      decision: "skip";
      reason: string;
      patternId: null;
      bridgeEventId: null;
      check: HopyFutureChainSaveCheckResult;
      insert: null;
    }
  | {
      ok: false;
      decision: "save";
      reason: string;
      patternId: null;
      bridgeEventId: null;
      check: HopyFutureChainSaveCheckResult;
      insert: HopyFutureChainInsertResult;
    };

export async function saveFutureChainFromConfirmedPayload(params: {
  supabase: SupabaseClient;
  sourceContext: HopyFutureChainSourceContext;
}): Promise<SaveFutureChainFromConfirmedPayloadResult> {
  const { supabase, sourceContext } = params;

  const precheck = checkFutureChainSavePreconditions({
    sourceContext,
  });

  const candidateDecision = buildFutureChainCandidate({
    sourceContext,
    precheck,
  });

  if (candidateDecision.decision === "skip") {
    return {
      ok: true,
      decision: "skip",
      reason: candidateDecision.reason,
      patternId: null,
      bridgeEventId: null,
      check: candidateDecision,
      insert: null,
    };
  }

  const insert = await insertFutureChainPattern({
    supabase,
    candidate: candidateDecision.candidate,
  });

  if (!insert.ok) {
    return {
      ok: false,
      decision: "save",
      reason: "Future Chain candidate の DB 保存に失敗した",
      patternId: null,
      bridgeEventId: null,
      check: candidateDecision,
      insert,
    };
  }

  return {
    ok: true,
    decision: "save",
    reason: candidateDecision.reason,
    patternId: insert.patternId,
    bridgeEventId: insert.bridgeEventId ?? null,
    check: candidateDecision,
    insert,
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain DB の入口関数だけを担当する。
hopy_confirmed_payload 起点の sourceContext を受け取り、保存前チェック、candidate生成、DB保存を順番に呼ぶ。
このファイルは保存前チェックの中身、candidate生成の中身、DB insert の中身、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- SaveFutureChainFromConfirmedPayloadResult に bridgeEventId を追加した。
- save 成功時に insertFutureChainPattern(...) が返した bridgeEventId を呼び出し元へ返すようにした。
- skip / 保存失敗時は bridgeEventId: null を返すようにし、返却形を明確にした。
- 保存前チェック、candidate生成、DB insert の中身、UI、状態判定、Compass、HOPY回答○には触れていない。

/app/api/chat/_lib/hopy/future-chain/futureChainService.ts
*/