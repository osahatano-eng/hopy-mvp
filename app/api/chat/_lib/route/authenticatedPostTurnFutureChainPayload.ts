// /app/api/chat/_lib/route/authenticatedPostTurnFutureChainPayload.ts

import {
  buildFutureChainTurnPersistResult,
  type FutureChainTurnPersistResult,
} from "./futureChainTurnPersistResult";

type RunHopyTurnBuiltResult = Record<string, any>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function resolveFutureChainPersistFromRunTurnResult(
  runTurnResult: RunHopyTurnBuiltResult | null | undefined,
): FutureChainTurnPersistResult | null {
  const resultRecord = asRecord(runTurnResult ?? null);
  if (!resultRecord) {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(resultRecord, "future_chain_persist")) {
    return null;
  }

  return buildFutureChainTurnPersistResult(resultRecord.future_chain_persist);
}

export function attachFutureChainPersistToPayload(params: {
  payload: any;
  runTurnResult: RunHopyTurnBuiltResult | null | undefined;
}): any {
  const payloadRecord = asRecord(params.payload);
  if (!payloadRecord) {
    return params.payload;
  }

  const futureChainPersist = resolveFutureChainPersistFromRunTurnResult(
    params.runTurnResult,
  );
  if (futureChainPersist === null) {
    return params.payload;
  }

  payloadRecord.future_chain_persist = futureChainPersist;
  return params.payload;
}

/*
【このファイルの正式役割】
authenticated postTurn の最終 payload に、
runTurnResult.future_chain_persist を安全に正規化して中継する責務だけを持つ。
Future Chain 保存可否、DB保存、state_changed、state_level、Compass、HOPY回答○は再判定しない。
このファイルは、受け取った保存結果を最終 JSON へ載せるだけの接続責務である。

【今回このファイルで修正したこと】
- /app/api/chat/_lib/route/authenticatedPostTurn.ts から分離するため、
  Future Chain 保存結果の payload 中継責務を新規ファイルとして作成した。
- runTurnResult.future_chain_persist を buildFutureChainTurnPersistResult(...) で正規化し、
  存在する場合だけ payload.future_chain_persist に載せる処理を移した。
- HOPY唯一の正、Compass、memory、learning、audit、thread_summary、title 解決には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnFutureChainPayload.ts
*/