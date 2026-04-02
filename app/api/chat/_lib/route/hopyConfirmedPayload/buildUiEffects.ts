// /app/api/chat/_lib/route/hopyConfirmedPayload/buildUiEffects.ts

type ConfirmedAssistantTurn = {
  stateChanged: boolean;
  compassText?: unknown;
  compass_text?: unknown;
  compassPrompt?: unknown;
  compass_prompt?: unknown;
  compass?: {
    text?: unknown;
    prompt?: unknown;
  } | null;
};

export type HopyUiEffects = {
  show_reply_state_badge: boolean;
  update_left_rail_state_immediately: boolean;
  show_state_transition_effect: boolean;
  compass?: {
    text: string;
    prompt: string | null;
  };
};

type BuildUiEffectsParams = {
  confirmedTurn: ConfirmedAssistantTurn;
};

function normalizeCompassValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function resolveConfirmedCompassText(
  confirmedTurn: ConfirmedAssistantTurn,
): string {
  return normalizeCompassValue(
    confirmedTurn.compassText ??
      confirmedTurn.compass_text ??
      confirmedTurn.compass?.text,
  );
}

function resolveConfirmedCompassPrompt(
  confirmedTurn: ConfirmedAssistantTurn,
): string | null {
  const resolved = normalizeCompassValue(
    confirmedTurn.compassPrompt ??
      confirmedTurn.compass_prompt ??
      confirmedTurn.compass?.prompt,
  );

  return resolved.length > 0 ? resolved : null;
}

export function buildUiEffects(params: BuildUiEffectsParams): HopyUiEffects {
  const { confirmedTurn } = params;
  const stateChanged = confirmedTurn.stateChanged === true;
  const compassText = resolveConfirmedCompassText(confirmedTurn);
  const compassPrompt = resolveConfirmedCompassPrompt(confirmedTurn);
  const shouldIncludeCompass = stateChanged && compassText.length > 0;

  return {
    show_reply_state_badge: stateChanged,
    update_left_rail_state_immediately: stateChanged,
    show_state_transition_effect: stateChanged,
    ...(shouldIncludeCompass
      ? {
          compass: {
            text: compassText,
            prompt: compassPrompt,
          },
        }
      : {}),
  };
}

/*
このファイルの正式役割:
hopy_confirmed_payload.ui_effects の組み立てファイル

【今回このファイルで修正したこと】
authenticatedHelpers.ts から export されていない ConfirmedAssistantTurn の import を削除しました。
このファイル内で buildUiEffects に必要な最小限の ConfirmedAssistantTurn 型を定義しました。
ui_effects の組み立てロジック自体は変更していません。
*/