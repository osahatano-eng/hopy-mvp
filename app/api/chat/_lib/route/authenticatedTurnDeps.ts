// /app/api/chat/_lib/route/authenticatedTurnDeps.ts

import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { generateAssistantReply } from "./openai";
import {
  buildConfirmedAssistantTurn,
  normalizeConfirmedStateLevel,
  saveAssistantLearningLogs,
  saveAssistantMessageOrError,
} from "./authenticatedHelpers";
import type { Lang } from "../router/simpleRouter";
import type { NotificationState } from "../state/notification";
import { buildAuthenticatedTurnResult } from "./authenticatedTurnResult";

type ResolvedPlan = "free" | "plus" | "pro";

type PromptBundle = Parameters<typeof generateAssistantReply>[0]["promptBundle"];
type Phase5 = 1 | 2 | 3 | 4 | 5;

type RunHopyTurnBuiltResult = {
  reply?: unknown;
  turnRecord?: unknown;
  hopy_confirmed_payload?: unknown;
  speed_audit?: unknown;
  [key: string]: unknown;
};

type LoadedAuthenticatedContext = {
  history: any[];
};

type AuthenticatedPromptInput = {
  promptBundle: PromptBundle;
  history: any[];
  userText: string;
  replyLang: Lang;
  currentPhase: Phase5;
  currentStateLevel: number;
  prevPhase: number;
  prevStateLevel: number;
  stateChanged: boolean;
};

type AuthenticatedModelOutput = {
  assistantText: string;
  openai_ok: boolean | null;
  openai_error: string | null;
  confirmed_memory_candidates: unknown;
  state: unknown;
  hopy_confirmed_payload: unknown;
  reply: string;
  ui_effects: unknown;
  compass: { text: string; prompt: string } | null;
  compassText: string;
  compassPrompt: string;
  speed_audit?: Record<string, unknown> | null;
};

type CanonicalAssistantState = {
  current_phase: Phase5;
  state_level: Phase5;
  prev_phase: Phase5;
  prev_state_level: Phase5;
  state_changed: boolean;
};

type ConfirmedAssistantTurn = {
  assistantText: string;
  currentPhase: Phase5;
  currentStateLevel: Phase5;
  stateChanged: boolean;
  prevPhase: Phase5;
  prevStateLevel: Phase5;
  canonicalAssistantState: CanonicalAssistantState;
  compassText?: string;
  compassPrompt?: string;
};

export type ConfirmedStateFallback = {
  currentPhase: number;
  currentStateLevel: number;
  prevPhase: number;
  prevStateLevel: number;
};

function normalizeOptionalText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function resolveStateChanged(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new Error(
      "authenticatedTurnDeps: hopy_confirmed_payload.state.state_changed is required",
    );
  }
  return value;
}

function resolveRequiredPhaseValue(
  value: unknown,
  fieldName:
    | "current_phase"
    | "state_level"
    | "prev_phase"
    | "prev_state_level",
): Phase5 {
  const normalized = normalizeConfirmedStateLevel(value);
  if (normalized === null || normalized === undefined) {
    throw new Error(
      `authenticatedTurnDeps: hopy_confirmed_payload.state.${fieldName} is required`,
    );
  }
  return normalized;
}

function resolvePromptPhase(value: number): Phase5 {
  const normalized = normalizeConfirmedStateLevel(value);
  if (normalized === null || normalized === undefined) {
    throw new Error(
      "authenticatedTurnDeps: currentPhase must be normalized to 1..5 before callModel",
    );
  }
  return normalized;
}

function buildCanonicalAssistantState(params: {
  currentPhase: Phase5;
  currentStateLevel: Phase5;
  prevPhase: Phase5;
  prevStateLevel: Phase5;
  stateChanged: boolean;
}): CanonicalAssistantState {
  return {
    current_phase: params.currentPhase,
    state_level: params.currentStateLevel,
    prev_phase: params.prevPhase,
    prev_state_level: params.prevStateLevel,
    state_changed: params.stateChanged,
  };
}

function resolveConfirmedPayloadState(
  state: Record<string, unknown> | null,
): CanonicalAssistantState {
  if (!state) {
    throw new Error(
      "authenticatedTurnDeps: hopy_confirmed_payload.state is required",
    );
  }

  return {
    current_phase: resolveRequiredPhaseValue(
      state.current_phase,
      "current_phase",
    ),
    state_level: resolveRequiredPhaseValue(state.state_level, "state_level"),
    prev_phase: resolveRequiredPhaseValue(state.prev_phase, "prev_phase"),
    prev_state_level: resolveRequiredPhaseValue(
      state.prev_state_level,
      "prev_state_level",
    ),
    state_changed: resolveStateChanged(state.state_changed),
  };
}

function resolveConfirmedCompass(params: {
  resolvedPlan: ResolvedPlan;
  confirmedState: {
    state_changed: boolean;
  };
  confirmedPayloadCompass: Record<string, unknown> | null;
}): { text: string; prompt: string } | null {
  const { resolvedPlan, confirmedState, confirmedPayloadCompass } = params;

  const resolvedCompassText = normalizeOptionalText(
    confirmedPayloadCompass?.text,
  );
  const resolvedCompassPrompt = normalizeOptionalText(
    confirmedPayloadCompass?.prompt,
  );

  if (resolvedPlan !== "free" && confirmedState.state_changed === true) {
    if (!resolvedCompassText) {
      throw new Error(
        "authenticatedTurnDeps: hopy_confirmed_payload.compass.text is required when resolvedPlan is not free and state_changed is true",
      );
    }

    if (!resolvedCompassPrompt) {
      throw new Error(
        "authenticatedTurnDeps: hopy_confirmed_payload.compass.prompt is required when resolvedPlan is not free and state_changed is true",
      );
    }
  }

  if (!resolvedCompassText || !resolvedCompassPrompt) {
    return null;
  }

  return {
    text: resolvedCompassText,
    prompt: resolvedCompassPrompt,
  };
}

function resolveSpeedAudit(value: unknown): Record<string, unknown> | null {
  return asRecord(value);
}

function buildFailedAuthenticatedModelOutput(params: {
  openaiOk: boolean | null;
  openaiError: string | null;
  confirmedMemoryCandidates: unknown;
  speedAudit: Record<string, unknown> | null;
}): AuthenticatedModelOutput {
  return {
    assistantText: "",
    openai_ok: params.openaiOk,
    openai_error: params.openaiError,
    confirmed_memory_candidates: params.confirmedMemoryCandidates,
    state: null,
    hopy_confirmed_payload: null,
    reply: "",
    ui_effects: null,
    compass: null,
    compassText: "",
    compassPrompt: "",
    speed_audit: params.speedAudit,
  } as AuthenticatedModelOutput;
}

function shouldSkipPersistFromResult(
  result: RunHopyTurnBuiltResult | null | undefined,
): boolean {
  if (!result) return true;
  return !asRecord(result.hopy_confirmed_payload);
}

function resolveConfirmedTurnFromTurnRecord(
  result: RunHopyTurnBuiltResult | null | undefined,
): ConfirmedAssistantTurn | null {
  const turnRecord = asRecord(result?.turnRecord);
  if (!turnRecord) return null;

  const assistantText = normalizeOptionalText(
    turnRecord.assistantText ?? turnRecord.reply ?? result?.reply,
  );
  const canonicalAssistantState = asRecord(
    turnRecord.canonicalAssistantState ?? turnRecord.state,
  );

  if (!assistantText || !canonicalAssistantState) {
    return null;
  }

  const currentPhase = normalizeConfirmedStateLevel(
    canonicalAssistantState.current_phase,
  );
  const currentStateLevel = normalizeConfirmedStateLevel(
    canonicalAssistantState.state_level,
  );
  const prevPhase = normalizeConfirmedStateLevel(
    canonicalAssistantState.prev_phase,
  );
  const prevStateLevel = normalizeConfirmedStateLevel(
    canonicalAssistantState.prev_state_level,
  );
  const stateChanged = canonicalAssistantState.state_changed;

  if (
    currentPhase === null ||
    currentStateLevel === null ||
    prevPhase === null ||
    prevStateLevel === null ||
    typeof stateChanged !== "boolean"
  ) {
    return null;
  }

  const confirmedTurn = buildConfirmedAssistantTurn({
    assistantText,
    currentPhase,
    currentStateLevel,
    stateChanged,
    prevPhase,
    prevStateLevel,
  }) as ConfirmedAssistantTurn & {
    compassText?: string;
    compassPrompt?: string;
  };

  confirmedTurn.canonicalAssistantState = buildCanonicalAssistantState({
    currentPhase,
    currentStateLevel,
    prevPhase,
    prevStateLevel,
    stateChanged,
  });

  const compassText = normalizeOptionalText(turnRecord.compassText);
  const compassPrompt = normalizeOptionalText(turnRecord.compassPrompt);

  if (compassText) {
    confirmedTurn.compassText = compassText;
  }

  if (compassPrompt) {
    confirmedTurn.compassPrompt = compassPrompt;
  }

  return confirmedTurn as ConfirmedAssistantTurn;
}

export function resolveConfirmedTurnFromBuiltResult(
  result: RunHopyTurnBuiltResult | null | undefined,
  _fallback: ConfirmedStateFallback,
): ConfirmedAssistantTurn {
  const confirmedPayload = asRecord(result?.hopy_confirmed_payload);
  if (confirmedPayload) {
    const confirmedPayloadState = resolveConfirmedPayloadState(
      asRecord(confirmedPayload.state),
    );

    const assistantText = normalizeOptionalText(confirmedPayload.reply);

    if (!assistantText) {
      throw new Error(
        "authenticatedTurnDeps: result.hopy_confirmed_payload.reply is required",
      );
    }

    const confirmedTurn = buildConfirmedAssistantTurn({
      assistantText,
      currentPhase: confirmedPayloadState.current_phase,
      currentStateLevel: confirmedPayloadState.state_level,
      stateChanged: confirmedPayloadState.state_changed,
      prevPhase: confirmedPayloadState.prev_phase,
      prevStateLevel: confirmedPayloadState.prev_state_level,
    }) as ConfirmedAssistantTurn & {
      compassText?: string;
      compassPrompt?: string;
    };

    confirmedTurn.canonicalAssistantState = buildCanonicalAssistantState({
      currentPhase: confirmedPayloadState.current_phase,
      currentStateLevel: confirmedPayloadState.state_level,
      prevPhase: confirmedPayloadState.prev_phase,
      prevStateLevel: confirmedPayloadState.prev_state_level,
      stateChanged: confirmedPayloadState.state_changed,
    });

    const confirmedPayloadCompass = asRecord(confirmedPayload.compass);
    const resolvedCompassText = normalizeOptionalText(
      confirmedPayloadCompass?.text,
    );
    const resolvedCompassPrompt = normalizeOptionalText(
      confirmedPayloadCompass?.prompt,
    );

    if (resolvedCompassText) {
      confirmedTurn.compassText = resolvedCompassText;
    }

    if (resolvedCompassPrompt) {
      confirmedTurn.compassPrompt = resolvedCompassPrompt;
    }

    return confirmedTurn as ConfirmedAssistantTurn;
  }

  const resolvedFromTurnRecord = resolveConfirmedTurnFromTurnRecord(result);
  if (resolvedFromTurnRecord) {
    return resolvedFromTurnRecord;
  }

  throw new Error(
    "authenticatedTurnDeps: confirmedTurn cannot be resolved without hopy_confirmed_payload or turnRecord",
  );
}

export function createAuthenticatedTurnDeps(params: {
  openai: OpenAI;
  modelName: string;
  openaiTimeoutMs: number;
  body: any;
  uiLang: Lang;
  replyLang: Lang;
  userText: string;
  resolvedPlan: ResolvedPlan;
  resolvedConversationId: string;
  confirmedStateFallback: ConfirmedStateFallback;
  promptBundle: PromptBundle;
  ctxRes: { ok: boolean; items: any[] };
  currentPhase: number;
  currentStateLevel: number;
  prevPhase: number;
  prevStateLevel: number;
  stateChanged: boolean;
  supabase: SupabaseClient;
  internalWriteSupabase: SupabaseClient;
  authedUserId: string;
  debugSave: boolean;
  enforceThreadOwnership: boolean;
  userMessageId: string;
  selectedStrategy: string;
  setOpenAiState: (args: {
    openai_ok: boolean | null;
    openai_error: string | null;
  }) => void;
  setPersistedAssistantState: (args: {
    assistantMessageId: string;
    insAsstOk: boolean;
  }) => void;
  setNotification: (notification: NotificationState) => void;
  setLearningLogsState: (args: {
    response_generation_log_ok: boolean | null;
    response_generation_log_error: string | null;
    state_transition_signal_ok: boolean | null;
    state_transition_signal_error: string | null;
  }) => void;
  markUsedHeuristicConfirmedMemoryCandidates: () => void;
}) {
  const resolvedHistory = params.ctxRes.ok ? params.ctxRes.items : [];

  return {
    loadContext: async (): Promise<LoadedAuthenticatedContext> => {
      return {
        history: resolvedHistory,
      };
    },

    buildPromptInput: async (): Promise<AuthenticatedPromptInput> => {
      return {
        promptBundle: params.promptBundle,
        history: resolvedHistory,
        userText: params.userText,
        replyLang: params.replyLang,
        currentPhase: resolvePromptPhase(params.currentPhase),
        currentStateLevel: params.currentStateLevel,
        prevPhase: params.prevPhase,
        prevStateLevel: params.prevStateLevel,
        stateChanged: params.stateChanged,
      };
    },

    callModel: async ({
      promptInput,
    }: {
      promptInput: AuthenticatedPromptInput;
    }): Promise<AuthenticatedModelOutput> => {
      const authReply = await generateAssistantReply({
        openai: params.openai,
        modelName: params.modelName,
        promptBundle: promptInput.promptBundle,
        history: promptInput.history,
        userText: promptInput.userText,
        replyLang: promptInput.replyLang,
        phaseForParams: promptInput.currentPhase,
        openaiTimeoutMs: params.openaiTimeoutMs,
      });

      params.setOpenAiState({
        openai_ok: authReply.openai_ok,
        openai_error: authReply.openai_error,
      });

      const speedAudit = resolveSpeedAudit(authReply.speed_audit);

      if (authReply.openai_ok !== true) {
        return buildFailedAuthenticatedModelOutput({
          openaiOk: authReply.openai_ok,
          openaiError: authReply.openai_error,
          confirmedMemoryCandidates: authReply.confirmed_memory_candidates,
          speedAudit,
        });
      }

      const confirmedPayload = authReply.hopy_confirmed_payload ?? null;
      if (!confirmedPayload || !asRecord(confirmedPayload)) {
        throw new Error(
          "authenticatedTurnDeps: authReply.hopy_confirmed_payload is required",
        );
      }

      const confirmedReply = normalizeOptionalText(confirmedPayload.reply);
      if (!confirmedReply) {
        throw new Error(
          "authenticatedTurnDeps: authReply.hopy_confirmed_payload.reply is required",
        );
      }

      const confirmedPayloadState = resolveConfirmedPayloadState(
        asRecord(confirmedPayload.state),
      );

      const confirmedPayloadCompass = asRecord(confirmedPayload.compass);
      const resolvedCompass = resolveConfirmedCompass({
        resolvedPlan: params.resolvedPlan,
        confirmedState: confirmedPayloadState,
        confirmedPayloadCompass,
      });

      return {
        assistantText: confirmedReply,
        openai_ok: authReply.openai_ok,
        openai_error: authReply.openai_error,
        confirmed_memory_candidates: authReply.confirmed_memory_candidates,
        state: confirmedPayloadState,
        hopy_confirmed_payload: confirmedPayload,
        reply: confirmedReply,
        ui_effects: null,
        compass: resolvedCompass,
        compassText: resolvedCompass?.text ?? "",
        compassPrompt: resolvedCompass?.prompt ?? "",
        speed_audit: speedAudit,
      } as AuthenticatedModelOutput;
    },

    buildTurnResult: async ({
      promptInput,
      modelOutput,
    }: {
      promptInput: AuthenticatedPromptInput;
      modelOutput: AuthenticatedModelOutput;
    }): Promise<RunHopyTurnBuiltResult> => {
      const baseResult = await buildAuthenticatedTurnResult({
        promptInput,
        modelOutput,
        resolvedPlan: params.resolvedPlan,
        userText: params.userText,
        uiLang: params.uiLang,
        resolvedConversationId: params.resolvedConversationId,
        setNotification: params.setNotification,
        markUsedHeuristicConfirmedMemoryCandidates:
          params.markUsedHeuristicConfirmedMemoryCandidates,
      });

      return {
        ...baseResult,
        speed_audit: resolveSpeedAudit(
          (modelOutput as AuthenticatedModelOutput & {
            speed_audit?: unknown;
          }).speed_audit,
        ),
      };
    },

    persistTurn: async ({
      result,
    }: {
      result: RunHopyTurnBuiltResult;
    }): Promise<void> => {
      if (shouldSkipPersistFromResult(result)) {
        return;
      }

      const confirmedTurn = resolveConfirmedTurnFromBuiltResult(
        result,
        params.confirmedStateFallback,
      );

      const saveAssistantRes = await saveAssistantMessageOrError({
        supabase: params.supabase,
        authedUserId: params.authedUserId,
        resolvedConversationId: params.resolvedConversationId,
        confirmedTurn,
        replyLang: params.replyLang,
        debugSave: params.debugSave,
        enforceThreadOwnership: params.enforceThreadOwnership,
      });

      if (!saveAssistantRes.ok) {
        const error: any = new Error(
          String(saveAssistantRes.payload?.error ?? "assistant_save_failed"),
        );
        error.status = saveAssistantRes.status;
        error.payload = saveAssistantRes.payload;
        throw error;
      }

      params.setPersistedAssistantState({
        assistantMessageId: saveAssistantRes.assistantMessageId,
        insAsstOk: saveAssistantRes.insAsstOk,
      });

      const learningLogsOutcome = await saveAssistantLearningLogs({
        supabase: params.internalWriteSupabase,
        assistantMessageId: saveAssistantRes.assistantMessageId,
        resolvedConversationId: params.resolvedConversationId,
        authedUserId: params.authedUserId,
        confirmedTurn,
        userMessageId: params.userMessageId,
        selectedStrategy: params.selectedStrategy,
      });

      params.setLearningLogsState({
        response_generation_log_ok:
          learningLogsOutcome.responseGenerationLogOk,
        response_generation_log_error:
          learningLogsOutcome.responseGenerationLogError,
        state_transition_signal_ok:
          learningLogsOutcome.stateTransitionSignalOk,
        state_transition_signal_error:
          learningLogsOutcome.stateTransitionSignalError,
      });
    },
  };
}
/*
このファイルの正式役割
authenticated 経路の runHopyTurn 用 deps 作成ファイル。
具体的には、
1. context を loadContext で渡す
2. prompt 入力を buildPromptInput で作る
3. OpenAI 実行結果を callModel で受ける
4. turn 結果を buildTurnResult で組み立てる
5. confirmedTurn に確定して persistTurn で保存する
という、runHopyTurn の各段階で必要な処理束を定義する役割。
*/
/*
【今回このファイルで修正したこと】
- resolveConfirmedTurnFromBuiltResult(...) で turnRecord より先に hopy_confirmed_payload を優先採用するように修正しました。
- これにより、唯一の正である hopy_confirmed_payload.state を、下流で turnRecord 側の値で上書きしないように戻しました。
- hopy_confirmed_payload がないときだけ turnRecord を fallback として使う順序に修正しました。
- state_changed と compass の厳格検証はそのまま維持しています。
*/
// このファイルの正式役割: /app/api/chat/_lib/route/authenticatedTurnDeps.ts