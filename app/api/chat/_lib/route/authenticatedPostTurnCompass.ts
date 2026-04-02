// /app/api/chat/_lib/route/authenticatedPostTurnCompass.ts

type ResolvedPlan = "free" | "plus" | "pro";

type ConfirmedAssistantTurn = {
  stateChanged?: boolean | null;
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

function resolveCompassTextFromSource(
  source: Record<string, unknown> | null,
): string | null {
  if (!source) return null;

  const directCompass = asRecord(source.compass);
  const directTurnRecord = asRecord(source.turnRecord);
  const directTurnRecordCompass = asRecord(directTurnRecord?.compass);

  const uiEffects = asRecord(source.ui_effects) ?? asRecord(source.uiEffects);
  const uiEffectsCompass = asRecord(uiEffects?.compass);

  const confirmedPayload =
    asRecord(source.hopy_confirmed_payload) ??
    asRecord(source.hopyConfirmedPayload);
  const confirmedCompass = asRecord(confirmedPayload?.compass);
  const confirmedUiEffects =
    asRecord(confirmedPayload?.ui_effects) ??
    asRecord(confirmedPayload?.uiEffects);
  const confirmedUiEffectsCompass = asRecord(confirmedUiEffects?.compass);

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

  const directCompass = asRecord(source.compass);
  const directTurnRecord = asRecord(source.turnRecord);
  const directTurnRecordCompass = asRecord(directTurnRecord?.compass);

  const uiEffects = asRecord(source.ui_effects) ?? asRecord(source.uiEffects);
  const uiEffectsCompass = asRecord(uiEffects?.compass);

  const confirmedPayload =
    asRecord(source.hopy_confirmed_payload) ??
    asRecord(source.hopyConfirmedPayload);
  const confirmedCompass = asRecord(confirmedPayload?.compass);
  const confirmedUiEffects =
    asRecord(confirmedPayload?.ui_effects) ??
    asRecord(confirmedPayload?.uiEffects);
  const confirmedUiEffectsCompass = asRecord(confirmedUiEffects?.compass);

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

function resolveRunTurnCompassText(result: unknown): string | null {
  return resolveCompassTextFromSource(asRecord(result ?? null));
}

function resolveRunTurnCompassPrompt(result: unknown): string | null {
  return resolveCompassPromptFromSource(asRecord(result ?? null));
}

function resolveConfirmedTurnCompassText(
  confirmedTurn: ConfirmedAssistantTurn,
): string | null {
  return resolveCompassTextFromSource(asRecord(confirmedTurn));
}

function resolveConfirmedTurnCompassPrompt(
  confirmedTurn: ConfirmedAssistantTurn,
): string | null {
  return resolveCompassPromptFromSource(asRecord(confirmedTurn));
}

function assertConfirmedCompassContract(params: {
  resolvedPlan: ResolvedPlan;
  confirmedTurn: ConfirmedAssistantTurn;
  compassText: string | null;
}): void {
  if (params.resolvedPlan === "free") {
    return;
  }

  if (params.confirmedTurn.stateChanged !== true) {
    return;
  }

  if (!params.compassText) {
    throw new Error(
      "authenticatedPostTurn: compassText is required when resolvedPlan is not free and confirmedTurn.stateChanged is true",
    );
  }
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

  const resolvedCompassText =
    resolveRunTurnCompassText(params.runTurnResult) ??
    resolveConfirmedTurnCompassText(params.confirmedTurn);

  const resolvedCompassPrompt =
    resolveRunTurnCompassPrompt(params.runTurnResult) ??
    resolveConfirmedTurnCompassPrompt(params.confirmedTurn);

  assertConfirmedCompassContract({
    resolvedPlan: params.resolvedPlan,
    confirmedTurn: params.confirmedTurn,
    compassText: resolvedCompassText,
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
- ./authenticatedHelpers から export されていない ConfirmedAssistantTurn を import していたため、その import を削除しました。
- このファイルで実際に必要なのは stateChanged とレコード参照だけなので、最小限の local type を定義しました。
- Compass の抽出順、契約確認、plan と stateChanged 条件のロジックは変えていません。
*/
// このファイルの正式役割: authenticated postTurn の Compass 解決専用ファイル