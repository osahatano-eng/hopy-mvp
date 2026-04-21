// /app/api/chat/_lib/route/compassPrompt.ts

import type { CanonicalAssistantState } from "./authenticatedTypes";
import { buildCompassPromptInput } from "./compassPromptInput";

export function buildCompassPrompt(
  assistantState: CanonicalAssistantState,
): string {
  const compass = buildCompassPromptInput(assistantState);

  if (!compass.eligible) {
    return "";
  }

  const phaseLine = `current_phase=${compass.current_phase}`;
  const stateLine = `state_level=${compass.state_level}`;
  const prevPhaseLine = `prev_phase=${compass.prev_phase}`;
  const prevStateLine = `prev_state_level=${compass.prev_state_level}`;

  return [
    "HOPY Compass generation target detected.",
    "Generate Compass only from the confirmed meaning payload.",
    "Do not reinterpret the raw user message independently.",
    phaseLine,
    stateLine,
    prevPhaseLine,
    prevStateLine,
  ].join("\n");
}

/*
このファイルの正式役割
assistant の確定状態から受け取った Compass prompt 用 payload をもとに、
Compass 生成対象であることと確定状態だけを prompt へ渡す専用ファイル。
Compass本文・Pro用見出し・HOPYの言葉はここで作文しない。
state_changed / state_level / current_phase / prev系を再判定せず、
buildCompassPromptInput の結果だけを使う。
*/

/*
【今回このファイルで修正したこと】
- 最下部にこのファイルの正式役割を明記した。
- 最下部コメントを、このファイルのフルパス表記にそろえた。
- Compass prompt の生成ロジック自体は変えていない。
*/
// /app/api/chat/_lib/route/compassPrompt.ts