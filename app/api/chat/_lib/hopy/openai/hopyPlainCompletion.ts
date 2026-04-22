// /app/api/chat/_lib/hopy/openai/hopyPlainCompletion.ts
import OpenAI from "openai";

import { phaseParams } from "../../phase/phaseParams";
import type { OpenAIChatMessage } from "./hopyOpenAIMessages";
import { withSingleRetry, withTimeout } from "./hopyOpenAIRetry";

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
OpenAI の plain completion 実行を担当するファイル。
response_format を指定しない通常の OpenAI completion 実行と、
timeout / single retry 呼び出しだけを担う。
OpenAI messages 組み立て、JSON forced completion 実行、JSON契約検証、
プロンプト文言生成、DB保存復元、HOPY唯一の正の再判定は担当しない。
*/

/*
【今回このファイルで修正したこと】
- /app/api/chat/_lib/route/openaiExecution.ts に最後に残っている plain completion 実行責務を受け取る新規ファイルとして作成しました。
- createPlainCompletion(...) をこのファイルへまとめました。
- timeout / single retry 本体は /app/api/chat/_lib/hopy/openai/hopyOpenAIRetry.ts から読み込みます。
- phaseParams(...) は既存どおり使用し、OpenAI 実行条件そのものは変更していません。
- state値 1..5、HOPY唯一の正、Compass契約条件、JSON契約検証、messages 組み立て、DB保存復元はこのファイルでは再判定・再生成していません。
*/

/* /app/api/chat/_lib/hopy/openai/hopyPlainCompletion.ts */