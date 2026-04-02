// /app/api/chat/_lib/route/authenticatedTurnResult.ts

import {
  createInitialNotificationState,
  incrementNotification,
  type NotificationState,
} from "../state/notification";
import { decideBadgeFromAssistantReply } from "../state/notificationPolicy";
import type { Lang } from "../router/simpleRouter";
import type { ResolvedPlan } from "./promptBundle";
import type { RunHopyTurnBuiltResult } from "./runHopyTurn";
import {
  buildConfirmedAssistantTurn,
  normalizeConfirmedStateLevel,
  type AuthenticatedModelOutput,
  type AuthenticatedPromptInput,
  type ConfirmedAssistantTurn,
  type ConfirmedMemoryCandidate,
} from "./authenticatedHelpers";
import { resolveFinalConfirmedMemoryCandidates } from "./authenticatedMemoryCandidates";

export type BuildAuthenticatedTurnResultParams = {
  promptInput: AuthenticatedPromptInput;
  modelOutput: AuthenticatedModelOutput;
  resolvedPlan: ResolvedPlan;
  userText: string;
  uiLang: Lang;
  resolvedConversationId: string;
  setNotification: (notification: NotificationState) => void;
  markUsedHeuristicConfirmedMemoryCandidates: () => void;
};

function normalizeCompassString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length > 0 ? s : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function resolveConfirmedPayload(
  modelOutput: AuthenticatedModelOutput,
): Record<string, unknown> | null {
  const rawModelOutput = modelOutput as Record<string, unknown>;

  if (isRecord(rawModelOutput.hopy_confirmed_payload)) {
    return rawModelOutput.hopy_confirmed_payload;
  }

  if (isRecord(rawModelOutput.hopyConfirmedPayload)) {
    return rawModelOutput.hopyConfirmedPayload;
  }

  return null;
}

function resolveConfirmedPayloadCompass(
  modelOutput: AuthenticatedModelOutput,
): Record<string, unknown> | null {
  const confirmedPayload = resolveConfirmedPayload(modelOutput);
  if (!confirmedPayload) return null;

  return isRecord(confirmedPayload.compass) ? confirmedPayload.compass : null;
}

function resolveStateSource(
  modelOutput: AuthenticatedModelOutput,
): Record<string, unknown> | null {
  const rawModelOutput = modelOutput as Record<string, unknown>;
  const confirmedPayload = resolveConfirmedPayload(modelOutput);

  return (
    (confirmedPayload && isRecord(confirmedPayload.state)
      ? confirmedPayload.state
      : null) ??
    (isRecord(rawModelOutput.state) ? rawModelOutput.state : null) ??
    (isRecord(rawModelOutput.assistant_state) ? rawModelOutput.assistant_state : null)
  );
}

function resolveCompassText(
  modelOutput: AuthenticatedModelOutput,
): string | null {
  const confirmedPayloadCompass = resolveConfirmedPayloadCompass(modelOutput);
  return normalizeCompassString(confirmedPayloadCompass?.text);
}

function resolveCompassPrompt(
  modelOutput: AuthenticatedModelOutput,
): string | null {
  const confirmedPayloadCompass = resolveConfirmedPayloadCompass(modelOutput);
  return normalizeCompassString(confirmedPayloadCompass?.prompt);
}

function resolveStateBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function resolveStateLevelValue(value: unknown): number | null {
  const resolved = normalizeConfirmedStateLevel(value);
  if (resolved !== null && resolved !== undefined) {
    return resolved;
  }

  return null;
}

export async function buildAuthenticatedTurnResult(
  params: BuildAuthenticatedTurnResultParams,
): Promise<RunHopyTurnBuiltResult> {
  const {
    promptInput,
    modelOutput,
    resolvedPlan,
    userText,
    uiLang,
    resolvedConversationId,
    setNotification,
    markUsedHeuristicConfirmedMemoryCandidates,
  } = params;

  const rawModelOutput = modelOutput as {
    confirmed_memory_candidates?: unknown[];
    memory_candidates?: unknown[];
  };

  const modelState = resolveStateSource(modelOutput);

  const resolvedStateChanged = resolveStateBoolean(modelState?.state_changed);
  if (resolvedStateChanged === null) {
    throw new Error(
      "authenticatedTurnResult: modelOutput.state.state_changed is required",
    );
  }

  const resolvedCurrentPhase = resolveStateLevelValue(
    modelState?.current_phase,
  );
  if (resolvedCurrentPhase === null || resolvedCurrentPhase === undefined) {
    throw new Error(
      "authenticatedTurnResult: modelOutput.state.current_phase is required",
    );
  }

  const resolvedCurrentStateLevel = resolveStateLevelValue(
    modelState?.state_level,
  );
  if (
    resolvedCurrentStateLevel === null ||
    resolvedCurrentStateLevel === undefined
  ) {
    throw new Error(
      "authenticatedTurnResult: modelOutput.state.state_level is required",
    );
  }

  const resolvedPrevPhase = resolveStateLevelValue(modelState?.prev_phase);
  if (resolvedPrevPhase === null || resolvedPrevPhase === undefined) {
    throw new Error(
      "authenticatedTurnResult: modelOutput.state.prev_phase is required",
    );
  }

  const resolvedPrevStateLevel = resolveStateLevelValue(
    modelState?.prev_state_level,
  );
  if (
    resolvedPrevStateLevel === null ||
    resolvedPrevStateLevel === undefined
  ) {
    throw new Error(
      "authenticatedTurnResult: modelOutput.state.prev_state_level is required",
    );
  }

  const confirmedTurn = buildConfirmedAssistantTurn({
    assistantText: modelOutput.assistantText,
    currentPhase: resolvedCurrentPhase,
    currentStateLevel: resolvedCurrentStateLevel,
    stateChanged: resolvedStateChanged,
    prevPhase: resolvedPrevPhase,
    prevStateLevel: resolvedPrevStateLevel,
  }) as ConfirmedAssistantTurn & {
    compassText?: string;
    compassPrompt?: string;
  };

  const decision = decideBadgeFromAssistantReply(confirmedTurn.assistantText);

  let notification = createInitialNotificationState();
  if (decision.inc) {
    notification = incrementNotification({
      state: notification,
      amount: decision.amount,
      reason: decision.reason,
    });
  }
  setNotification(notification);

  const resolvedMemoryOutcome = await resolveFinalConfirmedMemoryCandidates({
    result: null,
    resolvedPlan,
    userText,
    confirmedTurn,
    uiLang,
    resolvedConversationId,
    assistantMessageId: "",
  });

  if (resolvedMemoryOutcome.usedHeuristicConfirmedMemoryCandidates) {
    markUsedHeuristicConfirmedMemoryCandidates();
  }

  const resolvedConfirmedMemoryCandidates =
    resolvedMemoryOutcome.confirmedMemoryCandidates.length > 0
      ? resolvedMemoryOutcome.confirmedMemoryCandidates
      : ((rawModelOutput.confirmed_memory_candidates ??
          rawModelOutput.memory_candidates ??
          []) as ConfirmedMemoryCandidate[]);

  const shouldRequireCompass =
    resolvedPlan !== "free" && confirmedTurn.stateChanged === true;

  const shouldIncludeCompass =
    resolvedPlan !== "free" && confirmedTurn.stateChanged === true;

  const compassText = shouldIncludeCompass
    ? resolveCompassText(modelOutput)
    : null;

  const compassPrompt = shouldIncludeCompass
    ? resolveCompassPrompt(modelOutput)
    : null;

  if (shouldRequireCompass && compassText === null) {
    throw new Error(
      "authenticatedTurnResult: compassText is required when resolvedPlan is not free and state_changed is true",
    );
  }

  if (shouldRequireCompass && compassPrompt === null) {
    throw new Error(
      "authenticatedTurnResult: compassPrompt is required when resolvedPlan is not free and state_changed is true",
    );
  }

  if (compassText) {
    confirmedTurn.compassText = compassText;
  }

  if (compassPrompt) {
    confirmedTurn.compassPrompt = compassPrompt;
  }

  return {
    reply: confirmedTurn.assistantText,
    state: confirmedTurn.canonicalAssistantState,
    notification,
    threadPatch: {
      id: resolvedConversationId,
      state_level: confirmedTurn.currentStateLevel,
      current_phase: confirmedTurn.currentPhase,
      state_changed: confirmedTurn.stateChanged,
      prev_phase: confirmedTurn.prevPhase,
      prev_state_level: confirmedTurn.prevStateLevel,
    },
    turnRecord: confirmedTurn,
    confirmed_memory_candidates:
      resolvedConfirmedMemoryCandidates as ConfirmedMemoryCandidate[],
    compassText,
    compassPrompt,
  };
}

export default buildAuthenticatedTurnResult;

/*
このファイルの正式役割
authenticated 経路における turn 結果の正式組み立てファイル。
modelOutput を受けて、
1. state を正規化する
2. confirmedTurn を作る
3. notification を決める
4. memory candidate を確定する
5. Compass を載せるか決める
6. RunHopyTurnBuiltResult を返す

このファイルが受け取るもの
promptInput
modelOutput
resolvedPlan
userText
uiLang
resolvedConversationId
setNotification(...)
markUsedHeuristicConfirmedMemoryCandidates(...)

このファイルが渡すもの
RunHopyTurnBuiltResult
- reply
- state
- notification
- threadPatch
- turnRecord
- confirmed_memory_candidates
- compassText
- compassPrompt

Compass 観点でこのファイルの意味
このファイルは Compass の正式搭載ポイントの1つ。
確定意味ペイロードの compass だけを受け取り、
RunHopyTurnBuiltResult に載せるかどうかをここで決める。
下流で Compass を生成・補完・再救出しない。
*/

/*
【今回このファイルで修正したこと】
- state の解決元を promptInput fallback から切り離し、modelOutput.state / hopy_confirmed_payload.state / assistant_state のみを正式参照元にした。
- HOPY○ と Compass 必須判定を、ユーザー入力前提の fallback state ではなく、モデルが返した確定 state だけで行うようにした。
- これにより、modelOutput 側で Compass が未生成なのに promptInput fallback だけで state_changed=true となり、
  authenticatedTurnResult で compassText required に落ちる不正経路を止めた。
*/
// このファイルの正式役割: authenticated 経路における turn 結果の正式組み立てファイル