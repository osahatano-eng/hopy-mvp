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

function resolveCompassTextFromSource(
  source: Record<string, unknown> | null,
): string | null {
  if (!source) return null;

  const directCompass = isRecord(source.compass) ? source.compass : null;
  const directTurnRecord = isRecord(source.turnRecord) ? source.turnRecord : null;
  const directTurnRecordCompass = isRecord(directTurnRecord?.compass)
    ? directTurnRecord.compass
    : null;

  const uiEffects = isRecord(source.ui_effects)
    ? source.ui_effects
    : isRecord(source.uiEffects)
      ? source.uiEffects
      : null;
  const uiEffectsCompass = isRecord(uiEffects?.compass) ? uiEffects.compass : null;

  const confirmedPayload = isRecord(source.hopy_confirmed_payload)
    ? source.hopy_confirmed_payload
    : isRecord(source.hopyConfirmedPayload)
      ? source.hopyConfirmedPayload
      : null;
  const confirmedCompass = isRecord(confirmedPayload?.compass)
    ? confirmedPayload.compass
    : null;
  const confirmedUiEffects = isRecord(confirmedPayload?.ui_effects)
    ? confirmedPayload.ui_effects
    : isRecord(confirmedPayload?.uiEffects)
      ? confirmedPayload.uiEffects
      : null;
  const confirmedUiEffectsCompass = isRecord(confirmedUiEffects?.compass)
    ? confirmedUiEffects.compass
    : null;

  return (
    normalizeCompassString(source.compassText) ??
    normalizeCompassString(source.compass_text) ??
    normalizeCompassString(directCompass?.text) ??
    normalizeCompassString(directTurnRecord?.compassText) ??
    normalizeCompassString(directTurnRecord?.compass_text) ??
    normalizeCompassString(directTurnRecordCompass?.text) ??
    normalizeCompassString(uiEffectsCompass?.text) ??
    normalizeCompassString(confirmedPayload?.compassText) ??
    normalizeCompassString(confirmedPayload?.compass_text) ??
    normalizeCompassString(confirmedCompass?.text) ??
    normalizeCompassString(confirmedUiEffectsCompass?.text)
  );
}

function resolveCompassPromptFromSource(
  source: Record<string, unknown> | null,
): string | null {
  if (!source) return null;

  const directCompass = isRecord(source.compass) ? source.compass : null;
  const directTurnRecord = isRecord(source.turnRecord) ? source.turnRecord : null;
  const directTurnRecordCompass = isRecord(directTurnRecord?.compass)
    ? directTurnRecord.compass
    : null;

  const uiEffects = isRecord(source.ui_effects)
    ? source.ui_effects
    : isRecord(source.uiEffects)
      ? source.uiEffects
      : null;
  const uiEffectsCompass = isRecord(uiEffects?.compass) ? uiEffects.compass : null;

  const confirmedPayload = isRecord(source.hopy_confirmed_payload)
    ? source.hopy_confirmed_payload
    : isRecord(source.hopyConfirmedPayload)
      ? source.hopyConfirmedPayload
      : null;
  const confirmedCompass = isRecord(confirmedPayload?.compass)
    ? confirmedPayload.compass
    : null;
  const confirmedUiEffects = isRecord(confirmedPayload?.ui_effects)
    ? confirmedPayload.ui_effects
    : isRecord(confirmedPayload?.uiEffects)
      ? confirmedPayload.uiEffects
      : null;
  const confirmedUiEffectsCompass = isRecord(confirmedUiEffects?.compass)
    ? confirmedUiEffects.compass
    : null;

  return (
    normalizeCompassString(source.compassPrompt) ??
    normalizeCompassString(source.compass_prompt) ??
    normalizeCompassString(directCompass?.prompt) ??
    normalizeCompassString(directTurnRecord?.compassPrompt) ??
    normalizeCompassString(directTurnRecord?.compass_prompt) ??
    normalizeCompassString(directTurnRecordCompass?.prompt) ??
    normalizeCompassString(uiEffectsCompass?.prompt) ??
    normalizeCompassString(confirmedPayload?.compassPrompt) ??
    normalizeCompassString(confirmedPayload?.compass_prompt) ??
    normalizeCompassString(confirmedCompass?.prompt) ??
    normalizeCompassString(confirmedUiEffectsCompass?.prompt)
  );
}

export function normalizeBuiltResult(
  value: RunHopyTurnBuiltResult | null | undefined,
): RunHopyTurnBuiltResult {
  const source = isRecord(value) ? value : {};

  return {
    reply: source.reply,
    state: normalizeState(source.state),
    threadPatch: normalizeThreadPatch(source.threadPatch),
    notification: normalizeNotification(source.notification),
    debug: source.debug,
    turnRecord: source.turnRecord,
    memoryRows: source.memoryRows,
    dashboardSignalRows: source.dashboardSignalRows,
    expressionCandidateRows: source.expressionCandidateRows,
    confirmed_memory_candidates: source.confirmed_memory_candidates,
    state_changed: source.state_changed,
    compassPrompt: resolveCompassPromptFromSource(source),
    compassText: resolveCompassTextFromSource(source),
    hopy_confirmed_payload: source.hopy_confirmed_payload,
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

export function finalizeBuiltResult(
  result: RunHopyTurnBuiltResult,
): RunHopyTurnBuiltResult {
  const confirmedState = result.state ?? null;
  const persistedThreadPatch = mergeThreadPatchWithState(
    result.threadPatch ?? null,
    confirmedState,
  );

  return {
    ...result,
    state: confirmedState,
    threadPatch: persistedThreadPatch,
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

export function resolveBuiltResultFailure(
  result: RunHopyTurnBuiltResult,
): string | null {
  const reply = normalizeReply(result.reply);
  const confirmedState = result.state ?? null;
  const hasCompassText = result.compassText !== null;
  const hasCompassPrompt = result.compassPrompt !== null;

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
*/

/*
このファイルの正式役割
runHopyTurn における builtResult の整形・補完・検証をまとめる責務ファイル。
buildTurnResult から返された結果を normalizeBuiltResult で正規化し、
finalizeBuiltResult で state と threadPatch の整合を補完し、
resolveBuiltResultFailure で回答成立条件を検証し、
buildFailedRunHopyTurnResult で失敗時の標準結果を返す。
*/

/*
【今回このファイルで修正したこと】
- runHopyTurn.ts 内にあった builtResult の normalize / finalize / validation / failed result 生成責務を、この新規ファイルへ切り出しました。
- Compass 参照元の吸い上げロジックもこの責務へ移し、親ファイルから builtResult 整形本体を外せる受け皿にしました。
- HOPY唯一の正である state / confirmed payload の意味生成は増やさず、受け取った値の整形・検証だけに限定しています。
- finalizeBuiltResult() で result.threadPatch ?? null を渡すようにし、undefined のまま mergeThreadPatchWithState() へ入る build error を止めました。
- resolveBuiltResultFailure() で result.state ?? null を confirmedState に受け直し、undefined のまま hasCanonicalStateShape() へ入る build error を止めました。
- confirmedState の null 可能性を残したまま state_changed を読まないように、null 明示ガードを追加しました。
- state_changed=true のときに Compass を無条件必須としていた判定をやめ、Compass が存在する場合だけ text/prompt の片方欠落を失敗扱いにするよう修正しました。
*/

/*
このファイルの正式役割
runHopyTurn における builtResult の整形・補完・検証をまとめる責務ファイル。
*/

/*
【今回このファイルで修正したこと】
Freeでも state_changed=true になりうるのに、Compass を無条件必須にしていた失敗判定をやめました。
Compass がある場合だけ text/prompt の整合を確認する形へ変更しました。
*/