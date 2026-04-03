// /app/api/chat/_lib/route/compassPayload.ts

import type { CanonicalAssistantState } from "./authenticatedTypes";

type CompassPayload = {
  eligible: boolean;
  state_changed: boolean;
  state_level: 1 | 2 | 3 | 4 | 5;
  current_phase: 1 | 2 | 3 | 4 | 5;
  prev_phase: 1 | 2 | 3 | 4 | 5;
  prev_state_level: 1 | 2 | 3 | 4 | 5;
};

export function buildCompassPayload(
  assistantState: CanonicalAssistantState,
): CompassPayload {
  const {
    state_level,
    current_phase,
    state_changed,
    prev_phase,
    prev_state_level,
  } = assistantState;

  return {
    eligible: state_changed === true,
    state_changed,
    state_level,
    current_phase,
    prev_phase,
    prev_state_level,
  };
}

/*
このファイルの正式役割
assistant の確定状態から、Compass 用の最小 payload を組み立てる専用ファイル。
Compass 表示に必要な状態情報だけを抜き出して返す。
*/

/*
【今回このファイルで修正したこと】
- 消失していた /app/api/chat/_lib/route/compassPayload.ts を再構築しました。
- このファイル内で必要最小限の CompassPayload 型を定義しました。
- 状態値は 1..5 / 5段階で固定しました。
- buildCompassPayload の責務や返却ロジック自体は変えていません。
*/
// このファイルの正式役割: assistant の確定状態から Compass 用の最小 payload を組み立てる専用ファイル