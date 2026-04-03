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

function resolveConfirmedPayloadRecord(source: unknown): Record<string, unknown> | null {
  const record = asRecord(source);
  if (!record) return null;

  return (
    asRecord(record.hopy_confirmed_payload) ??
    asRecord(record.hopyConfirmedPayload) ??
    null
  );
}

function resolveCompassTextFromConfirmedPayload(source: unknown): string | null {
  const confirmedPayload = resolveConfirmedPayloadRecord(source);
  if (!confirmedPayload) return null;

  const confirmedCompass = asRecord(confirmedPayload.compass);

  return (
    normalizeCompassString(confirmedCompass?.text) ??
    normalizeCompassString(confirmedPayload.compassText) ??
    normalizeCompassString(confirmedPayload.compass_text)
  );
}

function resolveCompassPromptFromConfirmedPayload(source: unknown): string | null {
  const confirmedPayload = resolveConfirmedPayloadRecord(source);
  if (!confirmedPayload) return null;

  const confirmedCompass = asRecord(confirmedPayload.compass);

  return (
    normalizeCompassString(confirmedCompass?.prompt) ??
    normalizeCompassString(confirmedPayload.compassPrompt) ??
    normalizeCompassString(confirmedPayload.compass_prompt)
  );
}

function resolveCompassTextFromConfirmedTurn(
  confirmedTurn: ConfirmedAssistantTurn,
): string | null {
  return (
    normalizeCompassString(confirmedTurn.compass?.text) ??
    normalizeCompassString(confirmedTurn.compassText) ??
    resolveCompassTextFromConfirmedPayload(confirmedTurn)
  );
}

function resolveCompassPromptFromConfirmedTurn(
  confirmedTurn: ConfirmedAssistantTurn,
): string | null {
  return (
    normalizeCompassString(confirmedTurn.compass?.prompt) ??
    normalizeCompassString(confirmedTurn.compassPrompt) ??
    resolveCompassPromptFromConfirmedPayload(confirmedTurn)
  );
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
  const resolvedStateChanged = params.confirmedTurn.stateChanged === true;

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
    stateChanged: resolvedStateChanged,
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
*/

/*
【今回このファイルで修正したこと】
- Compass の取得元を、確定意味ペイロードとそこから作られた confirmedTurn のみに限定しました。
- ui_effects、turnRecord、直接の compassText など、唯一の正ではない広い探索経路を削除しました。
- stateChanged は confirmedTurn.stateChanged だけを正として維持し、このファイル内で再判定しない形に固定しました。
*/
// このファイルの正式役割: authenticated postTurn の Compass 解決専用ファイル