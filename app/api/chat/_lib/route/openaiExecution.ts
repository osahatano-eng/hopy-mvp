// /app/api/chat/_lib/route/openaiExecution.ts
import OpenAI from "openai";

import type { OpenAIChatMessage } from "../hopy/openai/hopyOpenAIMessages";
import { withSingleRetry, withTimeout } from "../hopy/openai/hopyOpenAIRetry";
import { phaseParams } from "../phase/phaseParams";

export { buildOpenAIMessages } from "../hopy/openai/hopyOpenAIMessages";
export { createJsonForcedCompletion } from "../hopy/openai/hopyJsonForcedCompletion";
export type {
  HistoryItem,
  OpenAIChatMessage,
} from "../hopy/openai/hopyOpenAIMessages";
export { withTimeout } from "../hopy/openai/hopyOpenAIRetry";

export async function createPlainCompletion(params: {
  openai: OpenAI;
  modelName: string;
  messages: OpenAIChatMessage[];
  phaseForParams: 1 | 2 | 3 | 4 | 5;
  openaiTimeoutMs: number;
  maxTokens: number;
}) {
  return withSingleRetry({
    retryDelayMs: 250,
    run: () =>
      withTimeout(
        params.openai.chat.completions.create({
          model: params.modelName,
          messages: params.messages,
          ...phaseParams(params.phaseForParams),
        }),
        params.openaiTimeoutMs,
        "openai",
      ),
  });
}

/*
このファイルの正式役割:
OpenAI 実行系の入口として、分離済み責務を re-export し、
plain completion 実行だけを直接担当するファイル。
OpenAI へ渡す messages の組み立ては、
/app/api/chat/_lib/hopy/openai/hopyOpenAIMessages.ts から読み込む。
JSON forced completion 実行は、
/app/api/chat/_lib/hopy/openai/hopyJsonForcedCompletion.ts から読み込む。
OpenAI completion 実行時の timeout / single retry は、
/app/api/chat/_lib/hopy/openai/hopyOpenAIRetry.ts から読み込む。
このファイルは既存 import 互換を保ちながら、
OpenAI 実行系の入口として必要な export と plain completion 実行を担う。
*/

/*
【今回このファイルで修正したこと】
- JSON forced completion 実行責務を /app/api/chat/_lib/hopy/openai/hopyJsonForcedCompletion.ts へ移し、このファイルでは createJsonForcedCompletion(...) を re-export するだけにしました。
- ensureJsonCompletionIsValid、buildContractRetrySystem、buildEmptyJsonRetrySystem、buildStateMeaningSystem、Lang、runJsonForcedCompletion(...)、createJsonForcedCompletion(...) 本体をこのファイルから削除しました。
- 既存互換のため buildOpenAIMessages / createJsonForcedCompletion / HistoryItem / OpenAIChatMessage / withTimeout はこのファイルから引き続き export します。
- plain completion、timeout / retry 呼び出し、state値 1..5、Compass契約条件は変更していません。
*/

/* /app/api/chat/_lib/route/openaiExecution.ts */