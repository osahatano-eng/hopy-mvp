// /app/api/chat/_lib/route/openaiExecution.ts
import OpenAI from "openai";

import { ensureJsonCompletionIsValid } from "../hopy/contract/hopyJsonCompletionContract";
import { withSingleRetry, withTimeout } from "../hopy/openai/hopyOpenAIRetry";
import {
  buildCompassStructureSystem,
  buildContractRetrySystem,
  buildEmptyJsonRetrySystem,
  buildStateMeaningSystem,
  buildStateStructureSystem,
} from "../hopy/prompt/hopyOpenAIJsonContractPrompt";
import { phaseParams } from "../phase/phaseParams";
import type { Lang } from "../router/simpleRouter";
import type { PromptBundle } from "./promptBundle";
import type { ResolvedPlanLike } from "./openaiPlan";
import {
  memoryOutputContractSystem,
  planPrioritySystem,
} from "./openaiContracts";
import { buildFinalHistory } from "./history";

export { withTimeout } from "../hopy/openai/hopyOpenAIRetry";

export type HistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type OpenAIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function buildOpenAIMessages(args: {
  promptBundle: PromptBundle;
  history: HistoryItem[];
  userText: string;
  replyLang: Lang;
  resolvedPlan: ResolvedPlanLike;
}): OpenAIChatMessage[] {
  const finalHistory = buildFinalHistory({
    history: args.history,
    userText: args.userText,
    resolvedPlan: args.resolvedPlan,
  });

  const normalizedHopyUserPrompt = String(
    args.promptBundle.userPrompt ?? "",
  ).trim();

  const stateStructureSystem = buildStateStructureSystem({
    uiLang: args.replyLang,
  });

  const stateMeaningSystem = buildStateMeaningSystem({
    uiLang: args.replyLang,
  });

  const compassStructureSystem = buildCompassStructureSystem({
    uiLang: args.replyLang,
    resolvedPlan: args.resolvedPlan,
  });

  return [
    { role: "system", content: args.promptBundle.coreSystemPrompt },
    { role: "system", content: args.promptBundle.baseSystemPrompt },
    { role: "system", content: args.promptBundle.continuitySystemPrompt },
    { role: "system", content: args.promptBundle.personaSystemPrompt },
    { role: "system", content: args.promptBundle.styleSystemPrompt },
    {
      role: "system",
      content: planPrioritySystem({
        uiLang: args.replyLang,
        resolvedPlan: args.resolvedPlan,
      }),
    },
    ...(stateStructureSystem
      ? [{ role: "system" as const, content: stateStructureSystem }]
      : []),
    ...(stateMeaningSystem
      ? [{ role: "system" as const, content: stateMeaningSystem }]
      : []),
    ...(compassStructureSystem
      ? [{ role: "system" as const, content: compassStructureSystem }]
      : []),
    { role: "system", content: args.promptBundle.antiPlatitudePrompt },
    { role: "system", content: args.promptBundle.complianceSystemPrompt },
    { role: "system", content: args.promptBundle.replyLanguageLockPrompt },
    { role: "system", content: memoryOutputContractSystem(args.replyLang) },
    ...(normalizedHopyUserPrompt
      ? [{ role: "system" as const, content: normalizedHopyUserPrompt }]
      : []),
    ...finalHistory.map((m) => ({ role: m.role, content: m.content })),
  ];
}

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
OpenAI へ渡す messages の組み立てと、
OpenAI completion 実行本体を担うファイル。
HOPY JSON 契約プロンプト文言は、
/app/api/chat/_lib/hopy/prompt/hopyOpenAIJsonContractPrompt.ts から読み込む。
HOPY confirmed payload の JSON 契約検証は、
/app/api/chat/_lib/hopy/contract/hopyJsonCompletionContract.ts から読み込む。
OpenAI completion 実行時の timeout / single retry は、
/app/api/chat/_lib/hopy/openai/hopyOpenAIRetry.ts から読み込む。
このファイルは OpenAI 実行層として、
promptBundle と history から最終 messages を構成し、
completion 実行を安定して OpenAI 呼び出し層へ渡す責務を持つ。
*/

/*
【今回このファイルで修正したこと】
- timeout / retry 責務を /app/api/chat/_lib/hopy/openai/hopyOpenAIRetry.ts へ移し、このファイルでは withTimeout(...) / withSingleRetry(...) を import して使うだけにしました。
- sleep(...)、isRetryableOpenAIError(...)、withSingleRetry(...) の本体をこのファイルから削除しました。
- 既存互換のため withTimeout はこのファイルからも re-export し、他ファイルが既存 import を使っていても壊れにくい形にしました。
- OpenAI 実行、plain completion、messages 組み立て、JSON契約検証、state値 1..5、Compass契約条件は変更していません。
*/

/* /app/api/chat/_lib/route/openaiExecution.ts */