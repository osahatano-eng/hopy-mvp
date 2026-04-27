// /app/api/chat/_lib/route/runHopyTurnBuiltResult.ts

export type RunHopyTurnState = {
  current_phase?: unknown;
  state_level?: unknown;
  prev_phase?: unknown;
  prev_state_level?: unknown;
  state_changed?: unknown;
  label?: unknown;
  prev_label?: unknown;
} | null;

export type RunHopyTurnThreadPatch = {
  id?: unknown;
  title?: unknown;
  state_level?: unknown;
  current_phase?: unknown;
  state_changed?: unknown;
  prev_phase?: unknown;
  prev_state_level?: unknown;
  updated_at?: unknown;
  last_assistant_at?: unknown;
} | null;

export type RunHopyTurnNotification = {
  unread_count?: unknown;
  updated_at?: unknown;
} | null;

export type RunHopyTurnSpeedAudit = Record<string, unknown> | null;

export type RunHopyTurnBuiltResult = {
  reply?: unknown;
  state?: RunHopyTurnState;
  threadPatch?: RunHopyTurnThreadPatch;
  notification?: RunHopyTurnNotification;
  debug?: unknown;
  turnRecord?: unknown;
  memoryRows?: unknown;
  dashboardSignalRows?: unknown;
  expressionCandidateRows?: unknown;
  confirmed_memory_candidates?: unknown;
  state_changed?: unknown;
  compassPrompt?: unknown;
  compassText?: unknown;
  hopy_confirmed_payload?: unknown;
  futureChainContext?: unknown;
  future_chain_context?: unknown;
  speed_audit?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeState(value: unknown): RunHopyTurnState {
  if (!isRecord(value)) return null;

  return {
    current_phase: value.current_phase,
    state_level: value.state_level,
    prev_phase: value.prev_phase,
    prev_state_level: value.prev_state_level,
    state_changed: value.state_changed,
    label: value.label,
    prev_label: value.prev_label,
  };
}

function normalizeThreadPatch(value: unknown): RunHopyTurnThreadPatch {
  if (!isRecord(value)) return null;

  return {
    id: value.id,
    title: value.title,
    state_level: value.state_level,
    current_phase: value.current_phase,
    state_changed: value.state_changed,
    prev_phase: value.prev_phase,
    prev_state_level: value.prev_state_level,
    updated_at: value.updated_at,
    last_assistant_at: value.last_assistant_at,
  };
}

function normalizeNotification(value: unknown): RunHopyTurnNotification {
  if (!isRecord(value)) return null;

  return {
    unread_count: value.unread_count,
    updated_at: value.updated_at,
  };
}

function normalizeSpeedAudit(value: unknown): RunHopyTurnSpeedAudit {
  if (!isRecord(value)) return null;
  return value;
}

function normalizeCompassString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length > 0 ? s : null;
}

function normalizeReply(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length > 0 ? s : null;
}

function resolveConfirmedPayloadRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (!isRecord(value)) return null;

  const payload = value.hopy_confirmed_payload;
  return isRecord(payload) ? payload : null;
}

function resolveConfirmedPayloadState(
  source: Record<string, unknown> | null,
): RunHopyTurnState {
  if (!source) return null;

  const confirmedPayload = resolveConfirmedPayloadRecord(source);
  if (!confirmedPayload) return null;

  return normalizeState(confirmedPayload.state);
}

function resolveConfirmedPayloadReply(
  source: Record<string, unknown> | null,
): string | null {
  if (!source) return null;

  const confirmedPayload = resolveConfirmedPayloadRecord(source);
  if (!confirmedPayload) return null;

  return normalizeReply(confirmedPayload.reply);
}

function resolveCompassTextFromConfirmedPayload(
  source: Record<string, unknown> | null,
): string | null {
  if (!source) return null;

  const confirmedPayload = resolveConfirmedPayloadRecord(source);
  if (!confirmedPayload) return null;

  const confirmedCompass = isRecord(confirmedPayload.compass)
    ? confirmedPayload.compass
    : null;

  return normalizeCompassString(confirmedCompass?.text);
}

function resolveCompassPromptFromConfirmedPayload(
  source: Record<string, unknown> | null,
): string | null {
  if (!source) return null;

  const confirmedPayload = resolveConfirmedPayloadRecord(source);
  if (!confirmedPayload) return null;

  const confirmedCompass = isRecord(confirmedPayload.compass)
    ? confirmedPayload.compass
    : null;

  return normalizeCompassString(confirmedCompass?.prompt);
}

export function normalizeBuiltResult(
  value: RunHopyTurnBuiltResult | null | undefined,
): RunHopyTurnBuiltResult {
  const source = isRecord(value) ? value : {};
  const confirmedPayloadRecord = resolveConfirmedPayloadRecord(source);
  const confirmedReply = resolveConfirmedPayloadReply(source);
  const confirmedState = resolveConfirmedPayloadState(source);

  return {
    reply: confirmedReply,
    state: confirmedState,
    threadPatch: normalizeThreadPatch(source.threadPatch),
    notification: normalizeNotification(source.notification),
    debug: source.debug,
    turnRecord: source.turnRecord,
    memoryRows: source.memoryRows,
    dashboardSignalRows: source.dashboardSignalRows,
    expressionCandidateRows: source.expressionCandidateRows,
    confirmed_memory_candidates: source.confirmed_memory_candidates,
    state_changed: confirmedState?.state_changed ?? false,
    compassPrompt: resolveCompassPromptFromConfirmedPayload(source),
    compassText: resolveCompassTextFromConfirmedPayload(source),
    hopy_confirmed_payload: confirmedPayloadRecord,
    futureChainContext: source.futureChainContext,
    future_chain_context: source.future_chain_context,
    speed_audit: normalizeSpeedAudit(source.speed_audit),
  };
}

function mergeThreadPatchWithState(
  threadPatch: RunHopyTurnThreadPatch,
  state: RunHopyTurnState,
): RunHopyTurnThreadPatch {
  if (!threadPatch && !state) return null;
  if (!threadPatch) {
    return state
      ? {
          state_level: state.state_level,
          current_phase: state.current_phase,
          state_changed: state.state_changed,
          prev_phase: state.prev_phase,
          prev_state_level: state.prev_state_level,
        }
      : null;
  }

  if (!state) return threadPatch;

  return {
    ...threadPatch,
    state_level:
      typeof threadPatch.state_level === "undefined"
        ? state.state_level
        : threadPatch.state_level,
    current_phase:
      typeof threadPatch.current_phase === "undefined"
        ? state.current_phase
        : threadPatch.current_phase,
    state_changed:
      typeof threadPatch.state_changed === "undefined"
        ? state.state_changed
        : threadPatch.state_changed,
    prev_phase:
      typeof threadPatch.prev_phase === "undefined"
        ? state.prev_phase
        : threadPatch.prev_phase,
    prev_state_level:
      typeof threadPatch.prev_state_level === "undefined"
        ? state.prev_state_level
        : threadPatch.prev_state_level,
  };
}

function assertStateMatchesConfirmedPayload(params: {
  state: RunHopyTurnState;
  confirmedState: RunHopyTurnState;
}): string | null {
  const { state, confirmedState } = params;

  if (!state || !confirmedState) {
    return null;
  }

  if (
    state.current_phase !== confirmedState.current_phase ||
    state.state_level !== confirmedState.state_level ||
    state.prev_phase !== confirmedState.prev_phase ||
    state.prev_state_level !== confirmedState.prev_state_level ||
    state.state_changed !== confirmedState.state_changed
  ) {
    return "runHopyTurn: built result state must match hopy_confirmed_payload.state";
  }

  return null;
}

function assertReplyMatchesConfirmedPayload(params: {
  reply: string | null;
  confirmedReply: string | null;
}): string | null {
  const { reply, confirmedReply } = params;

  if (!reply || !confirmedReply) {
    return null;
  }

  if (reply !== confirmedReply) {
    return "runHopyTurn: built result reply must match hopy_confirmed_payload.reply";
  }

  return null;
}

export function finalizeBuiltResult(
  result: RunHopyTurnBuiltResult,
): RunHopyTurnBuiltResult {
  const source = isRecord(result) ? result : null;
  const confirmedPayloadRecord = resolveConfirmedPayloadRecord(source);
  const confirmedState = resolveConfirmedPayloadState(source);
  const confirmedReply = resolveConfirmedPayloadReply(source);

  const persistedThreadPatch = mergeThreadPatchWithState(
    result.threadPatch ?? null,
    confirmedState,
  );

  return {
    ...result,
    reply: confirmedReply,
    state: confirmedState,
    threadPatch: persistedThreadPatch,
    hopy_confirmed_payload: confirmedPayloadRecord,
    futureChainContext: result.futureChainContext,
    future_chain_context: result.future_chain_context,
    state_changed: confirmedState?.state_changed ?? false,
    compassText: resolveCompassTextFromConfirmedPayload(source),
    compassPrompt: resolveCompassPromptFromConfirmedPayload(source),
  };
}

function hasCanonicalStateShape(state: RunHopyTurnState): boolean {
  if (!state) return false;

  const currentPhase = state.current_phase;
  const stateLevel = state.state_level;
  const prevPhase = state.prev_phase;
  const prevStateLevel = state.prev_state_level;
  const stateChanged = state.state_changed;

  const isPhaseValue = (value: unknown) =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5;

  return (
    isPhaseValue(currentPhase) &&
    isPhaseValue(stateLevel) &&
    isPhaseValue(prevPhase) &&
    isPhaseValue(prevStateLevel) &&
    typeof stateChanged === "boolean"
  );
}

function hasConfirmedPayloadStateShape(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  return hasCanonicalStateShape(normalizeState(payload.state));
}

function hasConfirmedPayloadReplyShape(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  return normalizeReply(payload.reply) !== null;
}

export function resolveBuiltResultFailure(
  result: RunHopyTurnBuiltResult,
): string | null {
  const reply = normalizeReply(result.reply);
  const confirmedState = result.state ?? null;
  const hasCompassText = result.compassText !== null;
  const hasCompassPrompt = result.compassPrompt !== null;
  const confirmedPayload = resolveConfirmedPayloadRecord(
    isRecord(result) ? result : null,
  );
  const confirmedPayloadState = normalizeState(confirmedPayload?.state);
  const confirmedPayloadReply = normalizeReply(confirmedPayload?.reply);

  if (!hasConfirmedPayloadReplyShape(result.hopy_confirmed_payload)) {
    return "runHopyTurn: built result hopy_confirmed_payload.reply is required";
  }

  if (!reply) {
    return "runHopyTurn: built result reply is required";
  }

  if (!hasCanonicalStateShape(confirmedState)) {
    return "runHopyTurn: built result state is required";
  }

  if (!hasConfirmedPayloadStateShape(result.hopy_confirmed_payload)) {
    return "runHopyTurn: built result hopy_confirmed_payload.state is required";
  }

  if (!confirmedState) {
    return "runHopyTurn: built result state is required";
  }

  const replyMismatchError = assertReplyMatchesConfirmedPayload({
    reply,
    confirmedReply: confirmedPayloadReply,
  });
  if (replyMismatchError) {
    return replyMismatchError;
  }

  const stateMismatchError = assertStateMatchesConfirmedPayload({
    state: confirmedState,
    confirmedState: confirmedPayloadState,
  });
  if (stateMismatchError) {
    return stateMismatchError;
  }

  if (hasCompassText !== hasCompassPrompt) {
    if (!hasCompassText) {
      return "runHopyTurn: compassText is required when compassPrompt exists";
    }

    return "runHopyTurn: compassPrompt is required when compassText exists";
  }

  return null;
}

export function buildFailedRunHopyTurnResult(
  speedAudit: RunHopyTurnSpeedAudit = null,
): RunHopyTurnBuiltResult {
  return {
    reply: "",
    state: null,
    threadPatch: null,
    notification: null,
    debug: null,
    turnRecord: null,
    memoryRows: null,
    dashboardSignalRows: null,
    expressionCandidateRows: null,
    confirmed_memory_candidates: null,
    state_changed: false,
    compassPrompt: null,
    compassText: null,
    hopy_confirmed_payload: null,
    futureChainContext: null,
    future_chain_context: null,
    speed_audit: speedAudit,
  };
}

/*
このファイルの正式役割
runHopyTurn における builtResult の整形・補完・検証をまとめる責務ファイル。
buildTurnResult から返された結果を normalizeBuiltResult で正規化し、
finalizeBuiltResult で state と threadPatch の整合を補完し、
resolveBuiltResultFailure で回答成立条件を検証し、
buildFailedRunHopyTurnResult で失敗時の標準結果を返す。

この層は HOPY回答○ の唯一の正を生成しない。
hopy_confirmed_payload.state と hopy_confirmed_payload.compass を
唯一の正として受け取り、そのまま整形・検証だけを行う。
*/

/*
【今回このファイルで修正したこと】
- normalizeBuiltResult(...) で reply / state / state_changed を hopy_confirmed_payload のみから確定する形に固定しました。
- source.reply / source.state への fallback を削除しました。
- finalizeBuiltResult(...) でも最終 reply / state / state_changed を hopy_confirmed_payload 起点に固定しました。
- resolveBuiltResultFailure(...) に hopy_confirmed_payload.reply 必須検証と reply 一致検証を追加しました。
- これにより、唯一の正が欠けた builtResult を見かけ上だけ成立させて後段へ流す経路を止めました。
- buildTurnResult から来た futureChainContext / future_chain_context を normalize / finalize 後も保持し、authenticatedPostTurn.ts 側へ中継できるようにしました。
- Future Chain の意味生成、state_changed 再判定、Compass 判定、HOPY回答○判定、DB保存、UI表示はこのファイルでは行っていません。
*/

/* /app/api/chat/_lib/route/runHopyTurnBuiltResult.ts */
// このファイルの正式役割: runHopyTurn における builtResult の整形・補完・検証をまとめる責務ファイル