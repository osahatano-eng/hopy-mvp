// /app/api/chat/_lib/hopy/expression/extractExpressionCandidates.ts

export type ExpressionCandidateCategory =
  | "intent"
  | "emotion"
  | "decision"
  | "progress"
  | "hesitation"
  | "reflection"
  | "support_request"
  | "other";

export type ExtractExpressionCandidatesInput = {
  userText: string;
  reply?: string | null;
  stateLevel?: number | null;
  currentPhase?: number | null;
};

export type ExpressionCandidate = {
  phrase: string;
  normalizedPhrase: string;
  standardForm: string;
  category: ExpressionCandidateCategory;
  tone: "negative" | "neutral" | "positive";
  contextSummary: string;
  usageCountHint: number;
};

const MAX_CANDIDATES = 5;
const MAX_PHRASE_LENGTH = 60;
const MIN_PHRASE_LENGTH = 2;

const NOISE_EXACT = new Set([
  "はい",
  "いいえ",
  "うん",
  "ええ",
  "ok",
  "OK",
  "了解",
  "ありがとうございます",
  "ありがとう",
  "test",
  "テスト",
]);

const DEVELOPMENT_WORDS = [
  "hopy aiプロジェクト",
  "差分回答",
  "全文回答",
  "全文貼り付け",
  "supabase",
  "sql",
  "db",
  "api",
  "route",
  "prompt",
  "schema",
  "state_level",
  "current_phase",
  "threadpatch",
];

const INTENT_PATTERNS: Array<{
  pattern: RegExp;
  standardForm: string;
  category: ExpressionCandidateCategory;
}> = [
  { pattern: /(やる|やります|やってみる|進める|進めます)/, standardForm: "取り組む意志がある", category: "intent" },
  { pattern: /(戻る|戻ります|立て直す|立て直します)/, standardForm: "立て直して進めたい", category: "intent" },
  { pattern: /(なんとかする|なんとかします)/, standardForm: "状況を前に進めたい", category: "intent" },
  { pattern: /(続ける|続けます|継続する)/, standardForm: "継続する意志がある", category: "intent" },
  { pattern: /(決める|決めます|決断する)/, standardForm: "決断に向かっている", category: "decision" },
  { pattern: /(迷う|迷っている|迷いがある)/, standardForm: "迷いがある", category: "hesitation" },
  { pattern: /(不安|こわい|怖い|心配)/, standardForm: "不安を抱えている", category: "emotion" },
  { pattern: /(疲れた|しんどい|つらい|辛い)/, standardForm: "負荷を感じている", category: "emotion" },
  { pattern: /(できた|終わった|進んだ|前に進んだ)/, standardForm: "前進を感じている", category: "progress" },
  { pattern: /(考える|考えている|見直す|振り返る)/, standardForm: "状況を整理しようとしている", category: "reflection" },
  { pattern: /(教えて|知りたい|どうすれば|助けて)/, standardForm: "支援を求めている", category: "support_request" },
];

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function normalizePhrase(input: string): string {
  return normalizeWhitespace(input)
    .toLowerCase()
    .replace(/[。、，．.!！?？"'`´‘’“”()\[\]{}<>]/g, "")
    .trim();
}

function clampPhrase(input: string): string {
  const value = normalizeWhitespace(input);
  if (value.length <= MAX_PHRASE_LENGTH) return value;
  return value.slice(0, MAX_PHRASE_LENGTH).trim();
}

function includesDevelopmentWord(input: string): boolean {
  const lower = input.toLowerCase();
  return DEVELOPMENT_WORDS.some((word) => lower.includes(word));
}

function isNoisePhrase(input: string): boolean {
  const value = normalizeWhitespace(input);
  const normalized = normalizePhrase(value);

  if (!normalized) return true;
  if (value.length < MIN_PHRASE_LENGTH) return true;
  if (NOISE_EXACT.has(value) || NOISE_EXACT.has(normalized)) return true;
  if (/^[\W_]+$/.test(value)) return true;
  if (/^[0-9０-９]+$/.test(value)) return true;
  if (includesDevelopmentWord(value)) return true;

  return false;
}

function inferTone(input: string): "negative" | "neutral" | "positive" {
  if (/(不安|怖い|こわい|心配|迷う|迷い|つらい|辛い|疲れた|しんどい)/.test(input)) {
    return "negative";
  }
  if (/(できた|進んだ|やる|やります|続ける|決める|戻る)/.test(input)) {
    return "positive";
  }
  return "neutral";
}

function inferUsageCountHint(input: string): number {
  const text = normalizeWhitespace(input);
  if (!text) return 1;

  let score = 1;
  const repeats = [
    "やる",
    "やります",
    "不安",
    "迷う",
    "なんとか",
    "続ける",
    "決める",
    "考える",
  ];

  for (const token of repeats) {
    const matches = text.match(new RegExp(token, "g"));
    if (matches && matches.length >= 2) {
      score += 1;
    }
  }

  if (text.length >= 20) score += 1;
  if (text.length >= 50) score += 1;

  return Math.max(1, Math.min(score, 5));
}

function buildContextSummary(input: {
  userText: string;
  reply?: string | null;
  stateLevel?: number | null;
  currentPhase?: number | null;
}): string {
  const phase =
    typeof input.currentPhase === "number" && Number.isFinite(input.currentPhase)
      ? input.currentPhase
      : typeof input.stateLevel === "number" && Number.isFinite(input.stateLevel)
        ? input.stateLevel
        : null;

  const phaseText =
    phase === 1
      ? "混線寄り"
      : phase === 2
        ? "模索寄り"
        : phase === 3
          ? "整理寄り"
          : phase === 4
            ? "収束寄り"
            : phase === 5
              ? "決定寄り"
              : "状態未確定";

  const replyHint = normalizeWhitespace(String(input.reply ?? ""));
  const hasReplyHint = replyHint.length > 0;

  return hasReplyHint
    ? `ユーザー発話由来 / ${phaseText} / 回答確定後の補助文脈あり`
    : `ユーザー発話由来 / ${phaseText}`;
}

function uniqueByNormalizedPhrase(items: ExpressionCandidate[]): ExpressionCandidate[] {
  const map = new Map<string, ExpressionCandidate>();

  for (const item of items) {
    if (!item.normalizedPhrase) continue;
    if (!map.has(item.normalizedPhrase)) {
      map.set(item.normalizedPhrase, item);
    }
  }

  return Array.from(map.values());
}

function buildPatternCandidates(input: ExtractExpressionCandidatesInput): ExpressionCandidate[] {
  const text = normalizeWhitespace(input.userText);
  const contextSummary = buildContextSummary(input);
  const results: ExpressionCandidate[] = [];

  for (const def of INTENT_PATTERNS) {
    const match = text.match(def.pattern);
    if (!match?.[0]) continue;

    const phrase = clampPhrase(match[0]);
    if (isNoisePhrase(phrase)) continue;

    results.push({
      phrase,
      normalizedPhrase: normalizePhrase(phrase),
      standardForm: def.standardForm,
      category: def.category,
      tone: inferTone(phrase),
      contextSummary,
      usageCountHint: inferUsageCountHint(text),
    });
  }

  return results;
}

function buildSentenceCandidates(input: ExtractExpressionCandidatesInput): ExpressionCandidate[] {
  const text = normalizeWhitespace(input.userText);
  const contextSummary = buildContextSummary(input);

  const segments = text
    .split(/[。.!！?？\n]/)
    .map((v) => clampPhrase(v))
    .map((v) => normalizeWhitespace(v))
    .filter(Boolean);

  const results: ExpressionCandidate[] = [];

  for (const segment of segments) {
    if (isNoisePhrase(segment)) continue;
    if (segment.length < 4) continue;
    if (segment.length > MAX_PHRASE_LENGTH) continue;

    results.push({
      phrase: segment,
      normalizedPhrase: normalizePhrase(segment),
      standardForm: segment,
      category: "other",
      tone: inferTone(segment),
      contextSummary,
      usageCountHint: inferUsageCountHint(segment),
    });
  }

  return results;
}

export function extractExpressionCandidates(
  input: ExtractExpressionCandidatesInput,
): ExpressionCandidate[] {
  const userText = normalizeWhitespace(input.userText);

  if (!userText) return [];
  if (includesDevelopmentWord(userText)) return [];

  const patternCandidates = buildPatternCandidates(input);
  const sentenceCandidates = buildSentenceCandidates(input);

  const merged = uniqueByNormalizedPhrase([...patternCandidates, ...sentenceCandidates]);

  return merged
    .filter((item) => !isNoisePhrase(item.phrase))
    .filter((item) => item.normalizedPhrase.length >= MIN_PHRASE_LENGTH)
    .slice(0, MAX_CANDIDATES);
}

export default extractExpressionCandidates;