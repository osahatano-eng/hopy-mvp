// /app/api/chat/_lib/route/authenticatedTurnResult.ts

import {
  createInitialNotificationState,
  incrementNotification,
  type NotificationState,
} from "../state/notification";
import { decideBadgeFromAssistantReply } from "../state/notificationPolicy";
import type { Lang } from "../router/simpleRouter";
import {
  buildConfirmedAssistantTurn,
  normalizeConfirmedStateLevel,
  type ConfirmedMemoryCandidate,
} from "./authenticatedHelpers";
import { resolveFinalConfirmedMemoryCandidates } from "./authenticatedMemoryCandidates";

type ResolvedPlan = "free" | "plus" | "pro";
type AuthenticatedModelOutput = Record<string, unknown>;
type AuthenticatedPromptInput = unknown;
type Phase5 = 1 | 2 | 3 | 4 | 5;

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

type RunHopyTurnBuiltResult = {
  reply: string;
  state: ConfirmedAssistantTurn["canonicalAssistantState"];
  notification: NotificationState;
  threadPatch: {
    id: string;
    state_level: ConfirmedAssistantTurn["currentStateLevel"];
    current_phase: ConfirmedAssistantTurn["currentPhase"];
    state_changed: ConfirmedAssistantTurn["stateChanged"];
    prev_phase: ConfirmedAssistantTurn["prevPhase"];
    prev_state_level: ConfirmedAssistantTurn["prevStateLevel"];
  };
  turnRecord: ConfirmedAssistantTurn;
  confirmed_memory_candidates: ConfirmedMemoryCandidate[];
  compassText: string | null;
  compassPrompt: string | null;
  hopy_confirmed_payload: Record<string, unknown>;
};

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

function normalizeReplyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length > 0 ? s : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function resolveModelSuccessFlag(
  modelOutput: AuthenticatedModelOutput,
): boolean | null {
  const rawModelOutput = modelOutput as Record<string, unknown>;

  if (typeof rawModelOutput.openai_ok === "boolean") {
    return rawModelOutput.openai_ok;
  }

  if (typeof rawModelOutput.ok === "boolean") {
    return rawModelOutput.ok;
  }

  return null;
}

function assertModelOutputSucceeded(
  modelOutput: AuthenticatedModelOutput,
): void {
  const resolvedModelSuccess = resolveModelSuccessFlag(modelOutput);

  if (resolvedModelSuccess === false) {
    throw new Error(
      "authenticatedTurnResult: modelOutput indicates upstream failure",
    );
  }
}

function resolveConfirmedPayload(
  modelOutput: AuthenticatedModelOutput,
): Record<string, unknown> | null {
  const rawModelOutput = modelOutput as Record<string, unknown>;

  if (isRecord(rawModelOutput.hopy_confirmed_payload)) {
    return rawModelOutput.hopy_confirmed_payload;
  }

  return null;
}

function resolveConfirmedPayloadState(
  modelOutput: AuthenticatedModelOutput,
): Record<string, unknown> | null {
  const confirmedPayload = resolveConfirmedPayload(modelOutput);
  if (!confirmedPayload) return null;

  return isRecord(confirmedPayload.state) ? confirmedPayload.state : null;
}

function resolveConfirmedPayloadCompass(
  modelOutput: AuthenticatedModelOutput,
): Record<string, unknown> | null {
  const confirmedPayload = resolveConfirmedPayload(modelOutput);
  if (!confirmedPayload) return null;

  return isRecord(confirmedPayload.compass) ? confirmedPayload.compass : null;
}

function resolveConfirmedPayloadReply(
  modelOutput: AuthenticatedModelOutput,
): string | null {
  const confirmedPayload = resolveConfirmedPayload(modelOutput);
  if (!confirmedPayload) return null;

  return normalizeReplyString(confirmedPayload.reply);
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

function resolveStateLevelValue(value: unknown): Phase5 | null {
  const resolved = normalizeConfirmedStateLevel(value);
  if (
    resolved === 1 ||
    resolved === 2 ||
    resolved === 3 ||
    resolved === 4 ||
    resolved === 5
  ) {
    return resolved;
  }

  return null;
}

function resolveRequiredCompass(params: {
  modelOutput: AuthenticatedModelOutput;
  resolvedPlan: ResolvedPlan;
  stateChanged: boolean;
}): {
  compassText: string | null;
  compassPrompt: string | null;
} {
  const { modelOutput, resolvedPlan, stateChanged } = params;

  const compassText = resolveCompassText(modelOutput);
  const compassPrompt = resolveCompassPrompt(modelOutput);

  if (resolvedPlan !== "free" && stateChanged === true) {
    if (compassText === null) {
      throw new Error(
        "authenticatedTurnResult: compassText is required when resolvedPlan is not free and state_changed is true",
      );
    }
  }

  return {
    compassText,
    compassPrompt,
  };
}

export async function buildAuthenticatedTurnResult(
  params: BuildAuthenticatedTurnResultParams,
): Promise<RunHopyTurnBuiltResult> {
  const {
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

  assertModelOutputSucceeded(modelOutput);

  const confirmedPayload = resolveConfirmedPayload(modelOutput);
  if (!confirmedPayload) {
    throw new Error(
      "authenticatedTurnResult: modelOutput.hopy_confirmed_payload is required",
    );
  }

  const confirmedPayloadState = resolveConfirmedPayloadState(modelOutput);
  if (!confirmedPayloadState) {
    throw new Error(
      "authenticatedTurnResult: modelOutput.hopy_confirmed_payload.state is required",
    );
  }

  const resolvedReply = resolveConfirmedPayloadReply(modelOutput);
  if (resolvedReply === null) {
    throw new Error(
      "authenticatedTurnResult: modelOutput.hopy_confirmed_payload.reply is required",
    );
  }

  const resolvedStateChanged = resolveStateBoolean(
    confirmedPayloadState.state_changed,
  );
  if (resolvedStateChanged === null) {
    throw new Error(
      "authenticatedTurnResult: modelOutput.hopy_confirmed_payload.state.state_changed is required",
    );
  }

  const resolvedCurrentPhase = resolveStateLevelValue(
    confirmedPayloadState.current_phase,
  );
  if (resolvedCurrentPhase === null || resolvedCurrentPhase === undefined) {
    throw new Error(
      "authenticatedTurnResult: modelOutput.hopy_confirmed_payload.state.current_phase is required",
    );
  }

  const resolvedCurrentStateLevel = resolveStateLevelValue(
    confirmedPayloadState.state_level,
  );
  if (
    resolvedCurrentStateLevel === null ||
    resolvedCurrentStateLevel === undefined
  ) {
    throw new Error(
      "authenticatedTurnResult: modelOutput.hopy_confirmed_payload.state.state_level is required",
    );
  }

  const resolvedPrevPhase = resolveStateLevelValue(
    confirmedPayloadState.prev_phase,
  );
  if (resolvedPrevPhase === null || resolvedPrevPhase === undefined) {
    throw new Error(
      "authenticatedTurnResult: modelOutput.hopy_confirmed_payload.state.prev_phase is required",
    );
  }

  const resolvedPrevStateLevel = resolveStateLevelValue(
    confirmedPayloadState.prev_state_level,
  );
  if (
    resolvedPrevStateLevel === null ||
    resolvedPrevStateLevel === undefined
  ) {
    throw new Error(
      "authenticatedTurnResult: modelOutput.hopy_confirmed_payload.state.prev_state_level is required",
    );
  }

  const { compassText, compassPrompt } = resolveRequiredCompass({
    modelOutput,
    resolvedPlan,
    stateChanged: resolvedStateChanged,
  });

  const confirmedTurn = buildConfirmedAssistantTurn({
    assistantText: resolvedReply,
    currentPhase: resolvedCurrentPhase,
    currentStateLevel: resolvedCurrentStateLevel,
    stateChanged: resolvedStateChanged,
    prevPhase: resolvedPrevPhase,
    prevStateLevel: resolvedPrevStateLevel,
  }) as ConfirmedAssistantTurn;

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

  if (compassText) {
    confirmedTurn.compassText = compassText;
  }

  if (compassPrompt !== null) {
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
    hopy_confirmed_payload: confirmedPayload,
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
5. Compass を検証して載せる
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
- hopy_confirmed_payload

Compass 観点でこのファイルの意味
このファイルは Compass の正式検証・搭載ポイントの1つ。
確定意味ペイロードの state / compass だけを正として受け取り、
RunHopyTurnBuiltResult にそのまま載せる。
下流で Compass を生成・補完・再救出しない。
*/

/*
【今回このファイルで修正したこと】
- confirmTurn の compassPrompt 型を string | undefined に合わせた。
- null をそのまま入れず、compassPrompt !== null のときだけ代入する形へそろえた。
- それ以外の実行ロジック、Compass 条件、状態 1..5 の意味、memory candidate の流れには触っていない。
*/
// このファイルの正式役割: authenticated 経路における turn 結果の正式組み立てファイル