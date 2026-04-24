// /app/api/chat/_lib/route/authenticatedPostTurn.ts

import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { insertInterventionLog } from "../db/interventionLog";
import { errorText } from "../infra/text";
import type { Lang } from "../router/simpleRouter";
import { handleMemoryWrite } from "./memoryWrite";
import type { NotificationState } from "../state/notification";
import type { ConfirmedMemoryCandidate } from "./authenticatedHelpers";
import {
  createDefaultMemoryWriteDebug,
  saveConfirmedAssistantLearningEntry,
} from "./authenticatedHelpers";
import {
  buildAuthenticatedResponsePayload,
  buildFinalizedTurnArtifacts,
} from "./authenticatedFinalize";
import { resolveConfirmedCompassArtifacts } from "./authenticatedPostTurnCompass";
import { resolveAuthenticatedPostTurnConfirmedTurn } from "./authenticatedPostTurnConfirmedTurn";
import { resolveAuthenticatedPostTurnFailure } from "./authenticatedPostTurnFailure";
import { attachFutureChainPersistToPayload } from "./authenticatedPostTurnFutureChainPayload";
import { resolveConfirmedMemoryCandidatesWithTimeout } from "./authenticatedPostTurnMemoryCandidates";
import { resolveAuthenticatedPostTurnStateCompassInvariant } from "./authenticatedPostTurnStateCompassInvariant";
import {
  attachThreadSummarySaveDebugToPayload,
  createDefaultThreadSummarySaveDebug,
  saveConfirmedThreadSummary,
} from "./authenticatedPostTurnThreadSummarySave";
import { resolveAuthenticatedPostTurnThreadSummary } from "./authenticatedPostTurnThreadSummaryResolve";
import { saveAuthenticatedPostTurnAudit } from "./authenticatedPostTurnAuditSave";
import { resolveAuthenticatedPostTurnThreadTitle } from "./authenticatedPostTurnThreadTitle";

type RunHopyTurnBuiltResult = Record<string, any>;
type ResolvedPlan = "free" | "plus" | "pro";
type InterventionTone = Parameters<typeof insertInterventionLog>[0]["input_tone"];
type InterventionStrategy =
  Parameters<typeof insertInterventionLog>[0]["selected_strategy"];

type CanonicalAssistantState = {
  current_phase: 1 | 2 | 3 | 4 | 5;
  state_level: 1 | 2 | 3 | 4 | 5;
  prev_phase: 1 | 2 | 3 | 4 | 5;
  prev_state_level: 1 | 2 | 3 | 4 | 5;
  state_changed: boolean;
};

type ConfirmedAssistantTurn = {
  assistantText: string;
  prevPhase: 1 | 2 | 3 | 4 | 5;
  prevStateLevel: 1 | 2 | 3 | 4 | 5;
  currentPhase: 1 | 2 | 3 | 4 | 5;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
  stateChanged: boolean;
  canonicalAssistantState: CanonicalAssistantState;
  compassText?: string;
  compassPrompt?: string;
  threadSummary?: string;
  thread_summary?: string;
  compass?:
    | {
        text: string;
        prompt: string | null;
      }
    | undefined;
};

type MemoryWriteDebug = {
  mem_write_attempted: boolean;
  mem_write_allowed?: boolean | null;
  mem_parse_ok?: boolean | null;
  mem_items_count?: number | null;
  mem_used_heuristic?: boolean | null;
  [key: string]: any;
};

export type AuthenticatedPostTurnParams = {
  runTurnResult: RunHopyTurnBuiltResult | null | undefined;
  resolvedPlan: ResolvedPlan;
  userText: string;
  uiLang: Lang;
  routed: {
    tone: InterventionTone;
    intensity: number;
    lang?: Lang | null;
  };
  openai: OpenAI;
  modelName: string;
  supabase: SupabaseClient;
  internalWriteSupabase: SupabaseClient;
  authedUserId: string;
  resolvedConversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  confirmedTurn: ConfirmedAssistantTurn;
  notification: NotificationState;
  selectedStrategy: InterventionStrategy;
  usedHeuristicConfirmedMemoryCandidates: boolean;
  memoryExtractTimeoutMs: number;
  memoryMinIntervalSec: number;
  debugSave: boolean;
  buildSig: string;
  allowMemoryClean: boolean;
  memoryCleanLimit: number;
  contextLimit: number;
  enforceThreadOwnership: boolean;
  missingThreadReuseWindowSec: number;
  accessToken: string;
  clientRequestIdIn: string;
  memoryInjected: boolean;
  memoryBlock: string;
  effectiveLearningBlockForDebug: string;
  ctxRes: any;
  stateBefore: any;
  st: any;
  stateUpdateOk: boolean;
  stateUpdateError: string | null;
  precheck_not_found: boolean;
  auto_title_ok: boolean | null;
  auto_title_updated: boolean;
  auto_title_reason: string | null;
  auto_title_title: string | null;
  server_created_thread: boolean;
  server_created_thread_title: string | null;
  server_reused_recent_thread: boolean;
  server_reused_recent_thread_title: string | null;
  server_created_client_request_id: string | null;
  cleanTrigger: boolean;
  memory_clean: any;
  openai_ok: boolean | null;
  openai_error: string | null;
  insAsstOk: boolean;
  replyLang: Lang;
  response_generation_log_ok: boolean | null;
  response_generation_log_error: string | null;
  state_transition_signal_ok: boolean | null;
  state_transition_signal_error: string | null;
  userPhraseLearningOutcome: {
    attempted: boolean;
    observationCount: number;
    persistableObservationCount: number;
    insertedObservationCount: number;
    upsertedPatternCount: number;
    reason: string | null;
    error: string | null;
  };
};

export type AuthenticatedPostTurnResult = {
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

function normalizeCompassText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCompassPrompt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function finalizeAuthenticatedPostTurn(
  params: AuthenticatedPostTurnParams,
): Promise<AuthenticatedPostTurnResult> {
  const postTurnFailure = resolveAuthenticatedPostTurnFailure({
    openai_ok: params.openai_ok,
    openai_error: params.openai_error,
    runTurnResult: params.runTurnResult,
  });
  if (postTurnFailure !== null) {
    return {
      payload: {
        ok: false,
        error: postTurnFailure,
      },
      memoryWrite: createDefaultMemoryWriteDebug("not_attempted"),
      confirmedMemoryCandidates: [],
      usedHeuristicConfirmedMemoryCandidates:
        params.usedHeuristicConfirmedMemoryCandidates,
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

  const syncedConfirmedTurn = resolveAuthenticatedPostTurnConfirmedTurn({
    runTurnResult: params.runTurnResult,
    confirmedTurn: params.confirmedTurn,
  });

  const resolvedCompass = resolveConfirmedCompassArtifacts({
    resolvedPlan: params.resolvedPlan,
    runTurnResult: params.runTurnResult,
    confirmedTurn: syncedConfirmedTurn,
  });

  const stateCompassInvariantError =
    resolveAuthenticatedPostTurnStateCompassInvariant({
      resolvedPlan: params.resolvedPlan,
      confirmedTurn: syncedConfirmedTurn,
      resolvedCompass,
    });

  if (stateCompassInvariantError !== null) {
    return {
      payload: {
        ok: false,
        error: stateCompassInvariantError,
      },
      memoryWrite: createDefaultMemoryWriteDebug("not_attempted"),
      confirmedMemoryCandidates: [],
      usedHeuristicConfirmedMemoryCandidates:
        params.usedHeuristicConfirmedMemoryCandidates,
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

  const latestReplyAt = new Date().toISOString();

  const confirmedThreadSummary = resolveAuthenticatedPostTurnThreadSummary({
    runTurnResult: params.runTurnResult,
    confirmedTurn: syncedConfirmedTurn,
    resolvedConversationId: params.resolvedConversationId,
    assistantMessageId: params.assistantMessageId,
    latestReplyAt,
    autoTitleUpdated: params.auto_title_updated,
  });

  let threadSummarySaveDebug = createDefaultThreadSummarySaveDebug({
    confirmedThreadSummary,
  });

  if (confirmedThreadSummary !== null) {
    const threadSummarySave = await saveConfirmedThreadSummary({
      internalWriteSupabase: params.internalWriteSupabase,
      supabase: params.supabase,
      resolvedConversationId: params.resolvedConversationId,
      authedUserId: params.authedUserId,
      confirmedThreadSummary,
    });

    threadSummarySaveDebug = threadSummarySave.debug;

    if (!threadSummarySave.ok) {
      const failurePayload = attachThreadSummarySaveDebugToPayload({
        payload: {
          ok: false,
          error:
            threadSummarySave.error ??
            "authenticatedPostTurn: thread_summary_save_failed:update_failed",
        },
        debugSave: params.debugSave,
        threadSummarySaveDebug,
      });

      return {
        payload: failurePayload,
        memoryWrite: createDefaultMemoryWriteDebug("not_attempted"),
        confirmedMemoryCandidates: [],
        usedHeuristicConfirmedMemoryCandidates:
          params.usedHeuristicConfirmedMemoryCandidates,
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
  }

  const resolvedFinalConfirmedMemories =
    await resolveConfirmedMemoryCandidatesWithTimeout({
      runTurnResult: params.runTurnResult,
      resolvedPlan: params.resolvedPlan,
      userText: params.userText,
      confirmedTurn: syncedConfirmedTurn,
      uiLang: params.uiLang,
      resolvedConversationId: params.resolvedConversationId,
      assistantMessageId: params.assistantMessageId,
      usedHeuristicConfirmedMemoryCandidates:
        params.usedHeuristicConfirmedMemoryCandidates,
      timeoutMs: params.memoryExtractTimeoutMs,
    });

  let confirmedMemoryCandidates =
    resolvedFinalConfirmedMemories.confirmedMemoryCandidates;
  const usedHeuristicConfirmedMemoryCandidates =
    params.usedHeuristicConfirmedMemoryCandidates ||
    resolvedFinalConfirmedMemories.usedHeuristicConfirmedMemoryCandidates;

  let memoryWrite: MemoryWriteDebug =
    createDefaultMemoryWriteDebug("not_attempted");

  let learning_save_attempted: boolean | null = null;
  let learning_save_inserted: number | null = null;
  let learning_save_reason: string | null = null;
  let learning_save_error: string | null = null;

  const learningSavePromise = saveConfirmedAssistantLearningEntry({
    supabase: params.internalWriteSupabase,
    authedUserId: params.authedUserId,
    resolvedConversationId: params.resolvedConversationId,
    userMessageId: params.userMessageId,
    assistantMessageId: params.assistantMessageId,
    userText: params.userText,
    confirmedTurn: syncedConfirmedTurn,
    uiLang: params.uiLang,
  });

  let mem_write_ok: boolean | null = null;
  let mem_write_error: string | null = null;

  try {
    if (confirmedMemoryCandidates.length <= 0) {
      memoryWrite = {
        ...createDefaultMemoryWriteDebug("no_confirmed_memory_candidates"),
        mem_write_attempted: true,
        mem_write_allowed: true,
        mem_parse_ok: true,
        mem_items_count: 0,
        mem_used_heuristic: usedHeuristicConfirmedMemoryCandidates,
      };
      mem_write_ok = true;
    } else {
      memoryWrite = await handleMemoryWrite({
        openai: params.openai,
        modelName: params.modelName,
        memoryExtractTimeoutMs: params.memoryExtractTimeoutMs,
        memoryMinIntervalSec: params.memoryMinIntervalSec,
        debugSave: params.debugSave,
        supabase: params.supabase,
        userId: params.authedUserId,
        sourceMessageId: params.assistantMessageId,
        sourceThreadId: params.resolvedConversationId,
        uiLang: params.uiLang,
        userText: "",
        assistantText: "",
        routedTone: params.routed.tone,
        routedIntensity: params.routed.intensity,
        usedHeuristicConfirmedMemoryCandidates,
        stateLevel: syncedConfirmedTurn.currentStateLevel,
        currentPhase: syncedConfirmedTurn.currentPhase,
        stateChanged: syncedConfirmedTurn.stateChanged,
        confirmedMemoryCandidates,
      });
      memoryWrite = {
        ...memoryWrite,
        mem_used_heuristic:
          usedHeuristicConfirmedMemoryCandidates ||
          memoryWrite.mem_used_heuristic,
      };
      mem_write_ok = true;
    }
  } catch (e: any) {
    mem_write_ok = false;
    mem_write_error = String(e?.message ?? e);
    memoryWrite = {
      ...createDefaultMemoryWriteDebug("exception"),
      mem_write_attempted: true,
      mem_used_heuristic: usedHeuristicConfirmedMemoryCandidates,
    };
  }

  try {
    const learningSave = await learningSavePromise;
    learning_save_attempted = learningSave.attempted;
    learning_save_inserted = learningSave.inserted;
    learning_save_reason = learningSave.reason;
    learning_save_error = learningSave.error;
  } catch (e: any) {
    learning_save_attempted = true;
    learning_save_inserted = 0;
    learning_save_reason = "exception";
    learning_save_error = errorText(e) || String(e?.message ?? e);
  }

  const auditSave = await saveAuthenticatedPostTurnAudit({
    supabase: params.supabase,
    authedUserId: params.authedUserId,
    resolvedConversationId: params.resolvedConversationId,
    userText: params.userText,
    uiLang: params.uiLang,
    routed: params.routed,
    selectedStrategy: params.selectedStrategy,
    modelName: params.modelName,
    buildSig: params.buildSig,
    confirmedTurn: syncedConfirmedTurn,
    stateBefore: params.stateBefore,
    st: params.st,
  });

  const audit_ok = auditSave.audit_ok;
  const audit_error = auditSave.audit_error;

  const threadTitleForPayload = await resolveAuthenticatedPostTurnThreadTitle({
    supabase: params.supabase,
    uiLang: params.uiLang,
    resolvedConversationId: params.resolvedConversationId,
    server_created_thread: params.server_created_thread,
    server_created_thread_title: params.server_created_thread_title,
    server_reused_recent_thread: params.server_reused_recent_thread,
    server_reused_recent_thread_title:
      params.server_reused_recent_thread_title,
    auto_title_updated: params.auto_title_updated,
    auto_title_title: params.auto_title_title,
  });

  const confirmedTurnWithCompass = {
    ...syncedConfirmedTurn,
    compassText: normalizeCompassText(resolvedCompass.compassText) ?? undefined,
    compassPrompt:
      normalizeCompassPrompt(resolvedCompass.compassPrompt) ?? undefined,
    compass:
      normalizeCompassText(resolvedCompass.compassText) !== null
        ? {
            text: normalizeCompassText(resolvedCompass.compassText)!,
            prompt: normalizeCompassPrompt(resolvedCompass.compassPrompt),
          }
        : undefined,
    canonicalAssistantState: {
      ...syncedConfirmedTurn.canonicalAssistantState,
      state_changed: syncedConfirmedTurn.stateChanged,
    },
  } as ConfirmedAssistantTurn;

  const finalizedTurnArtifacts = buildFinalizedTurnArtifacts({
    confirmedTurn: confirmedTurnWithCompass,
    notification: params.notification,
    resolvedConversationId: params.resolvedConversationId,
    assistantMessageId: params.assistantMessageId,
    latestReplyAt,
    autoTitleUpdated: params.auto_title_updated,
    memoryWrite,
    confirmedMemoryCandidates,
    compassText: normalizeCompassText(resolvedCompass.compassText),
    compassPrompt: normalizeCompassPrompt(resolvedCompass.compassPrompt),
  });

  const payload = buildAuthenticatedResponsePayload({
    finalizedTurnArtifacts,
    resolvedConversationId: params.resolvedConversationId,
    threadTitleForPayload,
    stateUpdateOk: params.stateUpdateOk,
    stateUpdateError: params.stateUpdateError,
    debugSave: params.debugSave,
    server_created_thread: params.server_created_thread,
    server_created_client_request_id: params.server_created_client_request_id,
    cleanTrigger: params.cleanTrigger,
    memory_clean: params.memory_clean,
  });

  const payloadWithFutureChainPersist = attachFutureChainPersistToPayload({
    payload,
    runTurnResult: params.runTurnResult,
  });

  const payloadWithThreadSummaryDebug = attachThreadSummarySaveDebugToPayload({
    payload: payloadWithFutureChainPersist,
    debugSave: params.debugSave,
    threadSummarySaveDebug,
  });

  return {
    payload: payloadWithThreadSummaryDebug,
    memoryWrite,
    confirmedMemoryCandidates,
    usedHeuristicConfirmedMemoryCandidates,
    learning_save_attempted,
    learning_save_inserted,
    learning_save_reason,
    learning_save_error,
    mem_write_ok,
    mem_write_error,
    audit_ok,
    audit_error,
  };
}

/*
【このファイルの正式役割】
authenticated 経路の postTurn 最終化ファイル。
runTurnResult と confirmedTurn を受け取り、
memory 書き込み、learning 保存、audit 保存、thread title 解決、
Compass を含む最終 turn artifacts 作成、
最終 payload 作成までを接続する。
この層は state_changed を再計算せず、
受け取った唯一の正と Compass の整合だけを検証する。

Future Chain 保存結果の payload 中継責務は
authenticatedPostTurnFutureChainPayload.ts に分離し、
thread_summary 保存・保存debug付与責務は
authenticatedPostTurnThreadSummarySave.ts に分離し、
thread_summary 解決責務は
authenticatedPostTurnThreadSummaryResolve.ts に分離し、
audit 保存責務は authenticatedPostTurnAuditSave.ts に分離し、
thread title 解決責務は authenticatedPostTurnThreadTitle.ts に分離し、
confirmed memory candidates 解決責務は
authenticatedPostTurnMemoryCandidates.ts に分離し、
postTurn failure 判定責務は
authenticatedPostTurnFailure.ts に分離し、
state_changed と Compass の整合検証責務は
authenticatedPostTurnStateCompassInvariant.ts に分離し、
confirmedTurn 同期責務は
authenticatedPostTurnConfirmedTurn.ts に分離し、
このファイルでは分離先関数を呼び出すだけにする。

【今回このファイルで修正したこと】
- confirmedTurn 同期責務を
  /app/api/chat/_lib/route/authenticatedPostTurnConfirmedTurn.ts へ分離接続した。
- resolveAuthenticatedPostTurnConfirmedTurn の import を追加した。
- asRecord(...)、
  normalizeStateLevel(...)、
  normalizeBoolean(...)、
  normalizeNonEmptyString(...)、
  normalizeThreadSummary(...)、
  resolveConfirmedTurnFromRunTurnResult(...) の本体を親ファイルから削除した。
- finalizeAuthenticatedPostTurn(...) 内では、
  resolveAuthenticatedPostTurnConfirmedTurn(...) を呼び出すだけにした。
- normalizeCompassText(...) と normalizeCompassPrompt(...) は
  confirmedTurnWithCompass 作成と finalizedTurnArtifacts 作成でまだ使用されているため、
  この親ファイルに残した。
- state_changed の唯一の正、Compass 生成、HOPY回答○、memory 書き込み実行、
  learning、thread_summary、audit、thread title、Future Chain、payload 生成本体には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurn.ts
*/