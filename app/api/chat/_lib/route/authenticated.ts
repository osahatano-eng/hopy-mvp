// /app/api/chat/_lib/route/authenticated.ts

import OpenAI from "openai";
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import {
  createInitialNotificationState,
  type NotificationState,
} from "../state/notification";
import { loadRecentConversationMessages } from "../context/loadRecentConversationMessages";
import { isTrueBoolean } from "./requestBody";
import {
  buildPromptBundle,
  type PromptBundle,
} from "./promptBundle";
import { attachDebugPayload } from "./debugPayload";
import { handleMemoryClean } from "./memoryClean";
import { systemCorePrompt } from "../system/system";
import type { Lang } from "../router/simpleRouter";
import { errorText } from "../infra/text";
import { resolveAuthThread } from "./authThread";
import { resolveConversationState } from "./authState";
import { runHopyTurn } from "./runHopyTurn";
import {
  extractLearningBlockFromBaseSystemPrompt,
  loadLearningBlock,
  loadLearningPromptContext,
  runAutoRename,
  saveUserMessageOrError,
  saveUserPhraseLearning,
  type UserPhraseLearningOutcome,
} from "./authenticatedHelpers";
import {
  getPromptMemoryLimitByPlan,
  resolvePromptBundlePlanFromProfiles,
  resolvePromptMemoryLoad,
  shouldLoadLearningForPlan,
  type PromptMemoryLoadResult,
} from "./authenticatedPlan";
import {
  createAuthenticatedTurnDeps,
  resolveConfirmedTurnFromBuiltResult,
  type ConfirmedStateFallback,
} from "./authenticatedTurnDeps";
import { finalizeAuthenticatedPostTurn } from "./authenticatedPostTurn";

type RoutedTone =
  Parameters<typeof finalizeAuthenticatedPostTurn>[0]["routed"]["tone"];

type HandleAuthenticatedChatParams = {
  openai: OpenAI;
  modelName: string;
  supabase: SupabaseClient;
  accessToken: string;
  authedUserId: string;
  body: any;
  userText: string;
  uiLang: Lang;
  replyLang: Lang;
  routed: {
    tone: RoutedTone;
    intensity: number;
    lang?: Lang | null;
  };
  selectedStrategy: string;
  buildSig: string;
  debugSave: boolean;
  openaiTimeoutMs: number;
  memoryExtractTimeoutMs: number;
  memoryMinIntervalSec: number;
  allowMemoryClean: boolean;
  memoryCleanLimit: number;
  contextLimit: number;
  enforceThreadOwnership: boolean;
  missingThreadReuseWindowSec: number;
  clientRequestIdIn: string;
  requestedConversationId: string;
};

let internalWriteSupabaseSingleton: SupabaseClient | null = null;

function nowMs(): number {
  return Date.now();
}

function elapsedMs(startMs: number): number {
  return Math.max(0, nowMs() - startMs);
}

function getInternalWriteSupabase(fallback: SupabaseClient): SupabaseClient {
  if (internalWriteSupabaseSingleton) return internalWriteSupabaseSingleton;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return fallback;
  }

  internalWriteSupabaseSingleton = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return internalWriteSupabaseSingleton;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function handleAuthenticatedChat(
  params: HandleAuthenticatedChatParams,
): Promise<{ status: number; payload: any }> {
  const totalStartMs = nowMs();

  const {
    openai,
    modelName,
    supabase,
    accessToken,
    authedUserId,
    body,
    userText,
    uiLang,
    replyLang,
    routed,
    selectedStrategy,
    buildSig,
    debugSave,
    openaiTimeoutMs,
    memoryExtractTimeoutMs,
    memoryMinIntervalSec,
    allowMemoryClean,
    memoryCleanLimit,
    contextLimit,
    enforceThreadOwnership,
    missingThreadReuseWindowSec,
    clientRequestIdIn,
    requestedConversationId,
  } = params;

  const internalWriteSupabase = getInternalWriteSupabase(supabase);

  const threadRes = await resolveAuthThread({
    supabase,
    authedUserId,
    uiLang,
    requestedConversationId,
    clientRequestIdIn,
    missingThreadReuseWindowSec,
    debugSave,
    enforceThreadOwnership,
  });
  if (!threadRes.ok) {
    return {
      status: threadRes.status,
      payload: threadRes.payload,
    };
  }

  const { threadResolution, resolvedConversationId, precheck_not_found } =
    threadRes;
  const {
    server_created_thread,
    server_created_thread_title,
    server_created_client_request_id,
    server_reused_recent_thread,
    server_reused_recent_thread_title,
  } = threadResolution;

  const resolvedPlan = await resolvePromptBundlePlanFromProfiles({
    supabase,
    userId: authedUserId,
  });

  const clientMemoryBlock = String(body?.memory_block ?? "").trim();
  const cleanTrigger = isTrueBoolean(body?.clean_memories);

  const memory_clean = await handleMemoryClean({
    supabase,
    userId: authedUserId,
    uiLang,
    cleanTrigger,
    allowMemoryClean,
    memoryCleanLimit,
  });

  const stateRes = await resolveConversationState({
    supabase,
    authedUserId,
    resolvedConversationId,
    uiLang,
    userText,
  });

  const {
    stateBefore,
    st,
    stateUpdateOk,
    stateUpdateError,
    prevPhase,
    prevStateLevel,
    currentPhase,
    currentStateLevel,
    stateChanged,
    normalizedStateForPayload,
  } = stateRes;

  const confirmedStateFallback: ConfirmedStateFallback = {
    currentPhase,
    currentStateLevel,
    prevPhase,
    prevStateLevel,
  };

  const promptMemoryLoad: PromptMemoryLoadResult =
    resolvedPlan === "free"
      ? {
          memoryBlock: "",
          memoryInjected: false,
        }
      : await resolvePromptMemoryLoad({
          supabase,
          userId: authedUserId,
          uiLang,
          currentStateLevel,
          clientMemoryBlock,
          limit: getPromptMemoryLimitByPlan(resolvedPlan),
        });

  const memoryBlock = promptMemoryLoad.memoryBlock;
  const memoryInjected = promptMemoryLoad.memoryInjected;
  const shouldLoadLearning = shouldLoadLearningForPlan(resolvedPlan);

  const [learningPromptContext, learningBlock] = shouldLoadLearning
    ? await Promise.all([
        loadLearningPromptContext({
          supabase: internalWriteSupabase,
          userId: authedUserId,
          currentStateLevel,
        }),
        loadLearningBlock({
          supabase: internalWriteSupabase,
          userId: authedUserId,
          currentStateLevel,
        }),
      ])
    : [null, ""];

  const contextLoadStartMs = nowMs();
  const ctxRes = await loadRecentConversationMessages({
    supabase,
    conversationId: resolvedConversationId,
    limit: contextLimit,
  });
  const context_load_ms = elapsedMs(contextLoadStartMs);

  const resolvedCtxRes = {
    ok: ctxRes.ok,
    items: ctxRes.ok ? ctxRes.items : [],
  };

  const promptBundle: PromptBundle = buildPromptBundle({
    resolvedPlan,
    coreSystemPrompt: systemCorePrompt,
    uiLang,
    replyLang,
    stateForSystem: normalizedStateForPayload,
    memoryBlock,
    learningBlock,
    learningPromptContext,
    userText,
    conversationId: resolvedConversationId,
  });

  const effectiveLearningBlockForDebug = debugSave
    ? extractLearningBlockFromBaseSystemPrompt(promptBundle.baseSystemPrompt)
    : "";

  const saveUserRes = await saveUserMessageOrError({
    supabase,
    authedUserId,
    resolvedConversationId,
    userText,
    uiLang,
    debugSave,
    enforceThreadOwnership,
  });
  if (!saveUserRes.ok) {
    return {
      status: saveUserRes.status,
      payload: saveUserRes.payload,
    };
  }
  const { userMessageId } = saveUserRes;

  const userPhraseLearningPromise = saveUserPhraseLearning({
    supabase: internalWriteSupabase,
    userMessageId,
    resolvedConversationId,
    authedUserId,
    userText,
    uiLang,
    estimatedStateLevel: currentStateLevel,
  });

  const autoTitlePromise = runAutoRename({
    supabase,
    authedUserId,
    resolvedConversationId,
    userText,
    uiLang,
  });

  let openai_ok: boolean | null = null;
  let openai_error: string | null = null;
  let assistantMessageId = "";
  let insAsstOk = false;
  let notification: NotificationState = createInitialNotificationState();
  let response_generation_log_ok: boolean | null = null;
  let response_generation_log_error: string | null = null;
  let state_transition_signal_ok: boolean | null = null;
  let state_transition_signal_error: string | null = null;
  let usedHeuristicConfirmedMemoryCandidates = false;
  let userPhraseLearningOutcome: UserPhraseLearningOutcome = {
    attempted: false,
    observationCount: 0,
    persistableObservationCount: 0,
    insertedObservationCount: 0,
    upsertedPatternCount: 0,
    reason: null,
    error: null,
  };

  const turnDeps = createAuthenticatedTurnDeps({
    openai,
    modelName,
    openaiTimeoutMs,
    body,
    uiLang,
    replyLang,
    userText,
    resolvedPlan,
    resolvedConversationId,
    confirmedStateFallback,
    promptBundle,
    ctxRes: resolvedCtxRes,
    currentPhase,
    currentStateLevel,
    prevPhase,
    prevStateLevel,
    stateChanged,
    supabase,
    internalWriteSupabase,
    authedUserId,
    debugSave,
    enforceThreadOwnership,
    userMessageId,
    selectedStrategy,
    setOpenAiState: ({
      openai_ok: nextOpenAiOk,
      openai_error: nextOpenAiError,
    }) => {
      openai_ok = nextOpenAiOk;
      openai_error = nextOpenAiError;
    },
    setPersistedAssistantState: ({
      assistantMessageId: nextAssistantMessageId,
      insAsstOk: nextInsAsstOk,
    }) => {
      assistantMessageId = nextAssistantMessageId;
      insAsstOk = nextInsAsstOk;
    },
    setNotification: (nextNotification) => {
      notification = nextNotification;
    },
    setLearningLogsState: ({
      response_generation_log_ok: nextResponseGenerationLogOk,
      response_generation_log_error: nextResponseGenerationLogError,
      state_transition_signal_ok: nextStateTransitionSignalOk,
      state_transition_signal_error: nextStateTransitionSignalError,
    }) => {
      response_generation_log_ok = nextResponseGenerationLogOk;
      response_generation_log_error = nextResponseGenerationLogError;
      state_transition_signal_ok = nextStateTransitionSignalOk;
      state_transition_signal_error = nextStateTransitionSignalError;
    },
    markUsedHeuristicConfirmedMemoryCandidates: () => {
      usedHeuristicConfirmedMemoryCandidates = true;
    },
  });

  const runTurn = await runHopyTurn({
    ctx: {
      request: body,
      userId: authedUserId,
      threadId: resolvedConversationId,
      uiLang,
    },
    deps: turnDeps,
  }).catch((e: any) => {
    const status = Number(e?.status ?? 500);
    const payload =
      e?.payload && typeof e.payload === "object"
        ? e.payload
        : {
            ok: false,
            error: String(e?.message ?? "run_hopy_turn_failed"),
          };

    return {
      response: null,
      loadedContext: null,
      promptInput: null,
      modelOutput: null,
      result: null,
      __error: {
        status,
        payload,
      },
    } as any;
  });

  if ((runTurn as any)?.__error) {
    return {
      status: (runTurn as any).__error.status,
      payload: (runTurn as any).__error.payload,
    };
  }

  try {
    userPhraseLearningOutcome = await userPhraseLearningPromise;
  } catch (e: any) {
    userPhraseLearningOutcome = {
      attempted: true,
      observationCount: 0,
      persistableObservationCount: 0,
      insertedObservationCount: 0,
      upsertedPatternCount: 0,
      reason: "exception",
      error: errorText(e) || String(e?.message ?? e),
    };
  }

  const autoTitleRes = await autoTitlePromise;
  const {
    auto_title_ok,
    auto_title_updated,
    auto_title_reason,
    auto_title_title,
  } = autoTitleRes;
  const normalizedAutoTitleUpdated = auto_title_updated ?? false;

  const hasTurnRecord = asRecord(runTurn.result?.turnRecord) !== null;
  const hasConfirmedPayload =
    asRecord(runTurn.result?.hopy_confirmed_payload) !== null;
  const speedAudit = asRecord(runTurn.result?.speed_audit);

  if (!hasTurnRecord && !hasConfirmedPayload) {
    const payload: Record<string, unknown> = {
      ok: false,
      error:
        openai_error ||
        "authenticated: confirmedTurn inputs are missing after runHopyTurn",
    };

    if (speedAudit) {
      payload.speed_audit = {
        ...speedAudit,
        context_load_ms,
        total_ms: elapsedMs(totalStartMs),
      };
    } else {
      payload.speed_audit = {
        context_load_ms,
        total_ms: elapsedMs(totalStartMs),
      };
    }

    if (debugSave) {
      attachDebugPayload({
        payload,
        buildSig,
        openaiTimeoutMs,
        contextLimit,
        memoryExtractTimeoutMs,
        memoryMinIntervalSec,
        memoryCleanEnabled: allowMemoryClean,
        memoryCleanLimit,
        enforceThreadOwnership,
        missingThreadReuseWindowSec,
        openai_ok: openai_ok ?? false,
        openai_error,
        userMessageId,
        insUserOk: true,
        assistantMessageId,
        insAsstOk,
        replyLang,
        resolvedPlan,
        memoryInjected,
        memoryBlock,
        learningBlock: effectiveLearningBlockForDebug,
        ctxRes,
        mem_write_attempted: false,
        mem_write_allowed: false,
        mem_write_inserted: 0,
        mem_write_reason: "skip_on_missing_confirmed_turn_inputs",
        mem_items_count: 0,
        mem_parse_ok: null,
        mem_extract_preview: "",
        mem_used_heuristic: false,
        learning_save_attempted: false,
        learning_save_inserted: 0,
        learning_save_reason: "skip_on_missing_confirmed_turn_inputs",
        learning_save_error: null,
        st,
        audit_ok: null,
        audit_error: null,
        precheck_not_found,
        auto_title_ok,
        auto_title_updated: normalizedAutoTitleUpdated,
        auto_title_reason,
        auto_title_title,
        server_created_thread,
        server_created_thread_title,
        server_reused_recent_thread,
        server_reused_recent_thread_title,
        clientRequestIdIn,
        server_created_client_request_id,
        accessToken,
        uiLang,
        routedLang: routed.lang ?? null,
        userText,
        response_generation_log_ok,
        response_generation_log_error,
        state_transition_signal_ok,
        state_transition_signal_error,
      });
    }

    return {
      status: 200,
      payload,
    };
  }

  const confirmedTurn = resolveConfirmedTurnFromBuiltResult(
    runTurn.result,
    confirmedStateFallback,
  );

  const postTurn = await finalizeAuthenticatedPostTurn({
    runTurnResult: runTurn.result,
    resolvedPlan,
    userText,
    uiLang,
    routed,
    openai,
    modelName,
    supabase,
    internalWriteSupabase,
    authedUserId,
    resolvedConversationId,
    assistantMessageId,
    userMessageId,
    confirmedTurn,
    notification,
    selectedStrategy,
    usedHeuristicConfirmedMemoryCandidates,
    memoryExtractTimeoutMs,
    memoryMinIntervalSec,
    debugSave,
    buildSig,
    allowMemoryClean,
    memoryCleanLimit,
    contextLimit,
    enforceThreadOwnership,
    missingThreadReuseWindowSec,
    accessToken,
    clientRequestIdIn,
    memoryInjected,
    memoryBlock,
    effectiveLearningBlockForDebug,
    ctxRes,
    stateBefore,
    st,
    stateUpdateOk,
    stateUpdateError,
    precheck_not_found,
    auto_title_ok,
    auto_title_updated: normalizedAutoTitleUpdated,
    auto_title_reason,
    auto_title_title,
    server_created_thread,
    server_created_thread_title,
    server_reused_recent_thread,
    server_reused_recent_thread_title,
    server_created_client_request_id,
    cleanTrigger,
    memory_clean,
    openai_ok,
    openai_error,
    insAsstOk,
    replyLang,
    response_generation_log_ok,
    response_generation_log_error,
    state_transition_signal_ok,
    state_transition_signal_error,
    userPhraseLearningOutcome,
  });

  const payload: Record<string, unknown> = postTurn.payload;

  if (speedAudit) {
    payload.speed_audit = {
      ...speedAudit,
      context_load_ms,
      total_ms: elapsedMs(totalStartMs),
    };
  } else {
    payload.speed_audit = {
      context_load_ms,
      total_ms: elapsedMs(totalStartMs),
    };
  }

  if (debugSave) {
    attachDebugPayload({
      payload,
      buildSig,
      openaiTimeoutMs,
      contextLimit,
      memoryExtractTimeoutMs,
      memoryMinIntervalSec,
      memoryCleanEnabled: allowMemoryClean,
      memoryCleanLimit,
      enforceThreadOwnership,
      missingThreadReuseWindowSec,
      openai_ok: openai_ok ?? false,
      openai_error,
      userMessageId,
      insUserOk: true,
      assistantMessageId,
      insAsstOk,
      replyLang,
      resolvedPlan,
      memoryInjected,
      memoryBlock,
      learningBlock: effectiveLearningBlockForDebug,
      ctxRes,
      mem_write_attempted: postTurn.memoryWrite.mem_write_attempted,
      mem_write_allowed: postTurn.memoryWrite.mem_write_allowed ?? false,
      mem_write_inserted: postTurn.memoryWrite.mem_write_inserted,
      mem_write_reason: postTurn.memoryWrite.mem_write_reason,
      mem_items_count: postTurn.memoryWrite.mem_items_count ?? 0,
      mem_parse_ok: postTurn.memoryWrite.mem_parse_ok ?? null,
      mem_extract_preview: postTurn.memoryWrite.mem_extract_preview,
      mem_used_heuristic: postTurn.memoryWrite.mem_used_heuristic ?? null,
      learning_save_attempted: postTurn.learning_save_attempted,
      learning_save_inserted: postTurn.learning_save_inserted,
      learning_save_reason: postTurn.learning_save_reason,
      learning_save_error: postTurn.learning_save_error,
      st,
      audit_ok: postTurn.audit_ok,
      audit_error: postTurn.audit_error,
      precheck_not_found,
      auto_title_ok,
      auto_title_updated: normalizedAutoTitleUpdated,
      auto_title_reason,
      auto_title_title,
      server_created_thread,
      server_created_thread_title,
      server_reused_recent_thread,
      server_reused_recent_thread_title,
      clientRequestIdIn,
      server_created_client_request_id,
      accessToken,
      uiLang,
      routedLang: routed.lang ?? null,
      userText,
      response_generation_log_ok,
      response_generation_log_error,
      state_transition_signal_ok,
      state_transition_signal_error,
    });
  }

  return {
    status: 200,
    payload,
  };
}
/*
【このファイルの正式役割】
authenticated ユーザー用のチャット処理本体。
route.ts から受け取った authenticated 側の入力をまとめ、
スレッド解決、状態解決、memory / learning / context 準備、prompt 準備、
user message 保存、runHopyTurn 実行、postTurn 最終化、debug 付与までを順に進め、
最後に payload を返す役割。

【このファイルが受け取るもの】
openai
modelName
supabase
accessToken
authedUserId
body
userText
uiLang
replyLang
routed
selectedStrategy
buildSig
debugSave
openaiTimeoutMs
memoryExtractTimeoutMs
memoryMinIntervalSec
allowMemoryClean
memoryCleanLimit
contextLimit
enforceThreadOwnership
missingThreadReuseWindowSec
clientRequestIdIn
requestedConversationId

【このファイルが渡すもの】
resolveAuthThread(...) へ
- userId
- requestedConversationId
- ownership 条件
- request id 系

resolveConversationState(...) へ
- userId
- resolvedConversationId
- userText
- uiLang

resolvePromptMemoryLoad(...) へ
- plan
- userId
- state
- clientMemoryBlock

loadLearningPromptContext(...) / loadLearningBlock(...) へ
- userId
- currentStateLevel

loadRecentConversationMessages(...) へ
- resolvedConversationId
- contextLimit

buildPromptBundle(...) へ
- resolvedPlan
- systemCorePrompt
- uiLang / replyLang
- normalizedStateForPayload
- memoryBlock
- learningBlock
- learningPromptContext
- userText
- conversationId

saveUserMessageOrError(...) へ
- userText
- resolvedConversationId
- authedUserId

saveUserPhraseLearning(...) へ
- userMessageId
- resolvedConversationId
- authedUserId
- userText
- estimatedStateLevel

runAutoRename(...) へ
- resolvedConversationId
- userText
- uiLang

createAuthenticatedTurnDeps(...) へ
- OpenAI 実行条件
- promptBundle
- context
- state 一式
- persistence 用 setter 群
- userMessageId
- selectedStrategy など

runHopyTurn(...) へ
- ctx
- deps

finalizeAuthenticatedPostTurn(...) へ
- runTurnResult
- confirmedTurn
- notification
- state / title / memory / debug / request / thread / OpenAI 実行結果 一式

最後に postTurn.payload を返す。
debugSave=true のときは attachDebugPayload(...) で debug を積み増して返す。

【Compass 観点でこのファイルの意味】
このファイル自身は Compass 本文を生成していない。
このファイル自身は HOPY○ 表示条件を判定していない。
このファイル自身は ui_effects.compass を直接組み立てていない。

ただし、Compass の本道に必要な前提値をほぼ全部そろえて、
runHopyTurn と finalizeAuthenticatedPostTurn に正しく渡す
authenticated 側の中継本体である。

つまりこのファイルの Compass 上の意味は、
「Compass を作る場所」ではなく、
「Compass が壊れず流れるための前提値を束ねて下流へ渡す場所」。

【このファイルで確認できた大事なこと】
1. free / plus / pro の plan 解決はこの段階で行われている。
2. stateChanged / currentPhase / currentStateLevel / prevPhase / prevStateLevel を
   createAuthenticatedTurnDeps(...) に渡している。
3. promptBundle もこのファイルで組み立てている。
4. 最終 payload の直接生成者はこのファイルではなく
   finalizeAuthenticatedPostTurn(...) 側。
5. runHopyTurn 失敗時は authenticated.ts で擬似成功へ回復させず、
   正式エラーをそのまま返す。 */

/* 【今回このファイルで修正したこと】
- routed.tone の型を finalizeAuthenticatedPostTurn 側の routed.tone 型に合わせました。
- finalizeAuthenticatedPostTurn(...) 呼び出し時の routed 型不一致で build が止まる症状だけを対象に修正しました。
- 実行時の値や routed の判定ロジックは変えず、このファイル内の型の受け口だけをそろえました。
- 状態判定、Compass 系の流れ、debug の中身には触っていません。
*/
// このファイルの正式役割: authenticated ユーザー用のチャット処理本体