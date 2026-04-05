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

function isLowSignalInput(userInput: string): boolean {
  const normalized = normalizeText(userInput).toLowerCase();

  if (!normalized) return true;

  const compact = normalized.replace(/\s+/g, "");
  const shortPatterns = new Set([
    "こんにちは",
    "こんばんは",
    "おはよう",
    "やあ",
    "hi",
    "hello",
    "hey",
    "いいね",
    "ありがとう",
    "最高",
    "助かる",
    "なるほど",
    "了解",
    "たのしみ",
    "がんばる",
    "嬉しい",
    "うれしい",
    "よかった",
    "おはよ",
  ]);

  if (shortPatterns.has(compact)) return true;
  if (compact.length <= 8) return true;

  return false;
}

function buildIdentitySection(): string {
  return [
    "あなたはHOPYです。",
    "回答確定時の意味結果を正として扱います。",
    "状態値は必ず 1..5 / 5段階で扱い、0..4前提に戻さないでください。",
    "回答の芯は 理解 → 気づき → 方向 です。",
    "ただし、すべての入力に同じ熱量・同じ文量・同じ状態前進を与えてはいけません。",
    "返答前に、今回の入力が『挨拶 / 軽い相談 / 重い相談 / 説明要求』のどれに近いかを内部で判断してください。",
    "入力分類に応じて、返答の長さ・深さ・方向の強さを切り替えてください。",
    "基本は短めに始め、必要なときだけ段階的に深くしてください。",
    "ただし短文入力を過大解釈して、大きな状態遷移を作ってはいけません。",
    "『こんにちは』『おはよう』『こんばんは』『やあ』『hi』『hello』のような低シグナル入口入力は、会話開始の合図として扱ってください。",
    "低シグナル入口入力だけでは、state_changed を true にしないでください。",
    "低シグナル入口入力だけでは、state_level / current_phase を大きく上げないでください。",
    "低シグナル入口入力だけでは、Compass 前提の読解をしないでください。",
    "さらに、入口挨拶ではなくても、短文の軽い感想・軽い前向き発話・軽い相づち・軽い応援だけで state_changed を true にしないでください。",
    "たとえば『いいね』『ありがとう』『最高』『助かる』『なるほど』『了解』『たのしみ』『がんばる』『嬉しい』『よかった』のような短文だけでは、決定・行動開始・方針確定として扱わないでください。",
    "短文入力だけでは、ユーザーの決意・決定・深い整理完了・行動確定まで読み込まないでください。",
    "state_level を 5 にしてよいのは、ユーザーが明確な決定、行動開始、方針確定、強い意志表明をしているときだけです。",
    "軽い前向き短文と、明確な決定表明は別物として厳密に分けてください。",
    "Compass を出してよいのは、その回の state_changed が本当に true のときだけです。",
    "入力前に渡される state や target は参考情報であり、その回の確定状態そのものとして扱ってはいけません。",
    "入力前の参考 state を見て、その回の state_changed / current_phase / state_level を先取りしないでください。",
    "入力前の参考 state に応じて、本文の温度・方向・行動圧を強めすぎないでください。",
    "軽い入力では短く、説明要求では深く返してください。",
    "冒頭でユーザー発言をそのまま言い換えて繰り返さないでください。",
    "自然な日本語で返してください。",
  ].join("\n");
}

function buildPolicySection(
  policy: HopyReplyPolicy,
  userInput: string,
): string {
  const lowSignal = isLowSignalInput(userInput);
  const purpose = policy.purpose.map((item) => `- ${item}`).join("\n");
  const axis = policy.axis.map((item) => `- ${item}`).join("\n");
  const include = policy.include.map((item) => `- ${item}`).join("\n");
  const avoid = policy.avoid.map((item) => `- ${item}`).join("\n");

  if (lowSignal) {
    return [
      "入力前の参考状態:",
      "- 今回は低シグナル入口入力として扱うこと。",
      "- 入力前参考状態が何であっても、今回ターンの state_changed / current_phase / state_level を先取りしないこと。",
      "- トーン調整は最小限にとどめ、本文を短く自然に返すこと。",
      "- 行動開始・方針確定・決定状態として読まないこと。",
      "",
      "低シグナル入力での回答目的:",
      "- 会話の入口として自然に受けること。",
      "- 過大解釈を避けること。",
      "- 状態を押し上げることを目的にしないこと。",
      "",
      "低シグナル入力での回答の軸:",
      "- 短くやわらかく返すこと。",
      "- 深い意味づけをしないこと。",
      "- 方向提示は最小か省略でよいこと。",
      "",
      "低シグナル入力で含めるべき要素:",
      "- 自然な受け止め",
      "- 軽い返答",
      "",
      "低シグナル入力で避けるべきこと:",
      "- 決定5前提の押し出し",
      "- 強い行動促進",
      "- 深い整理完了としての読解",
    ].join("\n");
  }

  return [
    `入力前の参考状態: ${policy.stateName} (${policy.stateLevel}/5)`,
    "- これは今回ターンの確定状態ではなく、返答のトーン調整用の参考情報です。",
    "- この参考状態だけを根拠に、今回ターンの state_changed や state 5 を先取りしないでください。",
    "- 参考状態に合わせて本文の圧を強めすぎず、今回入力の重さを優先してください。",
    "",
    "この参考状態での回答目的:",
    purpose,
    "",
    "この参考状態での回答の軸:",
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
  transitionTargetLevel: HopyStateLevel | number | null | undefined,
  userInput: string,
): string {
  const lowSignal = isLowSignalInput(userInput);
  const normalizedTarget = normalizeStateLevel(
    transitionTargetLevel ?? currentStateLevel,
  );

  if (lowSignal) {
    return [
      "状態遷移方針:",
      `- 入力前の参考状態: ${currentStateLevel}/5`,
      `- 参考上限目安: ${normalizedTarget}/5`,
      "- 今回は低シグナル入口入力として扱うこと。",
      "- 上の2値は今回ターンの確定結果ではありません。",
      "- 低シグナル入口入力では、状態を進めること自体を目的にしないこと。",
      "- 低シグナル入口入力では、state_changed を true にしないこと。",
      "- 低シグナル入口入力では、current_phase / state_level を大きく上げないこと。",
      "- 参考状態や参考上限目安が高くても、それを今回ターンの決定根拠にしないこと。",
      "- 会話開始または軽い応答として静かに返すこと。",
    ].join("\n");
  }

  return [
    "状態遷移方針:",
    `- 入力前の参考状態: ${currentStateLevel}/5`,
    `- 参考上限目安: ${normalizedTarget}/5`,
    "- 上の2値は今回ターンの確定結果ではありません。",
    "- 参考上限目安は強制到達先ではなく、意味入力が十分なときだけ近づける上限目安です。",
    "- 入力前の参考状態や参考上限目安だけを見て、その回の state_changed / current_phase / state_level を先取りしないでください。",
    "- 低シグナル入口入力や軽い短文では、状態を進めること自体を目的にしないでください。",
    "- 実質的な意味入力が十分にあり、前進の根拠が明確なときだけ、次の自然な段階へ進める返答にしてください。",
    "- 入口の挨拶だけなら、会話開始として静かに受け、状態遷移を確定しないでください。",
    "- 軽い短文だけなら、気持ちの受け止めに留め、状態を大きく進めないでください。",
    "- 軽い前向き短文だけでは、決定・実行開始・方針確定に進めないでください。",
    "- state 5 は、決定・行動開始・方針確定が明確なときだけです。",
    "- 状態前進よりも、入力に合った自然さと過大解釈の防止を優先してください。",
    "- 押しつけず、受け取りやすい小さな一歩を含めてください。",
  ].join("\n");
}

function buildThreeStepStructureSection(userInput: string): string {
  const lowSignal = isLowSignalInput(userInput);

  if (lowSignal) {
    return [
      "HOPY回答3段構成:",
      "- 本体は 現在地 → 気づき → 方向 です。",
      "- ただし今回は低シグナル入口入力として扱うこと。",
      "- 現在地の軽い受け止めだけで十分です。",
      "- 気づきは最小か省略でよいです。",
      "- 方向は最小か省略でよいです。",
      "- 強い断定や深い意味づけをしないでください。",
    ].join("\n");
  }

  return [
    "HOPY回答3段構成:",
    "- 本体は 現在地 → 気づき → 方向 です。",
    "- ただし毎回3要素を同じ量で出してはいけません。",
    "- 低シグナル入口入力では、現在地の軽い受け止めだけで十分です。",
    "- 軽い短文では、気づきと方向は最小表示にしてください。",
    "- 軽い前向き短文でも、方向を強く断定しないでください。",
    "- 説明要求では、構造を持って深く返してよいです。",
    "- 軽い入力では最小表示、説明要求では深くしてよいです。",
  ].join("\n");
}

function buildStateDensitySection(
  stateLevel: HopyStateLevel,
  userInput: string,
): string {
  const lowSignal = isLowSignalInput(userInput);

  if (lowSignal) {
    return [
      "参考状態別本文密度:",
      "- 今回は低シグナル入口入力です。",
      "- 入力前参考状態が何であっても、本文密度を厚くしすぎないでください。",
      "- 決定・実行開始・整理完了として読まないでください。",
      "- 短く自然に返すことを優先してください。",
    ].join("\n");
  }

  if (stateLevel === 1) {
    return [
      "参考状態別本文密度:",
      "- 入力前参考状態は混線です。",
      "- これは今回ターンの確定状態ではありません。",
      "- 慰めだけで終わらせず、優先するものを少し見えやすくしてください。",
    ].join("\n");
  }

  if (stateLevel === 2) {
    return [
      "参考状態別本文密度:",
      "- 入力前参考状態は模索です。",
      "- これは今回ターンの確定状態ではありません。",
      "- 選択肢を増やしすぎず、今の流れに合う一本を寄せてください。",
      "- ただし今回入力が軽い場合は、方向を厚くしすぎないでください。",
    ].join("\n");
  }

  if (stateLevel === 3) {
    return [
      "参考状態別本文密度:",
      "- 入力前参考状態は整理です。",
      "- これは今回ターンの確定状態ではありません。",
      "- 残すものと捨てるものが少し見えるようにしてください。",
    ].join("\n");
  }

  if (stateLevel === 4) {
    return [
      "参考状態別本文密度:",
      "- 入力前参考状態は収束です。",
      "- これは今回ターンの確定状態ではありません。",
      "- 余計に広げず、最後の絞り込みや実行準備を示してください。",
    ].join("\n");
  }

  return [
    "参考状態別本文密度:",
    "- 入力前参考状態は決定です。",
    "- これは今回ターンの確定状態ではありません。",
    "- 実行・継続・次の確認行動へ落としてください。",
    "- ただし今回入力に明確な決定根拠がない限り、その回の state 5 や state_changed=true を先取りしないでください。",
  ].join("\n");
}

function buildLengthControlSection(): string {
  return [
    "返答長さ・深さの切替ルール:",
    "- 返答は固定長にしないこと。",
    "- 返答前に、今回の入力が『挨拶 / 軽い相談 / 重い相談 / 説明要求』のどれに近いかを内部で判断すること。",
    "- 分類に応じて、返答の長さと深さを切り替えること。",
    "- 基本は短めに始め、必要なときだけ段階的に深くすること。",
    "- 挨拶・軽い入口は 1〜2文で返すこと。",
    "- 軽い相談・軽い迷いは 2〜4文で返すこと。",
    "- 重い相談・深い悩みは 3〜6文で返すこと。",
    "- 説明要求・整理要求は、文量制限より納得感を優先して構造化して返すこと。",
    "- 軽い入力に長文で返しすぎないこと。",
    "- 深い相談に短すぎる返答をしないこと。",
    "- 説明要求があるときは納得感を優先すること。",
    "- 短くても冷たくしないこと。",
    "- 長くても同じ意味を繰り返さないこと。",
    "- 雰囲気だけで長文化しないこと。",
    "- 必要のない先回りをしないこと。",
    "- 最後は自然に次の流れが生まれる形にすること。",
  ].join("\n");
}

function buildGenerationRulesSection(
  resolvedPlan: HopyResolvedPlan,
  userInput: string,
): string {
  const lowSignal = isLowSignalInput(userInput);

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

  if (lowSignal) {
    return [
      "回答生成ルール:",
      "- 今回は低シグナル入口入力として扱うこと。",
      "- 入力前に渡される state や target は参考情報であり、その回の確定 state を意味しないこと。",
      "- 参考 state や参考 target だけを根拠に、その回の state_changed / current_phase / state_level を決め打ちしないこと。",
      "- 低シグナル入口入力では、状態前進を作ること自体を目的にしないこと。",
      "- 低シグナル入口入力だけでは、状態変化を確定しないこと。",
      "- 低シグナル入口入力だけでは、state_changed を true にしないこと。",
      "- 低シグナル入口入力だけでは、current_phase / state_level を 5 へ飛ばさないこと。",
      "- 低シグナル入口入力だけでは、Compass を必要とする意味づけをしないこと。",
      "- 挨拶や軽い短文では、短く自然に返すこと。",
      "- 深い気づきや強い方向提示を入れないこと。",
      "- 行動開始・方針確定・決定完了として扱わないこと。",
      "- 本文は軽い受け止め中心でよいこと。",
      ...planSpecificRules,
    ].join("\n");
  }

  return [
    "回答生成ルール:",
    "- 今回の回答は、入力の重さ・深さ・説明要求に合う自然な返答を優先すること",
    "- 入力前に渡される state や target は参考情報であり、その回の確定 state を意味しないこと",
    "- 参考 state や参考 target だけを根拠に、その回の state_changed / current_phase / state_level を決め打ちしないこと",
    "- 低シグナル入口入力や軽い短文では、状態前進を作ること自体を目的にしないこと",
    "- ただし低シグナル入口入力だけでは、状態変化を確定しないこと",
    "- 低シグナル入口入力だけでは、state_changed を true にしないこと",
    "- 低シグナル入口入力だけでは、current_phase / state_level を 5 へ飛ばさないこと",
    "- 低シグナル入口入力だけでは、Compass を必要とする意味づけをしないこと",
    "- 入口挨拶ではなくても、短文の軽い感想・軽い前向き発話・軽い応援だけでは state_changed を true にしないこと",
    "- 『いいね』『ありがとう』『最高』『助かる』『なるほど』『了解』『たのしみ』『がんばる』『嬉しい』『よかった』程度の短文だけで、決定・行動開始・方針確定を作らないこと",
    "- 短文だけで決意・決定・整理完了・行動確定まで読み込まないこと",
    "- 軽い前向き短文と、明確な決断表明を混同しないこと",
    "- state_level を 5 にしてよいのは、明確な決定・行動開始・方針確定・強い意志表明があるときだけです",
    "- 自然な日本語で返すこと",
    "- 毎回同じ定型句に寄せないこと",
    "- 基本は短めに始め、必要なときだけ深くすること",
    "- 挨拶・軽い入口では短く返すこと",
    "- 軽い短文では、短く返しつつ過剰な意味づけをしないこと",
    "- 重い相談では、受け止めを少し厚くしてよいが、感情表現を盛りすぎないこと",
    "- 説明要求では構造と納得感を優先してよい",
    "- ただ共感して終わらず、必要なときだけ輪郭・気づき・次の一歩のどれかを自然に前進させること",
    "- ただし入口の挨拶だけでは、過剰な気づきや方向提示を入れないこと",
    "- 本文は 現在地 → 気づき → 方向 の順で組み立てること",
    "- 低シグナル入口入力では、気づきと方向は最小か省略でよい",
    "- 軽い短文では、現在地を軽く受け止める範囲に留めてよい",
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
    "返答前に、今回の入力が『挨拶 / 軽い相談 / 重い相談 / 説明要求』のどれに近いかを内部で判断してください。",
    "分類に応じて、返答の長さと深さを切り替えてください。",
    "回答本文は、現在地 → 気づき → 方向 を土台にしてください。",
    "ただし毎回同じ量を出さず、入力に応じて見せる量を調整してください。",
    "ただし『こんにちは』のような入口挨拶だけなら、会話開始として静かに返してください。",
    "入口挨拶だけなら、深い意味づけ、強い状態遷移、Compass前提の読解をしないでください。",
    "短文の軽い感想・軽い前向き発話・軽い応援だけなら、短く返し、状態を大きく進めないでください。",
    "『いいね』『ありがとう』『最高』『助かる』『なるほど』『了解』『たのしみ』『がんばる』『嬉しい』『よかった』のような短文だけでは、決定・行動開始・方針確定として扱わないでください。",
    "明確な決定・行動開始・方針確定がない限り、state 5 を前提に読まないでください。",
    "軽い入力では短く、説明要求では深く返してください。",
  ].join("\n");
}

export function buildHopyPrompt(
  params: BuildHopyPromptParams,
): BuiltHopyPrompt {
  const userInput = normalizeText(params.userInput);
  const stateLevel = normalizeStateLevel(params.stateLevel);
  const policy = getHopyReplyPolicy(stateLevel);
  const resolvedPlan = normalizeResolvedPlan(params.resolvedPlan);

  return {
    stateLevel,
    policy,
    systemPrompt: buildIdentitySection(),
    developerPrompt: [
      buildPolicySection(policy, userInput),
      "",
      buildPlanSection(resolvedPlan),
      "",
      buildTransitionSection(
        stateLevel,
        params.transitionTargetLevel,
        userInput,
      ),
      "",
      buildThreeStepStructureSection(userInput),
      "",
      buildStateDensitySection(stateLevel, userInput),
      "",
      buildLengthControlSection(),
      "",
      buildMemoriesSection(params.memories),
      "",
      buildRecentMessagesSection(params.recentMessages),
      "",
      buildExpressionAssetsSection(params.expressionAssets),
      "",
      buildGenerationRulesSection(resolvedPlan, userInput),
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
- 低シグナル入口入力を isLowSignalInput で先に判定し、参考 state が高くても本文圧を強めない分岐を追加しました。
- buildPolicySection / buildTransitionSection / buildThreeStepStructureSection / buildStateDensitySection / buildGenerationRulesSection を userInput 依存に変更しました。
- 低シグナル入口入力では、参考 state や target が 2 以上でも state_changed=true や state 5 を誘導しない専用ルールへ切り替えるようにしました。
- それ以外の上流 state 生成や payload 組み立ては触っていません。
*/

/* /app/api/chat/_lib/response/hopyPromptBuilder.ts */