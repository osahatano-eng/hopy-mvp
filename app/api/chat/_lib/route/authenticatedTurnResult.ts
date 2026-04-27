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
  compass?:
    | {
        text: string;
        prompt: string | null;
      }
    | undefined;
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
  futureChainContext?: unknown;
  future_chain_context?: unknown;
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

function resolveFutureChainContext(
  confirmedPayload: Record<string, unknown>,
): unknown {
  if (
    Object.prototype.hasOwnProperty.call(
      confirmedPayload,
      "future_chain_context",
    )
  ) {
    return confirmedPayload.future_chain_context;
  }

  return undefined;
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
    compassText,
    compassPrompt,
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

  const futureChainContext = resolveFutureChainContext(confirmedPayload);

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
    ...(typeof futureChainContext === "undefined"
      ? {}
      : {
          futureChainContext,
          future_chain_context: futureChainContext,
        }),
  };
}

export default buildAuthenticatedTurnResult;

/*
【このファイルの正式役割】
authenticated 経路における turn 結果の正式組み立てファイル。
modelOutput を受けて、
1. hopy_confirmed_payload を唯一の正として受け取る
2. state を 1..5 で正規化する
3. confirmedTurn を作る
4. notification を決める
5. memory candidate を確定する
6. Compass を検証して載せる
7. hopy_confirmed_payload.future_chain_context が存在する場合だけ runTurnResult へ中継する
8. RunHopyTurnBuiltResult を返す

このファイルは state_changed / state_level / current_phase / prev系を再判定しない。
このファイルは Compass を新規生成しない。
このファイルは Future Chain の意味生成・カテゴリ生成・owner_handoff生成・recipient_support検索をしない。
このファイルは hopy_confirmed_payload.future_chain_context を作らない。
受け取った future_chain_context が存在する場合だけ、後段へ渡す。

【今回このファイルで修正したこと】
- RunHopyTurnBuiltResult に futureChainContext / future_chain_context を追加しました。
- hopy_confirmed_payload.future_chain_context が存在する場合だけ読み取る resolveFutureChainContext(...) を追加しました。
- buildAuthenticatedTurnResult(...) の返却値に futureChainContext / future_chain_context を中継するようにしました。
- Future Chain の意味生成・カテゴリ生成・4項目生成・保存判定・DB保存・UI判定は追加していません。
- state_changed、state_level、current_phase、prev系、Compass表示可否、HOPY回答○表示可否は再判定していません。

/app/api/chat/_lib/route/authenticatedTurnResult.ts
*/