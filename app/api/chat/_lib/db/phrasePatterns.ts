// /app/api/chat/_lib/db/phrasePatterns.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type PhrasePatternUpsertInput = {
  language?: unknown;
  patternKey: unknown;
  surfaceExamples?: unknown;
  normalizedPattern: unknown;
  semanticLabel?: unknown;
  toneLabel?: unknown;
  stateAffinityLevel?: unknown;
  transitionHint?: unknown;
  safetyStatus?: unknown;
  usageCountIncrement?: unknown;
};

export type PhrasePatternRecord = {
  id: string;
  language: "ja" | "en";
  pattern_key: string;
  surface_examples: string[];
  normalized_pattern: string;
  semantic_label: string | null;
  tone_label: string | null;
  state_affinity_level: number | null;
  transition_hint: number | null;
  safety_status: "pending" | "approved" | "blocked";
  usage_count: number;
  created_at: string;
  updated_at: string;
};

type GetPhrasePatternParams = {
  supabase: SupabaseClient;
  language?: unknown;
  patternKey: unknown;
};

type UpsertPhrasePatternParams = {
  supabase: SupabaseClient;
  input: PhrasePatternUpsertInput;
};

type GetPhrasePatternResult =
  | { ok: true; pattern: PhrasePatternRecord | null }
  | { ok: false; error: unknown; pattern: null };

type UpsertPhrasePatternResult =
  | { ok: true; pattern: PhrasePatternRecord }
  | { ok: false; error: unknown };

function normalizeRequired(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeOptional(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function normalizeLanguage(value: unknown): "ja" | "en" {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "en" ? "en" : "ja";
}

function normalizeLevel(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > 5) return null;
  return n;
}

function normalizeSafetyStatus(
  value: unknown,
): "pending" | "approved" | "blocked" {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "approved") return "approved";
  if (s === "blocked") return "blocked";
  return "pending";
}

function normalizeUsageCountIncrement(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  const i = Math.trunc(n);
  return i > 0 ? i : 1;
}

function normalizeSurfaceExamples(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const s = normalizeRequired(item);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    result.push(s);
    if (result.length >= 20) break;
  }

  return result;
}

function mergeSurfaceExamples(
  current: unknown,
  incoming: unknown,
  limit = 20,
): string[] {
  const merged = [
    ...normalizeSurfaceExamples(current),
    ...normalizeSurfaceExamples(incoming),
  ];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of merged) {
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= limit) break;
  }

  return result;
}

export async function getPhrasePattern(
  params: GetPhrasePatternParams,
): Promise<GetPhrasePatternResult> {
  const { supabase, language, patternKey } = params;

  const normalizedLanguage = normalizeLanguage(language);
  const normalizedPatternKey = normalizeRequired(patternKey);

  if (!normalizedPatternKey) {
    return {
      ok: false,
      error: new Error("patternKey is required."),
      pattern: null,
    };
  }

  const { data, error } = await supabase
    .from("phrase_patterns")
    .select("*")
    .eq("language", normalizedLanguage)
    .eq("pattern_key", normalizedPatternKey)
    .maybeSingle<PhrasePatternRecord>();

  if (error) {
    return {
      ok: false,
      error,
      pattern: null,
    };
  }

  return {
    ok: true,
    pattern: data ?? null,
  };
}

export async function upsertPhrasePattern(
  params: UpsertPhrasePatternParams,
): Promise<UpsertPhrasePatternResult> {
  const { supabase, input } = params;

  const language = normalizeLanguage(input.language);
  const pattern_key = normalizeRequired(input.patternKey);
  const normalized_pattern = normalizeRequired(input.normalizedPattern);

  if (!pattern_key || !normalized_pattern) {
    return {
      ok: false,
      error: new Error("patternKey and normalizedPattern are required."),
    };
  }

  const existingResult = await getPhrasePattern({
    supabase,
    language,
    patternKey: pattern_key,
  });

  if (!existingResult.ok) {
    return {
      ok: false,
      error: existingResult.error,
    };
  }

  const semantic_label = normalizeOptional(input.semanticLabel);
  const tone_label = normalizeOptional(input.toneLabel);
  const state_affinity_level = normalizeLevel(input.stateAffinityLevel);
  const transition_hint = normalizeLevel(input.transitionHint);
  const safety_status = normalizeSafetyStatus(input.safetyStatus);
  const usageIncrement = normalizeUsageCountIncrement(input.usageCountIncrement);
  const incomingExamples = normalizeSurfaceExamples(input.surfaceExamples);

  if (existingResult.pattern) {
    const current = existingResult.pattern;

    const updatePayload = {
      surface_examples: mergeSurfaceExamples(
        current.surface_examples,
        incomingExamples,
      ),
      normalized_pattern,
      semantic_label: semantic_label ?? current.semantic_label,
      tone_label: tone_label ?? current.tone_label,
      state_affinity_level:
        state_affinity_level ?? current.state_affinity_level,
      transition_hint: transition_hint ?? current.transition_hint,
      safety_status,
      usage_count: (Number(current.usage_count) || 0) + usageIncrement,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("phrase_patterns")
      .update(updatePayload)
      .eq("id", current.id)
      .select("*")
      .single<PhrasePatternRecord>();

    if (error || !data) {
      return {
        ok: false,
        error: error ?? new Error("Failed to update phrase pattern."),
      };
    }

    return {
      ok: true,
      pattern: data,
    };
  }

  const insertPayload = {
    language,
    pattern_key,
    surface_examples: incomingExamples,
    normalized_pattern,
    semantic_label,
    tone_label,
    state_affinity_level,
    transition_hint,
    safety_status,
    usage_count: usageIncrement,
  };

  const { data, error } = await supabase
    .from("phrase_patterns")
    .insert(insertPayload)
    .select("*")
    .single<PhrasePatternRecord>();

  if (error || !data) {
    return {
      ok: false,
      error: error ?? new Error("Failed to insert phrase pattern."),
    };
  }

  return {
    ok: true,
    pattern: data,
  };
}