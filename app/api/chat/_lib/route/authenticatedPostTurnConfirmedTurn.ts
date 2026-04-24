// /app/api/chat/_lib/route/authenticatedPostTurnConfirmedTurn.ts

type RunHopyTurnBuiltResult = Record<string, any>;
type HopyStateLevel = 1 | 2 | 3 | 4 | 5;

type CanonicalAssistantState = {
  current_phase: HopyStateLevel;
  state_level: HopyStateLevel;
  prev_phase: HopyStateLevel;
  prev_state_level: HopyStateLevel;
  state_changed: boolean;
};

type ConfirmedAssistantTurnForResolve = {
  assistantText: string;
  prevPhase: HopyStateLevel;
  prevStateLevel: HopyStateLevel;
  currentPhase: HopyStateLevel;
  currentStateLevel: HopyStateLevel;
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

export type ResolveAuthenticatedPostTurnConfirmedTurnParams = {
  runTurnResult: RunHopyTurnBuiltResult | null | undefined;
  confirmedTurn: ConfirmedAssistantTurnForResolve;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeStateLevel(value: unknown): HopyStateLevel | null {
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

export function resolveAuthenticatedPostTurnConfirmedTurn(
  params: ResolveAuthenticatedPostTurnConfirmedTurnParams,
): ConfirmedAssistantTurnForResolve {
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

/*
【このファイルの正式役割】
authenticated 経路の postTurn confirmedTurn 同期責務ファイル。
runTurnResult.hopy_confirmed_payload と既存 confirmedTurn を受け取り、
回答本文、状態値、state_changed、Compass、thread_summary を
確定済み payload 優先で同期した ConfirmedAssistantTurn を返す。
このファイルは hopy_confirmed_payload の確定値を使うだけで、
state_changed、state_level、current_phase、prev系、Compass、HOPY回答○を再判定しない。

【今回このファイルで修正したこと】
- /app/api/chat/_lib/route/authenticatedPostTurn.ts から切り出すための
  confirmedTurn 同期責務を新規ファイルとして作成した。
- asRecord(...)、
  normalizeStateLevel(...)、
  normalizeBoolean(...)、
  normalizeNonEmptyString(...)、
  normalizeThreadSummary(...)、
  normalizeCompassText(...)、
  normalizeCompassPrompt(...)、
  resolveAuthenticatedPostTurnConfirmedTurn(...) を定義した。
- 既存の resolveConfirmedTurnFromRunTurnResult(...) と同じ同期順・fallback順を維持した。
- 親ファイル接続はまだ行っていない。
- state_changed、state_level、current_phase、prev系、Compass、HOPY回答○、memory、
  learning、thread_summary保存、audit、thread title、Future Chain、payload生成本体には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnConfirmedTurn.ts
*/