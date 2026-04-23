/* /app/api/chat/_lib/response/hopyPromptBuilder.ts */

import {
  buildHopyDeveloperPromptFromSections,
  buildHopyIdentitySection,
  buildHopyUserInputSection,
} from "../hopy/prompt/hopyPromptSections";
import {
  getHopyReplyPolicy,
  type HopyReplyPolicy,
  type HopyStateLevel,
} from "./hopyReplyPolicy";

export type HopyMemoryInput = {
  id?: string | null;
  memoryType?: string | null;
  body?: string | null;
};

export type HopyExpressionAssetInput = {
  id?: string | null;
  semanticLabel?: string | null;
  toneLabel?: string | null;
  expressionText?: string | null;
};

export type HopyRecentMessageInput = {
  role?: "system" | "user" | "assistant" | string | null;
  content?: string | null;
};

export type HopyThreadMemoryInput = {
  topic?: string | null;
  recentFlowSummary?: string | null;
  currentGoal?: string | null;
  latestUserIntent?: string | null;
  latestAssistantDirection?: string | null;
  decidedPoints?: Array<string | null | undefined> | null;
  unresolvedPoints?: Array<string | null | undefined> | null;
};

export type HopyResolvedPlan = "free" | "plus" | "pro";

export type BuildHopyPromptParams = {
  stateLevel: HopyStateLevel | number | null | undefined;
  userInput: string;
  memories?: HopyMemoryInput[] | null;
  recentMessages?: HopyRecentMessageInput[] | null;
  threadMemory?: HopyThreadMemoryInput | null;
  expressionAssets?: HopyExpressionAssetInput[] | null;
  transitionTargetLevel?: HopyStateLevel | number | null;
  resolvedPlan?: HopyResolvedPlan | null;
};

export type BuiltHopyPrompt = {
  stateLevel: HopyStateLevel;
  policy: HopyReplyPolicy;
  systemPrompt: string;
  developerPrompt: string;
  userPrompt: string;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStateLevel(
  value: HopyStateLevel | number | null | undefined,
): HopyStateLevel {
  const policy = getHopyReplyPolicy(value);
  return policy.stateLevel;
}

function normalizeResolvedPlan(
  value: HopyResolvedPlan | string | null | undefined,
): HopyResolvedPlan {
  if (value === "pro") return "pro";
  if (value === "plus") return "plus";
  return "free";
}

export function buildHopyPrompt(
  params: BuildHopyPromptParams,
): BuiltHopyPrompt {
  const userInput = normalizeText(params.userInput);
  const stateLevel = normalizeStateLevel(params.stateLevel);
  const transitionTargetLevel = normalizeStateLevel(
    params.transitionTargetLevel ?? stateLevel,
  );
  const policy = getHopyReplyPolicy(transitionTargetLevel);
  const resolvedPlan = normalizeResolvedPlan(params.resolvedPlan);

  return {
    stateLevel,
    policy,
    systemPrompt: buildHopyIdentitySection(),
    developerPrompt: buildHopyDeveloperPromptFromSections({
      resolvedPlan,
      userInput,
      stateLevel,
      policy,
      transitionTargetLevel,
      memories: params.memories,
      recentMessages: params.recentMessages,
      threadMemory: params.threadMemory,
      expressionAssets: params.expressionAssets,
    }),
    userPrompt: buildHopyUserInputSection(userInput),
  };
}

/*
【このファイルの正式役割】
HOPY回答の核になる system / developer / user prompt を組み立てる入口ファイル。
prompt section 文言そのものは /app/api/chat/_lib/hopy/prompt/hopyPromptSections.ts に集約し、このファイルは入力値の正規化、policy取得、prompt section の呼び出し、BuiltHopyPrompt の返却だけを担当する。
DB取得、DB保存、state_changed生成、Compass生成、○表示、messages取得、回答保存処理は担当しない。

【今回このファイルで修正したこと】
- policy取得を stateLevel 基準から transitionTargetLevel 基準へ変更した。
- これにより、下降や上昇など遷移目標が渡っている場合、状態別 policy も遷移先に合わせて組み立てるようにした。
- stateLevel の正規化、transitionTargetLevel の正規化、prompt section 呼び出し以外には触れていない。
- state_changed・Compass・○表示・DB保存復元・回答保存処理には触れていない。

 /app/api/chat/_lib/response/hopyPromptBuilder.ts
*/