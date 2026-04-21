// /app/api/chat/_lib/route/compassPromptInput.ts

import type { CanonicalAssistantState } from "./authenticatedTypes";
import { buildCompassPayload } from "./compassPayload";

export function buildCompassPromptInput(
  assistantState: CanonicalAssistantState,
): ReturnType<typeof buildCompassPayload> {
  return buildCompassPayload(assistantState);
}

/*
このファイルの正式役割
assistant の確定状態から、Compass prompt 用の入力 payload を受け渡す専用ファイル。
実体の payload 組み立ては compassPayload.ts に委譲し、
このファイルはその入口をそろえる役割だけを持つ。
*/

/*
【今回このファイルで修正したこと】
- authenticatedTypes.ts から export されていない CompassPayload の import を削除した。
- 返り値型を buildCompassPayload の ReturnType に置き換えた。
- buildCompassPromptInput の責務や返却ロジック自体は変えていない。
- 最下部コメントを、このファイルのフルパス表記にそろえた。
*/
// /app/api/chat/_lib/route/compassPromptInput.ts