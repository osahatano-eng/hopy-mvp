// /app/api/chat/_lib/route/authenticatedPostTurnCompass.ts

type ResolvedPlan = "free" | "plus" | "pro";

type ConfirmedAssistantTurn = {
  stateChanged?: boolean | null;
  compassText?: string | null;
  compassPrompt?: string | null;
  compass?:
    | {
        text?: string | null;
        prompt?: string | null;
      }
    | null;
  hopy_confirmed_payload?: unknown;
  hopyConfirmedPayload?: unknown;
  [key: string]: unknown;
};

function normalizeCompassString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length > 0 ? s : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function resolveConfirmedPayloadRecord(
  source: unknown,
): Record<string, unknown> | null {
  const record = asRecord(source);
  if (!record) return null;

  return (
    asRecord(record.hopy_confirmed_payload) ??
    asRecord(record.hopyConfirmedPayload) ??
    null
  );
}

function resolveConfirmedStateRecord(
  source: unknown,
): Record<string, unknown> | null {
  const confirmedPayload = resolveConfirmedPayloadRecord(source);
  if (!confirmedPayload) return null;

  return asRecord(confirmedPayload.state);
}

function resolveStateChangedFromConfirmedPayload(source: unknown): boolean | null {
  const confirmedState = resolveConfirmedStateRecord(source);
  if (!confirmedState) return null;

  return typeof confirmedState.state_changed === "boolean"
    ? confirmedState.state_changed
    : null;
}

function resolveCompassRecordFromConfirmedPayload(
  source: unknown,
): Record<string, unknown> | null {
  const confirmedPayload = resolveConfirmedPayloadRecord(source);
  if (!confirmedPayload) return null;

  return asRecord(confirmedPayload.compass);
}

function resolveCompassTextFromConfirmedPayload(source: unknown): string | null {
  const confirmedCompass = resolveCompassRecordFromConfirmedPayload(source);
  if (!confirmedCompass) return null;

  return normalizeCompassString(confirmedCompass.text);
}

function resolveCompassPromptFromConfirmedPayload(
  source: unknown,
): string | null {
  const confirmedCompass = resolveCompassRecordFromConfirmedPayload(source);
  if (!confirmedCompass) return null;

  return normalizeCompassString(confirmedCompass.prompt);
}

function resolveCompassTextFromConfirmedTurn(
  confirmedTurn: ConfirmedAssistantTurn,
): string | null {
  return (
    resolveCompassTextFromConfirmedPayload(confirmedTurn) ??
    normalizeCompassString(confirmedTurn.compass?.text) ??
    normalizeCompassString(confirmedTurn.compassText)
  );
}

function resolveCompassPromptFromConfirmedTurn(
  confirmedTurn: ConfirmedAssistantTurn,
): string | null {
  return (
    resolveCompassPromptFromConfirmedPayload(confirmedTurn) ??
    normalizeCompassString(confirmedTurn.compass?.prompt) ??
    normalizeCompassString(confirmedTurn.compassPrompt)
  );
}

function resolveStateChangedInvariant(params: {
  runTurnResult: unknown;
  confirmedTurn: ConfirmedAssistantTurn;
}): boolean {
  const confirmedTurnStateChanged = params.confirmedTurn.stateChanged === true;
  const runTurnPayloadStateChanged =
    resolveStateChangedFromConfirmedPayload(params.runTurnResult);
  const confirmedTurnPayloadStateChanged =
    resolveStateChangedFromConfirmedPayload(params.confirmedTurn);

  if (runTurnPayloadStateChanged !== null) {
    return runTurnPayloadStateChanged === true;
  }

  if (confirmedTurnPayloadStateChanged !== null) {
    return confirmedTurnPayloadStateChanged === true;
  }

  return confirmedTurnStateChanged;
}

function resolveCompassText(params: {
  runTurnResult: unknown;
  confirmedTurn: ConfirmedAssistantTurn;
}): string | null {
  return (
    resolveCompassTextFromConfirmedPayload(params.runTurnResult) ??
    resolveCompassTextFromConfirmedTurn(params.confirmedTurn)
  );
}

function resolveCompassPrompt(params: {
  runTurnResult: unknown;
  confirmedTurn: ConfirmedAssistantTurn;
}): string | null {
  return (
    resolveCompassPromptFromConfirmedPayload(params.runTurnResult) ??
    resolveCompassPromptFromConfirmedTurn(params.confirmedTurn)
  );
}

export function resolveConfirmedCompassArtifacts(params: {
  resolvedPlan: ResolvedPlan;
  runTurnResult: unknown;
  confirmedTurn: ConfirmedAssistantTurn;
}): {
  stateChanged: boolean;
  compassText: string | null;
  compassPrompt: string | null;
} {
  const resolvedStateChanged = resolveStateChangedInvariant({
    runTurnResult: params.runTurnResult,
    confirmedTurn: params.confirmedTurn,
  });

  if (params.resolvedPlan === "free") {
    return {
      stateChanged: resolvedStateChanged,
      compassText: null,
      compassPrompt: null,
    };
  }

  if (!resolvedStateChanged) {
    return {
      stateChanged: false,
      compassText: null,
      compassPrompt: null,
    };
  }

  const resolvedCompassText = resolveCompassText({
    runTurnResult: params.runTurnResult,
    confirmedTurn: params.confirmedTurn,
  });

  const resolvedCompassPrompt = resolveCompassPrompt({
    runTurnResult: params.runTurnResult,
    confirmedTurn: params.confirmedTurn,
  });

  return {
    stateChanged: true,
    compassText: resolvedCompassText,
    compassPrompt: resolvedCompassPrompt,
  };
}

/*
このファイルの正式役割
authenticated postTurn の Compass 解決専用ファイル。
runTurnResult と confirmedTurn から、
Compass text / prompt を唯一の正を壊さず解決し、
plan と stateChanged 条件に従って最終利用可能な Compass 情報を返す。
この層は Compass を新規生成しない。
この層は state_changed を再計算しない。
この層は確定意味ペイロード由来の state_changed / compass を優先して返す。
*/

/*
【今回このファイルで修正したこと】
- stateChanged の参照元を confirmedTurn.stateChanged 単独ではなく、確定意味ペイロード内の state.state_changed 優先に修正しました。
- Compass の取得元を、確定意味ペイロード内の compass を最優先に固定しました。
- hopy_confirmed_payload 内に compass がない場合だけ、confirmedTurn に載っている確定済み compass を参照する形に絞りました。
- stateChanged=false のときは paid plan でも Compass を絶対に返さない形に固定しました。
- Free では stateChanged の正は維持しつつ、Compass は常に null を返す形を維持しました。
- fallback 文言の生成や本文由来の補完は追加していません。
*/

/* /app/api/chat/_lib/route/authenticatedPostTurnCompass.ts */
// このファイルの正式役割: authenticated postTurn の Compass 解決専用ファイル