// /app/api/chat/_lib/db/phraseObservations.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExtractedPhraseObservation } from "../learning/extractPhraseObservations";

type InsertPhraseObservationParams = {
  supabase: SupabaseClient;
  messageId: string;
  threadId: string;
  userId: string;
  observation: ExtractedPhraseObservation;
};

type InsertPhraseObservationResult =
  | { ok: true }
  | { ok: false; error: unknown };

type InsertPhraseObservationsParams = {
  supabase: SupabaseClient;
  messageId: string;
  threadId: string;
  userId: string;
  observations: ExtractedPhraseObservation[];
};

type InsertPhraseObservationsResult =
  | { ok: true; insertedCount: number }
  | { ok: false; error: unknown; insertedCount: number };

type PhraseObservationRow = {
  source_message_id: string;
  thread_id: string;
  user_id: string;
  language: "ja" | "en";
  original_text: string;
  normalized_text: string;
  phrase_type: string | null;
  intent_label: string | null;
  evidence_count: number;
  weight: number;
  metadata: {
    detected_tone: string | null;
    estimated_state_level: number | null;
    is_noise: boolean;
    is_sensitive: boolean;
  };
  status: "active";
};

const PHRASE_OBSERVATIONS_TABLE = "phrase_observations";

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

function normalizeEstimatedStateLevel(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > 5) return null;
  return n;
}

function buildPhraseObservationRow(args: {
  messageId: string;
  threadId: string;
  userId: string;
  observation: ExtractedPhraseObservation;
}): PhraseObservationRow | null {
  const { messageId, threadId, userId, observation } = args;

  const source_message_id = normalizeRequired(messageId);
  const thread_id = normalizeRequired(threadId);
  const user_id = normalizeRequired(userId);
  const original_text = normalizeRequired(observation.rawText);
  const normalized_text = normalizeRequired(observation.normalizedText);

  if (
    !source_message_id ||
    !thread_id ||
    !user_id ||
    !original_text ||
    !normalized_text
  ) {
    return null;
  }

  return {
    source_message_id,
    thread_id,
    user_id,
    language: normalizeLanguage(observation.language),
    original_text,
    normalized_text,
    phrase_type: null,
    intent_label: normalizeOptional(observation.detectedIntent),
    evidence_count: 1,
    weight: 1,
    metadata: {
      detected_tone: normalizeOptional(observation.detectedTone),
      estimated_state_level: normalizeEstimatedStateLevel(
        observation.estimatedStateLevel,
      ),
      is_noise: Boolean(observation.isNoise),
      is_sensitive: Boolean(observation.isSensitive),
    },
    status: "active",
  };
}

export async function insertPhraseObservation(
  params: InsertPhraseObservationParams,
): Promise<InsertPhraseObservationResult> {
  const { supabase, messageId, threadId, userId, observation } = params;

  const row = buildPhraseObservationRow({
    messageId,
    threadId,
    userId,
    observation,
  });

  if (!row) {
    return {
      ok: false,
      error: new Error("Invalid phrase observation payload."),
    };
  }

  const { error } = await supabase.from(PHRASE_OBSERVATIONS_TABLE).insert(row);

  if (error) {
    return {
      ok: false,
      error,
    };
  }

  return {
    ok: true,
  };
}

export async function insertPhraseObservations(
  params: InsertPhraseObservationsParams,
): Promise<InsertPhraseObservationsResult> {
  const { supabase, messageId, threadId, userId, observations } = params;

  const rows = (observations ?? [])
    .map((observation) =>
      buildPhraseObservationRow({
        messageId,
        threadId,
        userId,
        observation,
      }),
    )
    .filter((row): row is PhraseObservationRow => row !== null);

  if (rows.length === 0) {
    return {
      ok: true,
      insertedCount: 0,
    };
  }

  const { error } = await supabase.from(PHRASE_OBSERVATIONS_TABLE).insert(rows);

  if (error) {
    return {
      ok: false,
      error,
      insertedCount: 0,
    };
  }

  return {
    ok: true,
    insertedCount: rows.length,
  };
}