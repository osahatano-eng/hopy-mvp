// /app/api/chat/_lib/hopy/learning/shouldPersistLearning.ts

import type { LearningCandidate } from "./extractLearningCandidates";

export type ShouldPersistLearningReason =
  | "ok"
  | "empty_body"
  | "empty_cue"
  | "invalid_weight"
  | "invalid_evidence_count"
  | "invalid_status"
  | "single_use_noise"
  | "raw_quote_like"
  | "contains_personal_information"
  | "low_reusability"
  | "manual_requires_body";

export type ShouldPersistLearningResult = {
  ok: boolean;
  reason: ShouldPersistLearningReason;
};

const MAX_BODY_LENGTH = 160;
const MAX_CUE_LENGTH = 80;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function hasRawQuoteLikePattern(text: string): boolean {
  if (!text) {
    return false;
  }

  if (/[""'「」『』]/.test(text) && text.length > 60) {
    return true;
  }

  if (/です。.+です。/.test(text) && text.length > 120) {
    return true;
  }

  return false;
}

function containsPersonalInformation(text: string): boolean {
  if (!text) {
    return false;
  }

  const patterns = [
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /\b\d{2,4}-\d{2,4}-\d{3,4}\b/,
    /\b\d{10,13}\b/,
    /〒\d{3}-\d{4}/,
    /\b(?:東京都|北海道|大阪府|京都府|.{1,10}県).{0,20}(?:市|区|町|村)/,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

function isSingleUseNoise(body: string, cue: string): boolean {
  if (!body || !cue) {
    return true;
  }

  if (body.length < 12) {
    return true;
  }

  if (/^(ありがとう|了解|はい|いいですね|助かります)$/i.test(body)) {
    return true;
  }

  if (/^(tmp|test|memo|note)$/i.test(cue)) {
    return true;
  }

  return false;
}

function hasLearningTypeSpecificReusability(candidate: LearningCandidate): boolean {
  const body = normalizeText(candidate.body);

  switch (candidate.learningType) {
    case "response_effect_signal":
      return /つながりやすい|受け入れられやすい|有効|伝わりやすい|自然|具体/.test(body);

    case "natural_phrase_asset":
      return body.length >= 16;

    case "support_style_preference":
      return /支え|受容|閉じず|次へ進みやす|前に進みやす|背中を押|安心/.test(body);

    case "closing_preference":
      return /締め|閉じ|まとめすぎ|自然に閉じる|余白|余韻/.test(body);

    case "emotional_temperature_preference":
      return /静か|熱量|温度|落ち着|前向き/.test(body);

    case "concreteness_preference":
      return /具体|小さく|提案|一歩|試せる/.test(body);

    case "expression_preference":
      return /自然な日本語|会話の温度|人が話している|説明より/.test(body);

    case "anti_ai_pattern":
      return /AIらしい|説明調|抽象的|整いすぎ/.test(body);

    case "forbidden_expression_pattern":
      return /比喩的|定型表現|避ける/.test(body);

    case "state_specific_support_preference":
      return candidate.stateLevel != null && /状態[1-5]|具体|支える|添える/.test(body);

    case "expression_preference":
    default:
      return true;
  }
}

function hasLowReusability(candidate: LearningCandidate): boolean {
  const body = normalizeText(candidate.body);

  if (!body) {
    return true;
  }

  if (candidate.scope === "state_specific" && candidate.stateLevel == null) {
    return true;
  }

  if (!hasLearningTypeSpecificReusability(candidate)) {
    return true;
  }

  return false;
}

export function shouldPersistLearning(
  candidate: LearningCandidate,
): ShouldPersistLearningResult {
  const body = normalizeText(candidate.body);
  const cue = normalizeText(candidate.cue);

  if (!body) {
    return { ok: false, reason: "empty_body" };
  }

  if (!cue) {
    return { ok: false, reason: "empty_cue" };
  }

  if (body.length > MAX_BODY_LENGTH || cue.length > MAX_CUE_LENGTH) {
    return { ok: false, reason: "low_reusability" };
  }

  if (!Number.isFinite(candidate.weight) || candidate.weight <= 0) {
    return { ok: false, reason: "invalid_weight" };
  }

  if (!Number.isInteger(candidate.evidenceCount) || candidate.evidenceCount <= 0) {
    return { ok: false, reason: "invalid_evidence_count" };
  }

  if (candidate.status !== "active" && candidate.status !== "trash") {
    return { ok: false, reason: "invalid_status" };
  }

  if (candidate.sourceType === "manual" && !body) {
    return { ok: false, reason: "manual_requires_body" };
  }

  if (isSingleUseNoise(body, cue)) {
    return { ok: false, reason: "single_use_noise" };
  }

  if (hasRawQuoteLikePattern(body)) {
    return { ok: false, reason: "raw_quote_like" };
  }

  if (containsPersonalInformation(body)) {
    return { ok: false, reason: "contains_personal_information" };
  }

  if (hasLowReusability(candidate)) {
    return { ok: false, reason: "low_reusability" };
  }

  return { ok: true, reason: "ok" };
}