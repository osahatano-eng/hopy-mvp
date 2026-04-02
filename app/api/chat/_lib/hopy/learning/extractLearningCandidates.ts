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
      body: "受け止めだけで終わらず、小さく具体的な支えや提案を含める。",
      cue: "small-concrete-support",
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
      body: "説明より会話の温度を優先し、人が話しているような自然な日本語で返す。",
      cue: "natural-human-japanese",
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
      body: "受容だけで閉じず、相手が次へ進みやすい支え方を優先する。",
      cue: "supportive-forward-motion",
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
      body: "きれいにまとめすぎる締め方を避け、会話の流れの中で自然に閉じる。",
      cue: "avoid-overneat-closing",
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
      body: "静かさを保ちながらも、読み進めたくなる前向きな熱量を少し含める。",
      cue: "gentle-positive-lift",
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
      body: "相手の感覚に自然にうなずく短い入りは、会話の距離を縮めやすい。",
      cue: "natural-affirming-entry",
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
      body: "AIらしい説明調、抽象的で整いすぎた言い回しは避ける。",
      cue: "avoid-ai-explanatory-tone",
      polarity: "avoid",
      scope: "global",
    });
    if (seed) seeds.push(seed);
  }

  if (/余白が生まれる|そっと脇に置く|足場になる/i.test(text)) {
    const seed = buildSeed({
      sourceType: "feedback",
      learningType: "forbidden_expression_pattern",
      body: "意味がぼやけやすい比喩的な定型表現は避ける。",
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
      body: "自然で読みやすく、会話の温度が伝わる返しは受け入れられやすい。",
      cue: "natural-readable-accepted",
      polarity: "promote",
      scope: "global",
    });
    if (seed) seeds.push(seed);
  }

  if (/助か|安心|前向き|やってみよう|試せそう/i.test(text)) {
    const seed = buildSeed({
      sourceType: "feedback",
      learningType: "response_effect_signal",
      body: "小さく試せる具体がある返しは、次の行動につながりやすい。",
      cue: "concrete-next-action-effective",
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
    1: "状態1では、刺激を増やしすぎず、負担の小さい具体を短く返す。",
    2: "状態2では、視野を少し広げるような柔らかい具体を添える。",
    3: "状態3では、整理を助ける具体と前進しやすい一歩を両立させる。",
    4: "状態4では、流れを止めずに次へ進みやすい具体を自然に添える。",
    5: "状態5では、決めた勢いを壊さず、過剰説明を避けて短く支える。",
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