// /app/api/chat/_lib/route/openaiExecution.ts
import OpenAI from "openai";

import { ensureJsonCompletionIsValid } from "../hopy/contract/hopyJsonCompletionContract";
import type { OpenAIChatMessage } from "../hopy/openai/hopyOpenAIMessages";
import { withSingleRetry, withTimeout } from "../hopy/openai/hopyOpenAIRetry";
import {
  buildContractRetrySystem,
  buildEmptyJsonRetrySystem,
  buildStateMeaningSystem,
} from "../hopy/prompt/hopyOpenAIJsonContractPrompt";
import { phaseParams } from "../phase/phaseParams";
import type { Lang } from "../router/simpleRouter";

export { buildOpenAIMessages } from "../hopy/openai/hopyOpenAIMessages";
export type {
  HistoryItem,
  OpenAIChatMessage,
} from "../hopy/openai/hopyOpenAIMessages";
export { withTimeout } from "../hopy/openai/hopyOpenAIRetry";

async function runJsonForcedCompletion(params: {
  openai: OpenAI;
  modelName: string;
  messages: OpenAIChatMessage[];
  phaseForParams: 1 | 2 | 3 | 4 | 5;
  openaiTimeoutMs: number;
  maxTokens: number;
}) {
  const completion = await withTimeout(
    params.openai.chat.completions.create({
      model: params.modelName,
      messages: params.messages,
      response_format: { type: "json_object" },
      ...phaseParams(params.phaseForParams),
    }),
    params.openaiTimeoutMs,
    "openai",
  );

  return ensureJsonCompletionIsValid({
    completion,
    messages: params.messages,
  });
}

export async function createJsonForcedCompletion(params: {
  openai: OpenAI;
  modelName: string;
  messages: OpenAIChatMessage[];
  phaseForParams: 1 | 2 | 3 | 4 | 5;
  openaiTimeoutMs: number;
  maxTokens: number;
  replyLang: Lang;
}) {
  return withSingleRetry({
    retryDelayMs: 250,
    run: async () => {
      try {
        return await runJsonForcedCompletion(params);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? "");
        const lowerMessage = message.toLowerCase();

        const shouldRetryWithExtraSystemPrompt =
          lowerMessage.includes("empty_json_content") ||
          lowerMessage.includes("invalid_json_object_content") ||
          lowerMessage.includes("invalid_hopy_json_contract");

        if (!shouldRetryWithExtraSystemPrompt) {
          throw error;
        }

        const retryMessages: OpenAIChatMessage[] = [
          ...params.messages,
          {
            role: "system",
            content: buildEmptyJsonRetrySystem({
              uiLang: params.replyLang,
            }),
          },
          {
            role: "system",
            content: buildContractRetrySystem({
              uiLang: params.replyLang,
            }),
          },
          {
            role: "system",
            content: buildStateMeaningSystem({
              uiLang: params.replyLang,
            }),
          },
        ];

        return runJsonForcedCompletion({
          ...params,
          messages: retryMessages,
        });
      }
    },
  });
}

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
OpenAI completion 実行本体を担うファイル。
OpenAI へ渡す messages の組み立ては、
/app/api/chat/_lib/hopy/openai/hopyOpenAIMessages.ts から読み込む。
HOPY JSON 契約プロンプト文言は、
/app/api/chat/_lib/hopy/prompt/hopyOpenAIJsonContractPrompt.ts から読み込む。
HOPY confirmed payload の JSON 契約検証は、
/app/api/chat/_lib/hopy/contract/hopyJsonCompletionContract.ts から読み込む。
OpenAI completion 実行時の timeout / single retry は、
/app/api/chat/_lib/hopy/openai/hopyOpenAIRetry.ts から読み込む。
このファイルは OpenAI 実行層として、
completion 実行を安定して OpenAI 呼び出し層へ渡す責務を持つ。
*/

/*
【今回このファイルで修正したこと】
- messages 組み立て責務を /app/api/chat/_lib/hopy/openai/hopyOpenAIMessages.ts へ移し、このファイルでは buildOpenAIMessages(...) を re-export するだけにしました。
- HistoryItem / OpenAIChatMessage 型も /app/api/chat/_lib/hopy/openai/hopyOpenAIMessages.ts から re-export する形にしました。
- PromptBundle、ResolvedPlanLike、buildFinalHistory、memoryOutputContractSystem、planPrioritySystem、buildStateStructureSystem、buildCompassStructureSystem の import と buildOpenAIMessages(...) 本体をこのファイルから削除しました。
- 既存互換のため buildOpenAIMessages / HistoryItem / OpenAIChatMessage / withTimeout はこのファイルからも引き続き export します。
- OpenAI 実行、plain completion、JSON契約検証、state値 1..5、Compass契約条件は変更していません。
*/

/* /app/api/chat/_lib/route/openaiExecution.ts */