// /app/api/chat/_lib/hopy/learning/extractLearningCandidates.ts

export type LearningSourceType = "auto" | "manual" | "feedback";

export type LearningType =
  | "expression_preference"
  | "closing_preference"
  | "support_style_preference"
  | "concreteness_preference"
  | "emotional_temperature_preference"
  | "natural_phrase_asset"
  | "anti_ai_pattern"
  | "response_effect_signal"
  | "state_specific_support_preference"
  | "forbidden_expression_pattern";

export type LearningPolarity = "promote" | "avoid";
export type LearningScope = "global" | "user" | "state_specific";

export type LearningCandidate = {
  sourceType: LearningSourceType;
  learningType: LearningType;
  body: string;
  cue: string;
  polarity: LearningPolarity;
  scope: LearningScope;
  weight: number;
  evidenceCount: number;
  userId: string | null;
  sourceMessageId: string | null;
  sourceThreadId: string | null;
  stateLevel: 1 | 2 | 3 | 4 | 5 | null;
  currentPhase: 1 | 2 | 3 | 4 | 5 | null;
  status: "active" | "trash";
};

export type ExtractLearningCandidatesInput = {
  userMessage: string;
  assistantReply: string;
  stateLevel?: number | null;
  currentPhase?: number | null;
  explicitFeedback?: string | null;
  reactionSummary?: string | null;
  userId?: string | null;
  sourceMessageId?: string | null;
  sourceThreadId?: string | null;
};

type CandidateSeed = {
  sourceType: LearningSourceType;
  learningType: LearningType;
  body: string;
  cue: string;
  polarity: LearningPolarity;
  scope: LearningScope;
};

const MAX_BODY_LENGTH = 160;
const MAX_CUE_LENGTH = 80;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function toStateLevel(
  value: number | null | undefined,
): 1 | 2 | 3 | 4 | 5 | null {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? value
    : null;
}

function toCurrentPhase(
  value: number | null | undefined,
): 1 | 2 | 3 | 4 | 5 | null {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? value
    : null;
}

function clampText(value: string, maxLength: number): string {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength).trim();
}

function buildSeed(params: CandidateSeed): CandidateSeed | null {
  const body = clampText(params.body, MAX_BODY_LENGTH);
  const cue = clampText(params.cue, MAX_CUE_LENGTH);

  if (!body || !cue) {
    return null;
  }

  return {
    ...params,
    body,
    cue,
  };
}

function isLikelyExplicitPositiveFeedback(text: string): boolean {
  return (
    /いい|良い|自然|助か|嬉し|ありがたい|しっくり|伝わ|響|うんうん|読みやす|寄り添|具体|わかりやす/i.test(
      text,
    ) &&
    !/違う|微妙|不自然|いや|避けたい|やめて|いらない|説明っぽ|きれいすぎ/i.test(
      text,
    )
  );
}

function isLikelyExplicitNegativeFeedback(text: string): boolean {
  return /違う|微妙|不自然|やめて|避けたい|いらない|説明っぽ|抽象的|きれいすぎ|ChatGPTっぽ|AIっぽ|固い|遠い/i.test(
    text,
  );
}

function detectConcretePreference(text: string): CandidateSeed[] {
  const seeds: CandidateSeed[] = [];

  if (
    /具体|すぐ試せ|試しやす|行動|一歩|小さく|小さい提案|少しだけやってみ|やってみる|現実味|試せそう/i.test(
      text,
    )
  ) {
    const seed = buildSeed({
      sourceType: "feedback",
      learningType: "concreteness_preference",
      body:
        "具体提案は、現在地の見立てと理由に接続して出す。小さな行動だけで終わらせず、なぜ今それが合うかを残す。",
      cue: "concrete-action-with-reason",
      polarity: "promote",
      scope: "global",
    });
    if (seed) seeds.push(seed);
  }

  return seeds;
}

function detectExpressionPreference(text: string): CandidateSeed[] {
  const seeds: CandidateSeed[] = [];

  if (
    /自然|人が書いた|人が話した|普通に話|会話の温度|空気|うんうん|説明っぽくない|会話っぽ|距離が近い|自然な日本語/i.test(
      text,
    )
  ) {
    const seed = buildSeed({
      sourceType: "feedback",
      learningType: "expression_preference",
      body:
        "自然な日本語や会話の温度は、見立て・方向・理由を伝えやすくする補助として使う。",
      cue: "natural-language-supports-judgment",
      polarity: "promote",
      scope: "global",
    });
    if (seed) seeds.push(seed);
  }

  return seeds;
}

function detectSupportStylePreference(text: string): CandidateSeed[] {
  const seeds: CandidateSeed[] = [];

  if (
    /寄り添|支え|背中を押|安心|受け止めだけで終わら|次へ進みやす|前に進みやす|進めそう|支えてほしい/i.test(
      text,
    )
  ) {
    const seed = buildSeed({
      sourceType: "feedback",
      learningType: "support_style_preference",
      body:
        "受容だけで閉じず、現在地の理解、見落としている論点、進む方向、その理由を返す。",
      cue: "support-with-insight-direction-reason",
      polarity: "promote",
      scope: "global",
    });
    if (seed) seeds.push(seed);
  }

  return seeds;
}

function detectClosingPreference(text: string): CandidateSeed[] {
  const seeds: CandidateSeed[] = [];

  if (
    /締め|終わり方|まとめ|閉じ方|きれいに終わりすぎ|まとめすぎ|会話の余白|余韻|閉じすぎ/i.test(
      text,
    )
  ) {
    const seed = buildSeed({
      sourceType: "feedback",
      learningType: "closing_preference",
      body:
        "きれいにまとめすぎる締め方を避け、次に見る一点や進む方向が自然に残る閉じ方にする。",
      cue: "close-with-direction",
      polarity: "avoid",
      scope: "global",
    });
    if (seed) seeds.push(seed);
  }

  return seeds;
}

function detectEmotionalTemperaturePreference(text: string): CandidateSeed[] {
  const seeds: CandidateSeed[] = [];

  if (
    /感動|ウキウキ|ワクワク|前向きな熱量|熱量|静か|落ち着い|やさしすぎない|温度感|少し明るく/i.test(
      text,
    )
  ) {
    const seed = buildSeed({
      sourceType: "feedback",
      learningType: "emotional_temperature_preference",
      body:
        "静かさを保ちながら、見立てや方向が前へ進む感覚として伝わる温度を少し含める。",
      cue: "calm-forward-temperature",
      polarity: "promote",
      scope: "global",
    });
    if (seed) seeds.push(seed);
  }

  return seeds;
}

function detectNaturalPhraseAsset(text: string): CandidateSeed[] {
  const seeds: CandidateSeed[] = [];

  if (/うんうん|その感じ|たしかに|そうだよね|わかる/i.test(text)) {
    const seed = buildSeed({
      sourceType: "feedback",
      learningType: "natural_phrase_asset",
      body:
        "相手の感覚に自然にうなずく短い入りは、見立てと方向につなげる入口として使う。",
      cue: "natural-entry-to-direction",
      polarity: "promote",
      scope: "global",
    });
    if (seed) seeds.push(seed);
  }

  return seeds;
}

function detectAvoidPatterns(text: string): CandidateSeed[] {
  const seeds: CandidateSeed[] = [];

  if (
    /ChatGPTっぽ|AIっぽ|説明っぽ|抽象的|きれいすぎ|固い|距離ができ|遠い/i.test(
      text,
    )
  ) {
    const seed = buildSeed({
      sourceType: "feedback",
      learningType: "anti_ai_pattern",
      body:
        "判断のない説明調、方向のない整理、理由のない一般論、抽象的で整いすぎた言い回しは避ける。",
      cue: "avoid-explanation-without-judgment",
      polarity: "avoid",
      scope: "global",
    });
    if (seed) seeds.push(seed);
  }

  if (/余白が生まれる|そっと脇に置く|足場になる/i.test(text)) {
    const seed = buildSeed({
      sourceType: "feedback",
      learningType: "forbidden_expression_pattern",
      body:
        "意味がぼやけやすい比喩的な定型表現は避け、何を見立て、どこへ進むかを明確にする。",
      cue: "avoid-vague-metaphors",
      polarity: "avoid",
      scope: "global",
    });
    if (seed) seeds.push(seed);
  }

  return seeds;
}

function detectEffectiveSignalsFromReaction(text: string): CandidateSeed[] {
  const seeds: CandidateSeed[] = [];

  if (!text) {
    return seeds;
  }

  if (/しっくり|自然|読みやす|うんうん|伝わ|響/i.test(text)) {
    const seed = buildSeed({
      sourceType: "feedback",
      learningType: "response_effect_signal",
      body:
        "見立て・方向・理由が自然な言葉で伝わる返しは、納得と受け入れにつながりやすい。",
      cue: "insight-direction-reason-accepted",
      polarity: "promote",
      scope: "global",
    });
    if (seed) seeds.push(seed);
  }

  if (/助か|安心|前向き|やってみよう|試せそう/i.test(text)) {
    const seed = buildSeed({
      sourceType: "feedback",
      learningType: "response_effect_signal",
      body:
        "小さく試せる具体は、見立てと理由に接続されていると次の行動につながりやすい。",
      cue: "reasoned-concrete-action-effective",
      polarity: "promote",
      scope: "global",
    });
    if (seed) seeds.push(seed);
  }

  return seeds;
}

function buildStateSpecificSeed(
  stateLevel: 1 | 2 | 3 | 4 | 5 | null,
): CandidateSeed | null {
  if (stateLevel == null) {
    return null;
  }

  const bodyByState: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: "状態1では、絡まりの中心を1つ見立て、安心だけで終わらず、次に見る一点を置く。",
    2: "状態2では、選択肢を広げるだけでなく、HOPYとして近い方向を1つ仮説で置き、その理由を添える。",
    3: "状態3では、整理した結果、次に優先して見るべき一点を示し、構造化だけで終わらせない。",
    4: "状態4では、方向を1つに寄せ、なぜ今その方向が合うのかを示し、次アクションへ落とす。",
    5: "状態5では、決定の意味を言語化し、なぜその決定でよいのかを短く根拠づけ、実行へ落とす。",
  };

  return buildSeed({
    sourceType: "auto",
    learningType: "state_specific_support_preference",
    body: bodyByState[stateLevel],
    cue: `state-support-${stateLevel}`,
    polarity: "promote",
    scope: "state_specific",
  });
}

function dedupeSeeds(seeds: CandidateSeed[]): CandidateSeed[] {
  const seen = new Set<string>();
  const result: CandidateSeed[] = [];

  for (const seed of seeds) {
    const key = [
      seed.sourceType,
      seed.learningType,
      seed.body,
      seed.cue,
      seed.polarity,
      seed.scope,
    ].join("::");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(seed);
  }

  return result;
}

function detectSeedsFromExplicitFeedback(text: string): CandidateSeed[] {
  if (!text) {
    return [];
  }

  return [
    ...detectConcretePreference(text),
    ...detectExpressionPreference(text),
    ...detectSupportStylePreference(text),
    ...detectClosingPreference(text),
    ...detectEmotionalTemperaturePreference(text),
    ...detectNaturalPhraseAsset(text),
    ...detectAvoidPatterns(text),
  ];
}

export function extractLearningCandidates(
  input: ExtractLearningCandidatesInput,
): LearningCandidate[] {
  const userMessage = normalizeText(input.userMessage);
  const assistantReply = normalizeText(input.assistantReply);
  const explicitFeedback = normalizeText(input.explicitFeedback);
  const reactionSummary = normalizeText(input.reactionSummary);
  const stateLevel = toStateLevel(input.stateLevel);
  const currentPhase = toCurrentPhase(input.currentPhase);

  if (!userMessage && !assistantReply && !explicitFeedback && !reactionSummary) {
    return [];
  }

  const seeds: CandidateSeed[] = [];
  const hasExplicitFeedback = Boolean(explicitFeedback);
  const hasReactionSummary = Boolean(reactionSummary);

  if (hasExplicitFeedback) {
    const hasPositiveSignal = isLikelyExplicitPositiveFeedback(explicitFeedback);
    const hasNegativeSignal = isLikelyExplicitNegativeFeedback(explicitFeedback);
    const explicitSeeds = detectSeedsFromExplicitFeedback(explicitFeedback);

    if (hasPositiveSignal || hasNegativeSignal || explicitSeeds.length > 0) {
      seeds.push(...explicitSeeds);
    }
  }

  if (hasReactionSummary) {
    seeds.push(...detectEffectiveSignalsFromReaction(reactionSummary));
  }

  if (hasExplicitFeedback || hasReactionSummary) {
    const stateSpecificSeed = buildStateSpecificSeed(stateLevel);
    if (stateSpecificSeed) {
      seeds.push(stateSpecificSeed);
    }
  }

  return dedupeSeeds(seeds).map((seed) => ({
    sourceType: seed.sourceType,
    learningType: seed.learningType,
    body: seed.body,
    cue: seed.cue,
    polarity: seed.polarity,
    scope: seed.scope,
    weight: 1,
    evidenceCount: 1,
    userId: input.userId ?? null,
    sourceMessageId: input.sourceMessageId ?? null,
    sourceThreadId: input.sourceThreadId ?? null,
    stateLevel,
    currentPhase,
    status: "active",
  }));
}

/*
/app/api/chat/_lib/hopy/learning/extractLearningCandidates.ts

【今回このファイルで修正したこと】
Learning の保存量は減らさず、保存される学習候補の本文を HOPY の新しい正である
「理解 → 気づき → 方向 → なぜならば」へ寄せました。
旧HOPYの「やわらかい具体」「支える」「自然さ」中心の学習文言を、
見立て・方向・理由・次に見る一点を強める学習文言へ変更しました。
state_specific_support_preference も保存は維持しつつ、各状態1..5の学習本文を
HOPYの新しい回答方針に合わせて更新しました。

【このファイルの正式役割】
明示フィードバック、反応要約、状態情報から Learning 候補を抽出する。
MEMORIES ではなく、HOPY全体の脳を育てるための抽象化された表現・支援・反応パターンを候補化する。
DB保存、Learning注入、MEMORIES保存、state_changed生成、Compass生成、○表示、回答本文生成は担当しない。
*/

/* /app/api/chat/_lib/hopy/learning/extractLearningCandidates.ts */