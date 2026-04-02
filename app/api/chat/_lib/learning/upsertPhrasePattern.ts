// /app/api/chat/_lib/learning/upsertPhrasePattern.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExtractedPhraseObservation } from "./extractPhraseObservations";

type UpsertPhrasePatternParams = {
  supabase: SupabaseClient;
  userId: string;
  observation: ExtractedPhraseObservation;
};

type UpsertPhrasePatternResult =
  | {
      ok: true;
      patternId: string | null;
      action: "inserted" | "updated" | "skipped";
    }
  | {
      ok: false;
      error: unknown;
      patternId: null;
      action: "skipped";
    };

type PhrasePatternRow = {
  id: string;
  evidence_count: number | null;
};

const PHRASE_PATTERNS_TABLE = "phrase_patterns";

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLanguage(value: unknown): "ja" | "en" {
  const s = normalizeText(value).toLowerCase();
  return s === "en" ? "en" : "ja";
}

function normalizeStateAffinityLevel(value: unknown): 1 | 2 | 3 | 4 | 5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? value
    : 1;
}

function buildNormalizedPattern(observation: ExtractedPhraseObservation): string {
  return normalizeText(observation.normalizedText);
}

function buildRepresentativeText(
  observation: ExtractedPhraseObservation,
): string {
  return (
    normalizeText(observation.rawText) ||
    normalizeText(observation.normalizedText)
  );
}

function buildMetadata(observation: ExtractedPhraseObservation) {
  const detectedTone = normalizeText(observation.detectedTone);
  const estimatedStateLevel = normalizeStateAffinityLevel(
    observation.estimatedStateLevel,
  );

  return {
    detected_tone: detectedTone || null,
    estimated_state_level: estimatedStateLevel,
    is_noise: Boolean(observation.isNoise),
    is_sensitive: Boolean(observation.isSensitive),
  };
}

function shouldSkipObservation(observation: ExtractedPhraseObservation): boolean {
  if (observation.isSensitive) return true;
  if (observation.isNoise) return true;
  if (normalizeText(observation.detectedIntent) === "不明") return true;

  return false;
}

export async function upsertPhrasePattern(
  params: UpsertPhrasePatternParams,
): Promise<UpsertPhrasePatternResult> {
  const { supabase, userId, observation } = params;

  if (shouldSkipObservation(observation)) {
    return {
      ok: true,
      patternId: null,
      action: "skipped",
    };
  }

  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) {
    return {
      ok: false,
      error: new Error("Missing userId."),
      patternId: null,
      action: "skipped",
    };
  }

  const normalizedText = buildNormalizedPattern(observation);
  const representativeText = buildRepresentativeText(observation);

  if (!normalizedText || !representativeText) {
    return {
      ok: true,
      patternId: null,
      action: "skipped",
    };
  }

  const language = normalizeLanguage(observation.language);
  const intentLabel = normalizeText(observation.detectedIntent) || null;
  const metadata = buildMetadata(observation);

  const existing = await supabase
    .from(PHRASE_PATTERNS_TABLE)
    .select("id, evidence_count")
    .eq("user_id", normalizedUserId)
    .eq("language", language)
    .eq("normalized_text", normalizedText)
    .eq("status", "active")
    .maybeSingle<PhrasePatternRow>();

  if (existing.error) {
    return {
      ok: false,
      error: existing.error,
      patternId: null,
      action: "skipped",
    };
  }

  if (existing.data?.id) {
    const nextEvidenceCount = Number(existing.data.evidence_count ?? 0) + 1;

    const { error } = await supabase
      .from(PHRASE_PATTERNS_TABLE)
      .update({
        representative_text: representativeText,
        intent_label: intentLabel,
        evidence_count: nextEvidenceCount,
        metadata,
      })
      .eq("id", existing.data.id);

    if (error) {
      return {
        ok: false,
        error,
        patternId: null,
        action: "skipped",
      };
    }

    return {
      ok: true,
      patternId: existing.data.id,
      action: "updated",
    };
  }

  const inserted = await supabase
    .from(PHRASE_PATTERNS_TABLE)
    .insert({
      user_id: normalizedUserId,
      language,
      normalized_text: normalizedText,
      representative_text: representativeText,
      phrase_type: null,
      intent_label: intentLabel,
      evidence_count: 1,
      weight: 1,
      metadata,
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();

  if (inserted.error) {
    return {
      ok: false,
      error: inserted.error,
      patternId: null,
      action: "skipped",
    };
  }

  return {
    ok: true,
    patternId: normalizeText(inserted.data?.id) || null,
    action: "inserted",
  };
}