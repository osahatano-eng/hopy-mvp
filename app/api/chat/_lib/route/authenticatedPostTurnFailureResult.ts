// /app/api/chat/_lib/route/authenticatedPostTurnFailureResult.ts

import type { ConfirmedMemoryCandidate } from "./authenticatedHelpers";
import { createDefaultMemoryWriteDebug } from "./authenticatedHelpers";

type MemoryWriteDebug = ReturnType<typeof createDefaultMemoryWriteDebug>;

export type AuthenticatedPostTurnFailureResultParams = {
  error: string;
  usedHeuristicConfirmedMemoryCandidates: boolean;
};

export type AuthenticatedPostTurnFailureResult = {
  payload: {
    ok: false;
    error: string;
  };
  memoryWrite: MemoryWriteDebug;
  confirmedMemoryCandidates: ConfirmedMemoryCandidate[];
  usedHeuristicConfirmedMemoryCandidates: boolean;
  learning_save_attempted: boolean | null;
  learning_save_inserted: number | null;
  learning_save_reason: string | null;
  learning_save_error: string | null;
  mem_write_ok: boolean | null;
  mem_write_error: string | null;
  audit_ok: boolean | null;
  audit_error: string | null;
};

export function createAuthenticatedPostTurnFailureResult({
  error,
  usedHeuristicConfirmedMemoryCandidates,
}: AuthenticatedPostTurnFailureResultParams): AuthenticatedPostTurnFailureResult {
  return {
    payload: {
      ok: false,
      error,
    },
    memoryWrite: createDefaultMemoryWriteDebug("not_attempted"),
    confirmedMemoryCandidates: [],
    usedHeuristicConfirmedMemoryCandidates,
    learning_save_attempted: null,
    learning_save_inserted: null,
    learning_save_reason: null,
    learning_save_error: null,
    mem_write_ok: null,
    mem_write_error: null,
    audit_ok: null,
    audit_error: null,
  };
}

/*
【このファイルの正式役割】
authenticated 経路の postTurn 最終化における postTurn 失敗結果作成責務。
失敗理由 error と usedHeuristicConfirmedMemoryCandidates を受け取り、
finalizeAuthenticatedPostTurn(...) が返す失敗時 result の共通形を作成する。
このファイルは失敗判定そのものを行わず、
state_changed / state_level / current_phase / Compass を再判定しない。

【今回このファイルで修正したこと】
- authenticatedPostTurn.ts に重複して残っている失敗時戻り値作成の受け皿を作成した。
- payload.ok=false / error を持つ failure result 作成を関数化した。
- memoryWrite は createDefaultMemoryWriteDebug("not_attempted") のまま維持した。
- confirmedMemoryCandidates は空配列、各保存結果系は null のまま維持した。
- HOPY唯一の正、state_changed、Compass、HOPY回答○、Memory書き込み、
  Learning保存、thread_summary、audit、thread title、payload生成、Future Chain には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnFailureResult.ts
*/