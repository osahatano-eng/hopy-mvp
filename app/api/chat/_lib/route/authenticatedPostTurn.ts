// /app/api/chat/_lib/route/authenticatedPostTurn.ts

import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { insertInterventionLog } from "../db/interventionLog";
import { errorText } from "../infra/text";
import { systemCoreDigest, systemCorePrompt } from "../system/system";
import type { Lang } from "../router/simpleRouter";
import { resolveThreadTitleForPayload } from "./threadTitle";
import { handleMemoryWrite } from "./memoryWrite";
import type { NotificationState } from "../state/notification";
import type { ConfirmedMemoryCandidate } from "./authenticatedHelpers";
import {
  createDefaultMemoryWriteDebug,
  saveConfirmedAssistantLearningEntry,
} from "./authenticatedHelpers";
import { resolveFinalConfirmedMemoryCandidates } from "./authenticatedMemoryCandidates";
import {
  buildAuthenticatedResponsePayload,
  buildFinalizedTurnArtifacts,
} from "./authenticatedFinalize";
import { resolveConfirmedCompassArtifacts } from "./authenticatedPostTurnCompass";

type RunHopyTurnBuiltResult = Record<string, any>;
type ResolvedPlan = "free" | "plus" | "pro";
type InterventionTone = Parameters<typeof insertInterventionLog>[0]["input_tone"];

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
  selectedStrategy: string;
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

function getFallbackThreadTitleForPayload(params: {
  auto_title_updated: boolean;
  auto_title_title: string | null;
  server_reused_recent_thread: boolean;
  server_reused_recent_thread_title: string | null;
  server_created_thread: boolean;
  server_created_thread_title: string | null;
  uiLang: Lang;
}): string {
  if (params.auto_title_updated && params.auto_title_title) {
    return params.auto_title_title;
  }

  if (
    params.server_reused_recent_thread &&
    params.server_reused_recent_thread_title
  ) {
    return params.server_reused_recent_thread_title;
  }

  if (params.server_created_thread && params.server_created_thread_title) {
    return params.server_created_thread_title;
  }

  return params.uiLang === "ja" ? "新規チャット" : "New chat";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function resolvePostTurnFailure(
  params: AuthenticatedPostTurnParams,
): string | null {
  if (params.openai_ok !== true) {
    const resolvedError = String(params.openai_error ?? "").trim();
    return resolvedError || "authenticatedPostTurn: upstream model failure";
  }

  const resultRecord = asRecord(params.runTurnResult ?? null);
  if (!resultRecord) {
    return "authenticatedPostTurn: runTurnResult is required";
  }

  const confirmedPayload = asRecord(resultRecord.hopy_confirmed_payload);
  if (!confirmedPayload) {
    return "authenticatedPostTurn: runTurnResult.hopy_confirmed_payload is required";
  }

  const confirmedState = asRecord(confirmedPayload.state);
  if (!confirmedState) {
    return "authenticatedPostTurn: runTurnResult.hopy_confirmed_payload.state is required";
  }

  const confirmedReply =
    typeof confirmedPayload.reply === "string"
      ? confirmedPayload.reply.trim()
      : "";
  if (!confirmedReply) {
    return "authenticatedPostTurn: runTurnResult.hopy_confirmed_payload.reply is required";
  }

  return null;
}

async function resolveConfirmedMemoryCandidatesWithTimeout(params: {
  runTurnResult: RunHopyTurnBuiltResult | null | undefined;
  resolvedPlan: ResolvedPlan;
  userText: string;
  confirmedTurn: ConfirmedAssistantTurn;
  uiLang: Lang;
  resolvedConversationId: string;
  assistantMessageId: string;
  usedHeuristicConfirmedMemoryCandidates: boolean;
  timeoutMs: number;
}): Promise<{
  confirmedMemoryCandidates: ConfirmedMemoryCandidate[];
  usedHeuristicConfirmedMemoryCandidates: boolean;
}> {
  const builtResultConfirmedMemoryCandidates = Array.isArray(
    params.runTurnResult?.confirmed_memory_candidates,
  )
    ? (params.runTurnResult
        ?.confirmed_memory_candidates as ConfirmedMemoryCandidate[])
    : [];

  if (builtResultConfirmedMemoryCandidates.length > 0) {
    return {
      confirmedMemoryCandidates: builtResultConfirmedMemoryCandidates,
      usedHeuristicConfirmedMemoryCandidates:
        params.usedHeuristicConfirmedMemoryCandidates,
    };
  }

  const safeTimeoutMs =
    Number.isFinite(params.timeoutMs) && params.timeoutMs > 0
      ? Math.floor(params.timeoutMs)
      : 1500;

  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const resolved = await Promise.race([
      resolveFinalConfirmedMemoryCandidates({
        result: params.runTurnResult,
        resolvedPlan: params.resolvedPlan,
        userText: params.userText,
        confirmedTurn: params.confirmedTurn,
        uiLang: params.uiLang,
        resolvedConversationId: params.resolvedConversationId,
        assistantMessageId: params.assistantMessageId,
      }),
      new Promise<{
        confirmedMemoryCandidates: ConfirmedMemoryCandidate[];
        usedHeuristicConfirmedMemoryCandidates: boolean;
      }>((resolve) => {
        timer = setTimeout(() => {
          resolve({
            confirmedMemoryCandidates: [],
            usedHeuristicConfirmedMemoryCandidates:
              params.usedHeuristicConfirmedMemoryCandidates,
          });
        }, safeTimeoutMs);
      }),
    ]);

    return resolved;
  } catch {
    return {
      confirmedMemoryCandidates: [],
      usedHeuristicConfirmedMemoryCandidates:
        params.usedHeuristicConfirmedMemoryCandidates,
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function finalizeAuthenticatedPostTurn(
  params: AuthenticatedPostTurnParams,
): Promise<AuthenticatedPostTurnResult> {
  const postTurnFailure = resolvePostTurnFailure(params);
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

  const resolvedFinalConfirmedMemories =
    await resolveConfirmedMemoryCandidatesWithTimeout({
      runTurnResult: params.runTurnResult,
      resolvedPlan: params.resolvedPlan,
      userText: params.userText,
      confirmedTurn: params.confirmedTurn,
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
    confirmedTurn: params.confirmedTurn,
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
        stateLevel: params.confirmedTurn.currentStateLevel,
        currentPhase: params.confirmedTurn.currentPhase,
        stateChanged: params.confirmedTurn.stateChanged,
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

  let audit_ok: boolean | null = null;
  let audit_error: string | null = null;

  try {
    const turn_key = `${params.resolvedConversationId}:${Date.now()}`;

    const res = await insertInterventionLog({
      supabase: params.supabase,
      user_id: params.authedUserId,
      thread_id: params.resolvedConversationId,
      turn_key,
      user_input: params.userText,
      input_lang: params.uiLang,
      input_tone: params.routed.tone,
      input_intensity: params.routed.intensity,
      selected_strategy: params.selectedStrategy,
      style_id: 1,
      hopy_output: params.confirmedTurn.assistantText,
      avoid_phrases: [],
      model: params.modelName,
      system_digest: params.buildSig,
      system_core_digest: systemCoreDigest(),
      build_sig: params.buildSig,
      system_core_prompt: systemCorePrompt,
      phase_before: params.confirmedTurn.prevPhase,
      phase_after: params.confirmedTurn.currentPhase,
      score_before: params.stateBefore?.stability_score ?? 0,
      score_after:
        params.st?.applied?.nextScore ?? params.stateBefore?.stability_score ?? 0,
    });

    audit_ok = res.ok;
    if (!res.ok) {
      audit_error = errorText((res as any)?.error) || "insert_failed";
    }
  } catch (e: any) {
    audit_ok = false;
    audit_error = errorText(e) || String(e?.message ?? e);
  }

  const fallbackThreadTitleForPayload = getFallbackThreadTitleForPayload({
    auto_title_updated: params.auto_title_updated,
    auto_title_title: params.auto_title_title,
    server_reused_recent_thread: params.server_reused_recent_thread,
    server_reused_recent_thread_title:
      params.server_reused_recent_thread_title,
    server_created_thread: params.server_created_thread,
    server_created_thread_title: params.server_created_thread_title,
    uiLang: params.uiLang,
  });

  let threadTitleForPayload = fallbackThreadTitleForPayload;

  try {
    const resolvedTitle = await resolveThreadTitleForPayload({
      supabase: params.supabase,
      uiLang: params.uiLang,
      conversationId: params.resolvedConversationId,
      server_created_thread: params.server_created_thread,
      server_created_thread_title: params.server_created_thread_title,
      server_reused_recent_thread: params.server_reused_recent_thread,
      server_reused_recent_thread_title:
        params.server_reused_recent_thread_title,
      auto_title_updated: params.auto_title_updated,
      auto_title_title: params.auto_title_title,
    });
    threadTitleForPayload =
      String(resolvedTitle ?? "").trim() || fallbackThreadTitleForPayload;
  } catch {}

  const resolvedCompass = resolveConfirmedCompassArtifacts({
    resolvedPlan: params.resolvedPlan,
    runTurnResult: params.runTurnResult,
    confirmedTurn: params.confirmedTurn,
  });

  const confirmedTurnWithCompass = {
    ...params.confirmedTurn,
    stateChanged: resolvedCompass.stateChanged,
    compassText: resolvedCompass.compassText ?? undefined,
    compassPrompt: resolvedCompass.compassPrompt ?? undefined,
    compass:
      resolvedCompass.compassText !== null
        ? {
            text: resolvedCompass.compassText,
            prompt: resolvedCompass.compassPrompt,
          }
        : undefined,
  } as ConfirmedAssistantTurn;

  const finalizedTurnArtifacts = buildFinalizedTurnArtifacts({
    confirmedTurn: confirmedTurnWithCompass,
    notification: params.notification,
    resolvedConversationId: params.resolvedConversationId,
    assistantMessageId: params.assistantMessageId,
    latestReplyAt: new Date().toISOString(),
    autoTitleUpdated: params.auto_title_updated,
    memoryWrite,
    confirmedMemoryCandidates,
    compassText: resolvedCompass.compassText,
    compassPrompt: resolvedCompass.compassPrompt,
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

  return {
    payload,
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
このファイルの正式役割
authenticated 経路の postTurn 最終化ファイル。
runTurnResult と confirmedTurn を受け取り、
memory 書き込み、learning 保存、audit 保存、thread title 解決、
Compass を含む最終 turn artifacts 作成、
最終 payload 作成までを行う。
*/

/*
【今回このファイルで修正したこと】
- routed.tone の型を広い string のまま持たず、insertInterventionLog 側の input_tone 型へ合わせました。
- input_tone: params.routed.tone で Tone5 不一致になっていた build error だけを対象に修正しました。
- 実行時の値や tone の判定ロジックは変えず、このファイル内の型の受け口だけをそろえました。
- postTurn の実行ロジック、memory / Compass / payload / 状態 1..5 の流れには触っていません。
*/