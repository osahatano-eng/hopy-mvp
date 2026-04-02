// /app/api/chat/_lib/hopy/expression/shouldPersistExpressionCandidate.ts

import type { ExpressionCandidate } from "./extractExpressionCandidates";

export type PersistExpressionDecisionReason =
  | "accepted"
  | "empty_phrase"
  | "too_short"
  | "too_long"
  | "unsafe_word"
  | "development_term"
  | "low_value_noise"
  | "missing_category"
  | "missing_standard_form"
  | "duplicate_in_batch";

export type PersistExpressionDecision = {
  shouldPersist: boolean;
  reason: PersistExpressionDecisionReason;
};

export type ShouldPersistExpressionCandidateInput = {
  candidate: ExpressionCandidate;
  existingNormalizedPhrases?: string[] | null;
};

const MIN_PHRASE_LENGTH = 2;
const MAX_PHRASE_LENGTH = 60;

const LOW_VALUE_EXACT = new Set([
  "はい",
  "いいえ",
  "うん",
  "ええ",
  "ok",
  "OK",
  "了解",
  "ありがとう",
  "ありがとうございます",
  "テスト",
  "test",
]);

const UNSAFE_WORDS = [
  "死にたい",
  "殺す",
  "殺したい",
  "自殺",
  "リスカ",
  "違法薬物",
  "覚醒剤",
  "爆弾",
  "テロ",
  "ハッキング",
  "マルウェア",
  "詐欺",
];

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

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function normalizeForCompare(input: string): string {
  return normalizeWhitespace(input)
    .toLowerCase()
    .replace(/[。、，．.!！?？"'`´‘’“”()\[\]{}<>]/g, "")
    .trim();
}

function includesAny(input: string, words: string[]): boolean {
  const lower = input.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

function isLowValueNoise(input: string): boolean {
  const value = normalizeWhitespace(input);
  const normalized = normalizeForCompare(value);

  if (!normalized) return true;
  if (LOW_VALUE_EXACT.has(value) || LOW_VALUE_EXACT.has(normalized)) return true;
  if (/^[\W_]+$/.test(value)) return true;
  if (/^[0-9０-９]+$/.test(value)) return true;

  return false;
}

export function shouldPersistExpressionCandidate(
  input: ShouldPersistExpressionCandidateInput,
): PersistExpressionDecision {
  const candidate = input.candidate;
  const phrase = normalizeWhitespace(String(candidate?.phrase ?? ""));
  const normalizedPhrase =
    normalizeForCompare(String(candidate?.normalizedPhrase ?? "")) || normalizeForCompare(phrase);
  const standardForm = normalizeWhitespace(String(candidate?.standardForm ?? ""));
  const category = normalizeWhitespace(String(candidate?.category ?? ""));

  if (!phrase) {
    return { shouldPersist: false, reason: "empty_phrase" };
  }

  if (phrase.length < MIN_PHRASE_LENGTH) {
    return { shouldPersist: false, reason: "too_short" };
  }

  if (phrase.length > MAX_PHRASE_LENGTH) {
    return { shouldPersist: false, reason: "too_long" };
  }

  if (!standardForm) {
    return { shouldPersist: false, reason: "missing_standard_form" };
  }

  if (!category) {
    return { shouldPersist: false, reason: "missing_category" };
  }

  if (isLowValueNoise(phrase) || isLowValueNoise(standardForm)) {
    return { shouldPersist: false, reason: "low_value_noise" };
  }

  if (includesAny(phrase, DEVELOPMENT_WORDS) || includesAny(standardForm, DEVELOPMENT_WORDS)) {
    return { shouldPersist: false, reason: "development_term" };
  }

  if (includesAny(phrase, UNSAFE_WORDS) || includesAny(standardForm, UNSAFE_WORDS)) {
    return { shouldPersist: false, reason: "unsafe_word" };
  }

  const existing = new Set(
    (input.existingNormalizedPhrases ?? [])
      .map((v) => normalizeForCompare(String(v ?? "")))
      .filter(Boolean),
  );

  if (normalizedPhrase && existing.has(normalizedPhrase)) {
    return { shouldPersist: false, reason: "duplicate_in_batch" };
  }

  return { shouldPersist: true, reason: "accepted" };
}

export default shouldPersistExpressionCandidate;