// /app/api/chat/_lib/route/authenticatedPostTurn.ts

import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { insertInterventionLog } from "../db/interventionLog";
import { errorText } from "../infra/text";
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
import { attachFutureChainPersistToPayload } from "./authenticatedPostTurnFutureChainPayload";
import {
  attachThreadSummarySaveDebugToPayload,
  createDefaultThreadSummarySaveDebug,
  saveConfirmedThreadSummary,
} from "./authenticatedPostTurnThreadSummarySave";
import { saveAuthenticatedPostTurnAudit } from "./authenticatedPostTurnAuditSave";

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

function normalizeStateLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    if (rounded === 1) return 1;
    if (rounded === 2) return 2;
    if (rounded === 3) return 3;
    if (rounded === 4) return 4;
    if (rounded === 5) return 5;
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return normalizeStateLevel(numeric);
    }

    const lowered = trimmed.toLowerCase();
    if (trimmed === "混線" || lowered === "mixed") return 1;
    if (trimmed === "模索" || lowered === "seeking") return 2;
    if (trimmed === "整理" || lowered === "organizing") return 3;
    if (trimmed === "収束" || lowered === "converging") return 4;
    if (trimmed === "決定" || lowered === "deciding") return 5;
  }

  return null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
  }

  return null;
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeThreadSummary(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (value && typeof value === "object") {
    try {
      const serialized = JSON.stringify(value);
      if (typeof serialized !== "string") return null;

      const normalized = serialized.trim();
      return normalized.length > 0 ? normalized : null;
    } catch {
      return null;
    }
  }

  return null;
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

function buildCanonicalThreadSummaryRecord(params: {
  resolvedConversationId: string;
  assistantMessageId: string;
  latestReplyAt: string;
  confirmedTurn: ConfirmedAssistantTurn;
  autoTitleUpdated: boolean;
}): Record<string, unknown> {
  return {
    thread_id: params.resolvedConversationId,
    latest_reply_id: params.assistantMessageId,
    latest_reply_at: params.latestReplyAt,
    latest_confirmed_state: {
      state_level: params.confirmedTurn.currentStateLevel,
      current_phase: params.confirmedTurn.currentPhase,
      prev_state_level: params.confirmedTurn.prevStateLevel,
      prev_phase: params.confirmedTurn.prevPhase,
      state_changed: params.confirmedTurn.stateChanged,
    },
    title_candidate_updated: params.autoTitleUpdated,
  };
}

function resolveConfirmedThreadSummary(params: {
  runTurnResult: RunHopyTurnBuiltResult | null | undefined;
  confirmedTurn: ConfirmedAssistantTurn;
  resolvedConversationId: string;
  assistantMessageId: string;
  latestReplyAt: string;
  autoTitleUpdated: boolean;
}): string | null {
  const confirmedTurnSummary = normalizeThreadSummary(
    params.confirmedTurn.threadSummary ?? params.confirmedTurn.thread_summary,
  );
  if (confirmedTurnSummary !== null) {
    return confirmedTurnSummary;
  }

  const resultRecord = asRecord(params.runTurnResult ?? null);
  const confirmedPayload = asRecord(resultRecord?.hopy_confirmed_payload);

  const confirmedPayloadSummary = normalizeThreadSummary(
    confirmedPayload?.thread_summary ?? confirmedPayload?.threadSummary,
  );
  if (confirmedPayloadSummary !== null) {
    return confirmedPayloadSummary;
  }

  return normalizeThreadSummary(
    buildCanonicalThreadSummaryRecord({
      resolvedConversationId: params.resolvedConversationId,
      assistantMessageId: params.assistantMessageId,
      latestReplyAt: params.latestReplyAt,
      confirmedTurn: params.confirmedTurn,
      autoTitleUpdated: params.autoTitleUpdated,
    }),
  );
}

function resolveConfirmedTurnFromRunTurnResult(params: {
  runTurnResult: RunHopyTurnBuiltResult | null | undefined;
  confirmedTurn: ConfirmedAssistantTurn;
}): ConfirmedAssistantTurn {
  const resultRecord = asRecord(params.runTurnResult ?? null);
  const confirmedPayload = asRecord(resultRecord?.hopy_confirmed_payload);
  const confirmedState = asRecord(confirmedPayload?.state);
  const confirmedCompass = asRecord(confirmedPayload?.compass);

  const assistantText =
    normalizeNonEmptyString(confirmedPayload?.reply) ??
    params.confirmedTurn.assistantText;

  const prevPhase =
    normalizeStateLevel(
      confirmedState?.prev_phase ?? confirmedState?.prev_state_level,
    ) ?? params.confirmedTurn.prevPhase;

  const prevStateLevel =
    normalizeStateLevel(
      confirmedState?.prev_state_level ?? confirmedState?.prev_phase,
    ) ?? params.confirmedTurn.prevStateLevel;

  const currentPhase =
    normalizeStateLevel(
      confirmedState?.current_phase ?? confirmedState?.state_level,
    ) ?? params.confirmedTurn.currentPhase;

  const currentStateLevel =
    normalizeStateLevel(
      confirmedState?.state_level ?? confirmedState?.current_phase,
    ) ?? params.confirmedTurn.currentStateLevel;

  const stateChanged =
    normalizeBoolean(confirmedState?.state_changed) ??
    params.confirmedTurn.stateChanged;

  const compassText =
    normalizeCompassText(confirmedCompass?.text) ??
    normalizeCompassText(params.confirmedTurn.compassText) ??
    null;

  const compassPrompt =
    normalizeCompassPrompt(confirmedCompass?.prompt) ??
    normalizeCompassPrompt(params.confirmedTurn.compassPrompt) ??
    null;

  const threadSummary =
    normalizeThreadSummary(
      confirmedPayload?.thread_summary ?? confirmedPayload?.threadSummary,
    ) ??
    normalizeThreadSummary(
      params.confirmedTurn.threadSummary ?? params.confirmedTurn.thread_summary,
    ) ??
    null;

  return {
    ...params.confirmedTurn,
    assistantText,
    prevPhase,
    prevStateLevel,
    currentPhase,
    currentStateLevel,
    stateChanged,
    canonicalAssistantState: {
      current_phase: currentPhase,
      state_level: currentStateLevel,
      prev_phase: prevPhase,
      prev_state_level: prevStateLevel,
      state_changed: stateChanged,
    },
    compassText: compassText ?? undefined,
    compassPrompt: compassPrompt ?? undefined,
    threadSummary: threadSummary ?? undefined,
    thread_summary: threadSummary ?? undefined,
    compass:
      compassText !== null
        ? {
            text: compassText,
            prompt: compassPrompt,
          }
        : undefined,
  };
}

function resolvePostTurnStateCompassInvariant(params: {
  resolvedPlan: ResolvedPlan;
  confirmedTurn: ConfirmedAssistantTurn;
  resolvedCompass: {
    compassText: string | null;
    compassPrompt: string | null;
  };
}): string | null {
  const stateChanged = params.confirmedTurn.stateChanged === true;
  const compassText = normalizeCompassText(params.resolvedCompass.compassText);
  const isPaidPlan =
    params.resolvedPlan === "plus" || params.resolvedPlan === "pro";

  if (!stateChanged && compassText !== null) {
    return "authenticatedPostTurn: compass_present_while_state_changed_false";
  }

  if (stateChanged && isPaidPlan && compassText === null) {
    return "authenticatedPostTurn: plus_pro_requires_compass_when_state_changed_true";
  }

  return null;
}

function toConfirmedMemoryCandidates(
  value: unknown,
): ConfirmedMemoryCandidate[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const record = item as Record<string, unknown>;
    const content =
      typeof record.content === "string"
        ? record.content.trim()
        : typeof record.body === "string"
          ? record.body.trim()
          : "";
    return content.length > 0;
  }) as ConfirmedMemoryCandidate[];
}

function resolveBuiltResultConfirmedMemoryCandidates(
  runTurnResult: RunHopyTurnBuiltResult | null | undefined,
): ConfirmedMemoryCandidate[] {
  const topLevelConfirmed = toConfirmedMemoryCandidates(
    runTurnResult?.confirmed_memory_candidates,
  );
  if (topLevelConfirmed.length > 0) {
    return topLevelConfirmed;
  }

  const topLevelMemory = toConfirmedMemoryCandidates(
    runTurnResult?.memory_candidates,
  );
  if (topLevelMemory.length > 0) {
    return topLevelMemory;
  }

  const confirmedPayload = asRecord(runTurnResult?.hopy_confirmed_payload);
  if (!confirmedPayload) {
    return [];
  }

  const payloadConfirmed = toConfirmedMemoryCandidates(
    confirmedPayload.confirmed_memory_candidates,
  );
  if (payloadConfirmed.length > 0) {
    return payloadConfirmed;
  }

  const payloadMemory = toConfirmedMemoryCandidates(
    confirmedPayload.memory_candidates,
  );
  if (payloadMemory.length > 0) {
    return payloadMemory;
  }

  return [];
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
  const builtResultConfirmedMemoryCandidates =
    resolveBuiltResultConfirmedMemoryCandidates(params.runTurnResult);

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

  const syncedConfirmedTurn = resolveConfirmedTurnFromRunTurnResult({
    runTurnResult: params.runTurnResult,
    confirmedTurn: params.confirmedTurn,
  });

  const resolvedCompass = resolveConfirmedCompassArtifacts({
    resolvedPlan: params.resolvedPlan,
    runTurnResult: params.runTurnResult,
    confirmedTurn: syncedConfirmedTurn,
  });

  const stateCompassInvariantError = resolvePostTurnStateCompassInvariant({
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

  const confirmedThreadSummary = resolveConfirmedThreadSummary({
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
最終 payload 作成までを行う。
この層は state_changed を再計算せず、
受け取った唯一の正と Compass の整合だけを検証する。
Future Chain 保存結果の payload 中継責務は
authenticatedPostTurnFutureChainPayload.ts に分離し、
thread_summary 保存・保存debug付与責務は
authenticatedPostTurnThreadSummarySave.ts に分離し、
audit 保存責務は authenticatedPostTurnAuditSave.ts に分離し、
このファイルでは分離先関数を呼び出すだけにする。

【今回このファイルで修正したこと】
- audit 保存責務を
  /app/api/chat/_lib/route/authenticatedPostTurnAuditSave.ts へ分離した。
- insertInterventionLog の値 import を type import に変更した。
- systemCoreDigest / systemCorePrompt の import を削除した。
- insertInterventionLog(...) の try/catch と audit_ok / audit_error 整形本体を親ファイルから削除した。
- 親ファイルでは saveAuthenticatedPostTurnAudit(...) を import して呼び出すだけにした。
- state_changed の唯一の正、Compass 条件、memory、learning、thread_summary、title 解決、
  Future Chain 保存結果の payload 中継には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurn.ts
*/