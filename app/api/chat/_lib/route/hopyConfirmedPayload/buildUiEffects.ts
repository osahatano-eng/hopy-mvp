// /app/api/chat/_lib/route/hopyConfirmedPayload/buildUiEffects.ts

import type { ConfirmedAssistantTurn } from "../authenticatedHelpers";

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
  const source = confirmedTurn as ConfirmedAssistantTurn & {
    compassText?: unknown;
    compass_text?: unknown;
    compass?: {
      text?: unknown;
    } | null;
  };

  return normalizeCompassValue(
    source.compassText ?? source.compass_text ?? source.compass?.text,
  );
}

function resolveConfirmedCompassPrompt(
  confirmedTurn: ConfirmedAssistantTurn,
): string | null {
  const source = confirmedTurn as ConfirmedAssistantTurn & {
    compassPrompt?: unknown;
    compass_prompt?: unknown;
    compass?: {
      prompt?: unknown;
    } | null;
  };

  const resolved = normalizeCompassValue(
    source.compassPrompt ?? source.compass_prompt ?? source.compass?.prompt,
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
【今回このファイルで修正したこと】
- ui_effects.compass の独自項目 stateChanged を削除した。
- ui_effects.compass.prompt を string 固定ではなく string | null の正式shapeに修正した。
- stateChanged の唯一の正は confirmedTurn.stateChanged のまま使い、ui_effects.compass には Compass の正式値だけを載せる形にそろえた。

このファイルの正式役割
hopy_confirmed_payload.ui_effects の組み立てファイル
*/
// このファイルの正式役割: hopy_confirmed_payload.ui_effects の組み立てファイル