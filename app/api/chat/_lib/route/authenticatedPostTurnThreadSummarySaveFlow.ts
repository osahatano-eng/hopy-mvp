// /app/api/chat/_lib/route/authenticatedPostTurnThreadSummarySaveFlow.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConfirmedMemoryCandidate } from "./authenticatedHelpers";
import { createDefaultMemoryWriteDebug } from "./authenticatedHelpers";
import {
  attachThreadSummarySaveDebugToPayload,
  createDefaultThreadSummarySaveDebug,
  saveConfirmedThreadSummary,
} from "./authenticatedPostTurnThreadSummarySave";

type ThreadSummarySaveDebug = ReturnType<
  typeof createDefaultThreadSummarySaveDebug
>;

type MemoryWriteDebug = ReturnType<typeof createDefaultMemoryWriteDebug>;

export type AuthenticatedPostTurnThreadSummarySaveFlowParams = {
  internalWriteSupabase: SupabaseClient;
  supabase: SupabaseClient;
  resolvedConversationId: string;
  authedUserId: string;
  confirmedThreadSummary: string | null;
  debugSave: boolean;
  usedHeuristicConfirmedMemoryCandidates: boolean;
};

export type AuthenticatedPostTurnThreadSummarySaveFlowFailureResult = {
  payload: any;
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

export type AuthenticatedPostTurnThreadSummarySaveFlowResult = {
  threadSummarySaveDebug: ThreadSummarySaveDebug;
  failureResult: AuthenticatedPostTurnThreadSummarySaveFlowFailureResult | null;
};

export async function executeAuthenticatedPostTurnThreadSummarySaveFlow({
  internalWriteSupabase,
  supabase,
  resolvedConversationId,
  authedUserId,
  confirmedThreadSummary,
  debugSave,
  usedHeuristicConfirmedMemoryCandidates,
}: AuthenticatedPostTurnThreadSummarySaveFlowParams): Promise<AuthenticatedPostTurnThreadSummarySaveFlowResult> {
  let threadSummarySaveDebug = createDefaultThreadSummarySaveDebug({
    confirmedThreadSummary,
  });

  if (confirmedThreadSummary === null) {
    return {
      threadSummarySaveDebug,
      failureResult: null,
    };
  }

  const threadSummarySave = await saveConfirmedThreadSummary({
    internalWriteSupabase,
    supabase,
    resolvedConversationId,
    authedUserId,
    confirmedThreadSummary,
  });

  threadSummarySaveDebug = threadSummarySave.debug;

  if (threadSummarySave.ok) {
    return {
      threadSummarySaveDebug,
      failureResult: null,
    };
  }

  const failurePayload = attachThreadSummarySaveDebugToPayload({
    payload: {
      ok: false,
      error:
        threadSummarySave.error ??
        "authenticatedPostTurn: thread_summary_save_failed:update_failed",
    },
    debugSave,
    threadSummarySaveDebug,
  });

  return {
    threadSummarySaveDebug,
    failureResult: {
      payload: failurePayload,
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
    },
  };
}

/*
【このファイルの正式役割】
authenticated 経路の postTurn 最終化における thread_summary 保存フロー責務。
confirmedThreadSummary を受け取り、
thread_summary 保存、threadSummarySaveDebug 更新、
保存失敗時の debug 付き failure payload 作成と early return 用結果生成だけを担当する。
このファイルは state_changed / state_level / current_phase / Compass を再判定せず、
親から受け取った confirmedThreadSummary と保存に必要な値をそのまま使う。

【今回このファイルで修正したこと】
- authenticatedPostTurn.ts に残っていた thread_summary 保存フローの受け皿を作成した。
- createDefaultThreadSummarySaveDebug(...) による初期 debug 作成を移した。
- confirmedThreadSummary が null の場合は保存せず、debug だけ返す流れを作った。
- saveConfirmedThreadSummary(...) の実行と threadSummarySaveDebug 更新を移した。
- 保存失敗時の attachThreadSummarySaveDebugToPayload(...) と failureResult 生成を移した。
- HOPY唯一の正、state_changed、Compass、HOPY回答○、Memory 書き込み、
  Learning 保存、Future Chain、audit、thread title、payload 生成本体には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnThreadSummarySaveFlow.ts
*/