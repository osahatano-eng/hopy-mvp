// /app/api/chat/_lib/hopy/openai/hopyJsonForcedCompletion.ts
import OpenAI from "openai";

import { ensureJsonCompletionIsValid } from "../contract/hopyJsonCompletionContract";
import {
  buildContractRetrySystem,
  buildEmptyJsonRetrySystem,
  buildStateMeaningSystem,
} from "../prompt/hopyOpenAIJsonContractPrompt";
import { phaseParams } from "../../phase/phaseParams";
import type { Lang } from "../../router/simpleRouter";
import type { OpenAIChatMessage } from "./hopyOpenAIMessages";
import { withSingleRetry, withTimeout } from "./hopyOpenAIRetry";

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
      max_tokens: params.maxTokens,
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

/*
このファイルの正式役割:
OpenAI の JSON forced completion 実行を担当するファイル。
response_format: { type: "json_object" } を使った OpenAI completion 実行、
HOPY JSON 契約検証、
契約違反時の retry 用 system prompt 追加、
1回だけの retry 実行を担う。
OpenAI messages 組み立て、plain completion 実行、timeout / retry 本体、プロンプト文言生成、DB保存復元、HOPY唯一の正の再判定は担当しない。
*/

/*
【今回このファイルで修正したこと】
- max_tokens を phaseParams(...) の後に置き、phaseParams(...) 側に含まれる max_tokens を params.maxTokens で最終上書きする形に修正しました。
- これにより、TypeScript の「max_tokens が重複して後から上書きされる」ビルドエラーを回避します。
- retry、JSON契約検証、state値 1..5、HOPY唯一の正、Compass契約条件、messages 組み立て、plain completion、DB保存復元は変更していません。
*/

/* /app/api/chat/_lib/hopy/openai/hopyJsonForcedCompletion.ts */