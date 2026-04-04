// /app/api/chat/_lib/response/hopyPromptBuilder.ts

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

export type HopyResolvedPlan = "free" | "plus" | "pro";

export type BuildHopyPromptParams = {
  stateLevel: HopyStateLevel | number | null | undefined;
  userInput: string;
  memories?: HopyMemoryInput[] | null;
  recentMessages?: HopyRecentMessageInput[] | null;
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

function clipLines(lines: string[], maxItems: number): string[] {
  return lines.filter(Boolean).slice(0, maxItems);
}

function buildIdentitySection(): string {
  return [
    "あなたはHOPYです。",
    "回答確定時の意味結果を正として扱います。",
    "状態値は必ず 1..5 / 5段階で扱い、0..4前提に戻さないでください。",
    "回答の芯は 理解 → 気づき → 方向 です。",
    "軽い入力では短く、説明要求では深く返してください。",
    "冒頭でユーザー発言をそのまま言い換えて繰り返さないでください。",
    "自然な日本語で返してください。",
  ].join("\n");
}

function buildPolicySection(policy: HopyReplyPolicy): string {
  const purpose = policy.purpose.map((item) => `- ${item}`).join("\n");
  const axis = policy.axis.map((item) => `- ${item}`).join("\n");
  const include = policy.include.map((item) => `- ${item}`).join("\n");
  const avoid = policy.avoid.map((item) => `- ${item}`).join("\n");

  return [
    `現在状態: ${policy.stateName} (${policy.stateLevel}/5)`,
    "",
    "この状態での回答目的:",
    purpose,
    "",
    "この状態での回答の軸:",
    axis,
    "",
    "回答に含めるべき要素:",
    include,
    "",
    "回答で避けるべきこと:",
    avoid,
  ].join("\n");
}

function buildPlanSection(resolvedPlan: HopyResolvedPlan): string {
  if (resolvedPlan === "pro") {
    return [
      "現在プラン前提:",
      "- ユーザーは Pro 利用中です。",
      "- 主役は常に 現在地・気づき・方向 です。",
      "- Free / Plus を主推奨として着地させないでください。",
    ].join("\n");
  }

  if (resolvedPlan === "plus") {
    return [
      "現在プラン前提:",
      "- ユーザーは Plus 利用中です。",
      "- 継続性の価値を自然に示してよいです。",
      "- Free を主推奨として着地させないでください。",
    ].join("\n");
  }

  return [
    "現在プラン前提:",
    "- ユーザーは Free 利用中です。",
    "- Free でも 現在地 → 気づき → 方向 の最小完成形は成立させてください。",
  ].join("\n");
}

function buildMemoriesSection(memories?: HopyMemoryInput[] | null): string {
  const lines = clipLines(
    (memories ?? []).map((memory, index) => {
      const body = normalizeText(memory?.body);
      if (!body) return "";

      const memoryType = normalizeText(memory?.memoryType) || "unknown";
      const memoryId = normalizeText(memory?.id) || `memory-${index + 1}`;

      return `- [${memoryType}] (${memoryId}) ${body}`;
    }),
    4,
  );

  if (lines.length === 0) {
    return "使用可能なMEMORIES: なし";
  }

  return ["使用可能なMEMORIES:", ...lines].join("\n");
}

function buildRecentMessagesSection(
  recentMessages?: HopyRecentMessageInput[] | null,
): string {
  const lines = clipLines(
    (recentMessages ?? []).map((message) => {
      const content = normalizeText(message?.content);
      if (!content) return "";

      const role = normalizeText(message?.role) || "unknown";
      return `- ${role}: ${content}`;
    }),
    6,
  );

  if (lines.length === 0) {
    return "最近の会話流れ: なし";
  }

  return ["最近の会話流れ:", ...lines].join("\n");
}

function buildExpressionAssetsSection(
  expressionAssets?: HopyExpressionAssetInput[] | null,
): string {
  const lines = clipLines(
    (expressionAssets ?? []).map((asset, index) => {
      const expressionText = normalizeText(asset?.expressionText);
      if (!expressionText) return "";

      const semanticLabel = normalizeText(asset?.semanticLabel) || "unknown";
      const toneLabel = normalizeText(asset?.toneLabel) || "unknown";
      const assetId = normalizeText(asset?.id) || `asset-${index + 1}`;

      return `- (${assetId}) semantic=${semanticLabel} tone=${toneLabel} text=${expressionText}`;
    }),
    3,
  );

  if (lines.length === 0) {
    return "使用可能な表現資産: なし";
  }

  return ["使用可能な表現資産:", ...lines].join("\n");
}

function buildTransitionSection(
  currentStateLevel: HopyStateLevel,
  transitionTargetLevel?: HopyStateLevel | number | null,
): string {
  const normalizedTarget = normalizeStateLevel(
    transitionTargetLevel ?? currentStateLevel,
  );

  return [
    "状態遷移方針:",
    `- 現在状態: ${currentStateLevel}/5`,
    `- 目標状態: ${normalizedTarget}/5`,
    "- 今の段階から次の自然な段階へ半歩でも進みやすい返答にしてください。",
    "- 押しつけず、受け取りやすい小さな一歩を含めてください。",
  ].join("\n");
}

function buildThreeStepStructureSection(): string {
  return [
    "HOPY回答3段構成:",
    "- 本体は 現在地 → 気づき → 方向 です。",
    "- 軽い入力では最小表示、説明要求では深くしてよいです。",
  ].join("\n");
}

function buildStateDensitySection(
  stateLevel: HopyStateLevel,
): string {
  if (stateLevel === 1) {
    return [
      "状態別本文密度:",
      "- 現在は混線です。",
      "- 慰めだけで終わらせず、優先するものを少し見えやすくしてください。",
    ].join("\n");
  }

  if (stateLevel === 2) {
    return [
      "状態別本文密度:",
      "- 現在は模索です。",
      "- 選択肢を増やしすぎず、今の流れに合う一本を寄せてください。",
    ].join("\n");
  }

  if (stateLevel === 3) {
    return [
      "状態別本文密度:",
      "- 現在は整理です。",
      "- 残すものと捨てるものが少し見えるようにしてください。",
    ].join("\n");
  }

  if (stateLevel === 4) {
    return [
      "状態別本文密度:",
      "- 現在は収束です。",
      "- 余計に広げず、最後の絞り込みや実行準備を示してください。",
    ].join("\n");
  }

  return [
    "状態別本文密度:",
    "- 現在は決定です。",
    "- 実行・継続・次の確認行動へ落としてください。",
  ].join("\n");
}

function buildGenerationRulesSection(
  resolvedPlan: HopyResolvedPlan,
): string {
  const planSpecificRules =
    resolvedPlan === "pro"
      ? [
          "- Pro 利用中の相手に Free / Plus を自発的な代替案として差し込まないこと",
        ]
      : resolvedPlan === "plus"
        ? [
            "- Plus 利用中の相手に Free を主推奨として着地させないこと",
          ]
        : [
            "- Free でも共感だけで終わらず、シンプルな方向提示まで到達すること",
          ];

  return [
    "回答生成ルール:",
    "- 今回の回答は、今の状態を次の自然な段階へ進めることを優先すること",
    "- 自然な日本語で返すこと",
    "- 毎回同じ定型句に寄せないこと",
    "- 基本は短めに始め、必要なときだけ深くすること",
    "- 挨拶・軽い入口では短く返すこと",
    "- 説明要求では構造と納得感を優先してよい",
    "- ただ共感して終わらず、輪郭・気づき・次の一歩のどれかを前進させること",
    "- 本文は 現在地 → 気づき → 方向 の順で組み立てること",
    "- 方向では複数案を広げすぎず、できるだけ一本で示すこと",
    "- 必要な場合だけ、小さく具体的な提案を1つ入れてよい",
    ...planSpecificRules,
  ].join("\n");
}

function buildUserInputSection(userInput: string): string {
  return [
    "今回のユーザー入力:",
    userInput || "(空入力)",
    "",
    "この入力に対して、自然で短めを基本とした回答を生成してください。",
    "回答本文は、現在地 → 気づき → 方向 を土台にしてください。",
    "軽い入力では短く、説明要求では深く返してください。",
  ].join("\n");
}

export function buildHopyPrompt(
  params: BuildHopyPromptParams,
): BuiltHopyPrompt {
  const stateLevel = normalizeStateLevel(params.stateLevel);
  const policy = getHopyReplyPolicy(stateLevel);
  const resolvedPlan = normalizeResolvedPlan(params.resolvedPlan);
  const userInput = normalizeText(params.userInput);

  return {
    stateLevel,
    policy,
    systemPrompt: buildIdentitySection(),
    developerPrompt: [
      buildPolicySection(policy),
      "",
      buildPlanSection(resolvedPlan),
      "",
      buildTransitionSection(stateLevel, params.transitionTargetLevel),
      "",
      buildThreeStepStructureSection(),
      "",
      buildStateDensitySection(stateLevel),
      "",
      buildMemoriesSection(params.memories),
      "",
      buildRecentMessagesSection(params.recentMessages),
      "",
      buildExpressionAssetsSection(params.expressionAssets),
      "",
      buildGenerationRulesSection(resolvedPlan),
    ].join("\n"),
    userPrompt: buildUserInputSection(userInput),
  };
}

/*
このファイルの正式役割
HOPY回答の核になる system / developer / user prompt を組み立て、状態・プラン・記憶・最近会話・表現資産を統合して返答生成の土台を作るファイル。
*/

/*
【今回このファイルで修正したこと】
- buildIdentitySection をさらに短くし、HOPYの芯と状態値制約だけに絞りました。
- buildPlanSection を短くし、プランごとの最低限の分岐だけ残しました。
- buildTransitionSection / buildThreeStepStructureSection / buildStateDensitySection を最小化しました。
- buildMemoriesSection / buildRecentMessagesSection / buildExpressionAssetsSection の最大件数を減らしました。
- buildGenerationRulesSection を最小化し、自然文の圧をさらに下げました。
- buildUserInputSection も短くし、入力指示を最小限にしました。
*/

/* /app/api/chat/_lib/response/hopyPromptBuilder.ts */