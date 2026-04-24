// /app/api/chat/_lib/route/authenticatedPostTurnThreadSummarySave.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import { errorText } from "../infra/text";

export type ThreadSummarySaveAttemptResult = {
  step:
    | "primary_internal_with_user_id"
    | "fallback_supabase_with_user_id"
    | "final_internal_without_user_id";
  client_name: "internalWriteSupabase" | "supabase";
  scoped_by_user_id: boolean;
  ok: boolean;
  matched: boolean;
  error: string | null;
};

export type ThreadSummarySaveDebug = {
  attempted: boolean;
  confirmed_thread_summary_present: boolean;
  confirmed_thread_summary_length: number | null;
  ok: boolean | null;
  error: string | null;
  matched_step:
    | "primary_internal_with_user_id"
    | "fallback_supabase_with_user_id"
    | "final_internal_without_user_id"
    | null;
  attempts: ThreadSummarySaveAttemptResult[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function createDefaultThreadSummarySaveDebug(params: {
  confirmedThreadSummary: string | null;
}): ThreadSummarySaveDebug {
  return {
    attempted: false,
    confirmed_thread_summary_present: params.confirmedThreadSummary !== null,
    confirmed_thread_summary_length:
      params.confirmedThreadSummary?.length ?? null,
    ok: null,
    error: null,
    matched_step: null,
    attempts: [],
  };
}

export function attachThreadSummarySaveDebugToPayload(params: {
  payload: any;
  debugSave: boolean;
  threadSummarySaveDebug: ThreadSummarySaveDebug;
}): any {
  if (!params.debugSave) {
    return params.payload;
  }

  const payloadRecord = asRecord(params.payload);
  if (!payloadRecord) {
    return params.payload;
  }

  const existingDebug = asRecord(payloadRecord.debug) ?? {};
  payloadRecord.debug = {
    ...existingDebug,
    thread_summary_save: params.threadSummarySaveDebug,
  };

  return params.payload;
}

async function saveThreadSummaryAttempt(params: {
  step: ThreadSummarySaveAttemptResult["step"];
  clientName: ThreadSummarySaveAttemptResult["client_name"];
  client: SupabaseClient;
  resolvedConversationId: string;
  authedUserId?: string;
  confirmedThreadSummary: string;
}): Promise<ThreadSummarySaveAttemptResult> {
  const scopedByUserId =
    typeof params.authedUserId === "string" &&
    params.authedUserId.trim().length > 0;

  const query = params.client
    .from("conversations")
    .update({
      thread_summary: params.confirmedThreadSummary,
    })
    .eq("id", params.resolvedConversationId);

  const scopedQuery = scopedByUserId
    ? query.eq("user_id", params.authedUserId as string)
    : query;

  const { data, error } = await scopedQuery.select("id").maybeSingle();

  if (error) {
    return {
      step: params.step,
      client_name: params.clientName,
      scoped_by_user_id: scopedByUserId,
      ok: false,
      matched: false,
      error: errorText(error) || "update_failed",
    };
  }

  return {
    step: params.step,
    client_name: params.clientName,
    scoped_by_user_id: scopedByUserId,
    ok: true,
    matched: Boolean(data?.id),
    error: null,
  };
}

export async function saveConfirmedThreadSummary(params: {
  internalWriteSupabase: SupabaseClient;
  supabase: SupabaseClient;
  resolvedConversationId: string;
  authedUserId: string;
  confirmedThreadSummary: string;
}): Promise<{
  ok: boolean;
  error: string | null;
  debug: ThreadSummarySaveDebug;
}> {
  const attempts: ThreadSummarySaveAttemptResult[] = [];

  const primaryAttempt = await saveThreadSummaryAttempt({
    step: "primary_internal_with_user_id",
    clientName: "internalWriteSupabase",
    client: params.internalWriteSupabase,
    resolvedConversationId: params.resolvedConversationId,
    authedUserId: params.authedUserId,
    confirmedThreadSummary: params.confirmedThreadSummary,
  });
  attempts.push(primaryAttempt);

  if (!primaryAttempt.ok) {
    return {
      ok: false,
      error: `authenticatedPostTurn: thread_summary_save_failed:${primaryAttempt.error ?? "update_failed"}`,
      debug: {
        attempted: true,
        confirmed_thread_summary_present: true,
        confirmed_thread_summary_length: params.confirmedThreadSummary.length,
        ok: false,
        error: `authenticatedPostTurn: thread_summary_save_failed:${primaryAttempt.error ?? "update_failed"}`,
        matched_step: null,
        attempts,
      },
    };
  }

  if (primaryAttempt.matched) {
    return {
      ok: true,
      error: null,
      debug: {
        attempted: true,
        confirmed_thread_summary_present: true,
        confirmed_thread_summary_length: params.confirmedThreadSummary.length,
        ok: true,
        error: null,
        matched_step: primaryAttempt.step,
        attempts,
      },
    };
  }

  if (params.supabase !== params.internalWriteSupabase) {
    const fallbackAttempt = await saveThreadSummaryAttempt({
      step: "fallback_supabase_with_user_id",
      clientName: "supabase",
      client: params.supabase,
      resolvedConversationId: params.resolvedConversationId,
      authedUserId: params.authedUserId,
      confirmedThreadSummary: params.confirmedThreadSummary,
    });
    attempts.push(fallbackAttempt);

    if (!fallbackAttempt.ok) {
      return {
        ok: false,
        error: `authenticatedPostTurn: thread_summary_save_failed:${fallbackAttempt.error ?? "update_failed"}`,
        debug: {
          attempted: true,
          confirmed_thread_summary_present: true,
          confirmed_thread_summary_length: params.confirmedThreadSummary.length,
          ok: false,
          error: `authenticatedPostTurn: thread_summary_save_failed:${fallbackAttempt.error ?? "update_failed"}`,
          matched_step: null,
          attempts,
        },
      };
    }

    if (fallbackAttempt.matched) {
      return {
        ok: true,
        error: null,
        debug: {
          attempted: true,
          confirmed_thread_summary_present: true,
          confirmed_thread_summary_length: params.confirmedThreadSummary.length,
          ok: true,
          error: null,
          matched_step: fallbackAttempt.step,
          attempts,
        },
      };
    }
  }

  const finalAttempt = await saveThreadSummaryAttempt({
    step: "final_internal_without_user_id",
    clientName: "internalWriteSupabase",
    client: params.internalWriteSupabase,
    resolvedConversationId: params.resolvedConversationId,
    confirmedThreadSummary: params.confirmedThreadSummary,
  });
  attempts.push(finalAttempt);

  if (!finalAttempt.ok) {
    return {
      ok: false,
      error: `authenticatedPostTurn: thread_summary_save_failed:${finalAttempt.error ?? "update_failed"}`,
      debug: {
        attempted: true,
        confirmed_thread_summary_present: true,
        confirmed_thread_summary_length: params.confirmedThreadSummary.length,
        ok: false,
        error: `authenticatedPostTurn: thread_summary_save_failed:${finalAttempt.error ?? "update_failed"}`,
        matched_step: null,
        attempts,
      },
    };
  }

  if (finalAttempt.matched) {
    return {
      ok: true,
      error: null,
      debug: {
        attempted: true,
        confirmed_thread_summary_present: true,
        confirmed_thread_summary_length: params.confirmedThreadSummary.length,
        ok: true,
        error: null,
        matched_step: finalAttempt.step,
        attempts,
      },
    };
  }

  return {
    ok: false,
    error: "authenticatedPostTurn: thread_summary_save_target_not_found",
    debug: {
      attempted: true,
      confirmed_thread_summary_present: true,
      confirmed_thread_summary_length: params.confirmedThreadSummary.length,
      ok: false,
      error: "authenticatedPostTurn: thread_summary_save_target_not_found",
      matched_step: null,
      attempts,
    },
  };
}

/*
【このファイルの正式役割】
authenticated postTurn の thread_summary 保存責務だけを持つ。
confirmedThreadSummary を受け取り、conversations.thread_summary へ保存し、
保存結果の debug 情報を作り、必要な場合だけ payload.debug.thread_summary_save へ付与する。
このファイルは thread_summary の保存実行と保存debug付与だけを担当し、
thread_summary の生成、state_changed、state_level、Compass、HOPY回答○、memory、learning、audit、title 解決は再判定しない。

【今回このファイルで修正したこと】
- /app/api/chat/_lib/route/authenticatedPostTurn.ts から分離するため、
  thread_summary 保存・保存debug付与責務を新規ファイルとして作成した。
- createDefaultThreadSummarySaveDebug(...) を移せる形で定義した。
- attachThreadSummarySaveDebugToPayload(...) を移せる形で定義した。
- saveConfirmedThreadSummary(...) と、その内部で使う saveThreadSummaryAttempt(...) を移せる形で定義した。
- HOPY唯一の正、Compass、memory、learning、audit、title 解決、Future Chain には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnThreadSummarySave.ts
*/