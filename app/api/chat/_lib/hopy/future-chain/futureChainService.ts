// /app/api/chat/_lib/hopy/future-chain/futureChainService.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  executeFutureChainSaveFlow,
  type ExecuteFutureChainSaveFlowResult,
} from "./futureChainSaveFlow";
import type { HopyFutureChainSourceContext } from "./futureChainTypes";

type SaveFutureChainFlowCommon = {
  reason: string;
  patternId: string | null;
  bridgeEventId: string | null;
  stage: ExecuteFutureChainSaveFlowResult["stage"];
  precheck: ExecuteFutureChainSaveFlowResult["precheck"];
  check: ExecuteFutureChainSaveFlowResult["saveCheck"];
  insert: ExecuteFutureChainSaveFlowResult["persist"];
  flow: ExecuteFutureChainSaveFlowResult;
};

export type SaveFutureChainFromConfirmedPayloadResult =
  | (SaveFutureChainFlowCommon & {
      ok: true;
      decision: "save";
      skipped: false;
    })
  | (SaveFutureChainFlowCommon & {
      ok: true;
      decision: "skip";
      skipped: true;
    })
  | (SaveFutureChainFlowCommon & {
      ok: false;
      decision: "save";
      skipped: false;
      error: string;
    });

export async function saveFutureChainFromConfirmedPayload(params: {
  supabase: SupabaseClient;
  sourceContext: HopyFutureChainSourceContext;
}): Promise<SaveFutureChainFromConfirmedPayloadResult> {
  const flow = await executeFutureChainSaveFlow({
    supabase: params.supabase,
    sourceContext: params.sourceContext,
  });

  const common: SaveFutureChainFlowCommon = {
    reason: flow.reason,
    patternId: flow.patternId,
    bridgeEventId: flow.bridgeEventId,
    stage: flow.stage,
    precheck: flow.precheck,
    check: flow.saveCheck,
    insert: flow.persist,
    flow,
  };

  if (!flow.ok) {
    return {
      ok: false,
      decision: "save",
      skipped: false,
      error: flow.error ?? "future_chain_save_failed",
      ...common,
    };
  }

  if (flow.skipped) {
    return {
      ok: true,
      decision: "skip",
      skipped: true,
      ...common,
    };
  }

  return {
    ok: true,
    decision: "save",
    skipped: false,
    ...common,
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain DB の入口関数だけを担当する。
hopy_confirmed_payload 起点の sourceContext を受け取り、
Future Chain v3.1 の保存フロー executeFutureChainSaveFlow(...) へ渡し、
呼び出し元へ保存結果を返す。

このファイルは保存前チェックの中身、candidate生成の中身、DB insert の中身、
HOPY回答再要約、Compass再要約、Future Chain意味生成、state_changed再判定、
state_level再判定、current_phase再判定、Compass再判定、HOPY回答○再判定を担当しない。

【今回このファイルで修正したこと】
- 削除済みの旧Repositoryルートに関する insertFutureChainPattern(...) 表記をコメントから削除しました。
- Future Chain v3.1 の保存入口が executeFutureChainSaveFlow(...) であることが分かるコメントへ整理しました。
- authenticatedTurnDeps.ts 側の saveFutureChainFromConfirmedPayload(...) 呼び出し口は維持しています。
- check / insert 互換名は、呼び出し元が結果を参照しやすいように saveCheck / persist の中継として残しています。
- 実行コード、保存前チェック、candidate生成、DB保存、UI、状態判定、Compass、HOPY回答○には触れていません。

/app/api/chat/_lib/hopy/future-chain/futureChainService.ts
*/