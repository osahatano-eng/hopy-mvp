// /app/api/chat/_lib/hopy/openai/hopyOpenAIMessages.ts
import {
  buildCompassStructureSystem,
  buildStateMeaningSystem,
  buildStateStructureSystem,
} from "../prompt/hopyOpenAIJsonContractPrompt";
import type { Lang } from "../../router/simpleRouter";
import type { PromptBundle } from "../../route/promptBundle";
import type { ResolvedPlanLike } from "../../route/openaiPlan";
import {
  memoryOutputContractSystem,
  planPrioritySystem,
} from "../../route/openaiContracts";
import { buildFinalHistory } from "../../route/history";

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

/*
このファイルの正式役割:
OpenAI へ渡す messages を組み立てるファイル。
promptBundle、history、userText、replyLang、resolvedPlan から最終 OpenAIChatMessage[] を構成する責務だけを持つ。
OpenAI completion 実行、timeout / retry、JSON契約検証、DB保存復元、HOPY唯一の正の再判定は担当しない。
*/

/*
【今回このファイルで修正したこと】
- /app/api/chat/_lib/route/openaiExecution.ts に残っている messages 組み立て責務を受け取る新規ファイルとして作成しました。
- HistoryItem / OpenAIChatMessage 型と buildOpenAIMessages(...) をこのファイルへまとめました。
- HOPY JSON 契約プロンプト文言は既存の /app/api/chat/_lib/hopy/prompt/hopyOpenAIJsonContractPrompt.ts から読み込みます。
- state値は 1..5 / 5段階のまま維持し、0..4 前提にはしていません。
- HOPY唯一の正、Compass契約条件、JSON契約検証、OpenAI実行処理、timeout / retry はこのファイルでは再判定・再生成していません。
*/

/* /app/api/chat/_lib/hopy/openai/hopyOpenAIMessages.ts */