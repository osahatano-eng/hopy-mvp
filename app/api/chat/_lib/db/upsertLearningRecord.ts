// /app/api/chat/_lib/db/upsertLearningRecord.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LearningCandidate } from "../hopy/learning/extractLearningCandidates";

export type LearningRecordRow = {
  id: string;
  user_id: string | null;
  learning_type: string;
  body: string;
  cue: string;
  polarity: "promote" | "avoid";
  scope: "global" | "user" | "state_specific";
  weight: number;
  evidence_count: number;
  state_level: 1 | 2 | 3 | 4 | 5 | null;
  current_phase: 1 | 2 | 3 | 4 | 5 | null;
  source_type: "auto" | "manual" | "feedback";
  source_message_id: string | null;
  source_thread_id: string | null;
  status: "active" | "trash";
  created_at: string;
  updated_at: string;
};

export type UpsertLearningRecordInput = {
  supabase: SupabaseClient;
  candidate: LearningCandidate;
};

export type UpsertLearningRecordResult =
  | {
      ok: true;
      action: "inserted";
      record: LearningRecordRow;
    }
  | {
      ok: true;
      action: "updated";
      record: LearningRecordRow;
    }
  | {
      ok: false;
      action: "noop";
      reason: string;
    };

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function isValidStateLevel(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function isValidCurrentPhase(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function clampWeight(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(5, Math.round(value)));
}

function clampEvidenceCount(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }
  return value;
}

function computeNextWeight(params: {
  existingWeight: number;
  existingEvidenceCount: number;
  incomingWeight: number;
}): number {
  const mergedEvidence = params.existingEvidenceCount + 1;
  const boosted =
    Math.max(params.existingWeight, params.incomingWeight) +
    (mergedEvidence >= 5 ? 1 : 0);

  return clampWeight(boosted);
}

function toInsertPayload(candidate: LearningCandidate) {
  return {
    user_id:
      candidate.scope === "user" ? candidate.userId : null,
    learning_type: candidate.learningType,
    body: normalizeText(candidate.body),
    cue: normalizeText(candidate.cue),
    polarity: candidate.polarity,
    scope: candidate.scope,
    weight: clampWeight(candidate.weight),
    evidence_count: clampEvidenceCount(candidate.evidenceCount),
    state_level: isValidStateLevel(candidate.stateLevel) ? candidate.stateLevel : null,
    current_phase: isValidCurrentPhase(candidate.currentPhase)
      ? candidate.currentPhase
      : null,
    source_type: candidate.sourceType,
    source_message_id: candidate.sourceMessageId,
    source_thread_id: candidate.sourceThreadId,
    status: candidate.status,
  };
}

async function findExistingLearningRecord(
  supabase: SupabaseClient,
  candidate: LearningCandidate,
): Promise<LearningRecordRow | null> {
  let query = supabase
    .from("hopy_response_learning")
    .select("*")
    .eq("learning_type", candidate.learningType)
    .eq("cue", normalizeText(candidate.cue))
    .eq("scope", candidate.scope)
    .eq("polarity", candidate.polarity)
    .eq("status", "active")
    .limit(1);

  if (candidate.scope === "global") {
    query = query.is("user_id", null).is("state_level", null);
  } else if (candidate.scope === "user") {
    query = query.eq("user_id", candidate.userId ?? "").is("state_level", null);
  } else {
    query = query
      .is("user_id", null)
      .eq("state_level", candidate.stateLevel ?? -1);
  }

  const { data, error } = await query.maybeSingle<LearningRecordRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function insertLearningRecord(
  supabase: SupabaseClient,
  candidate: LearningCandidate,
): Promise<LearningRecordRow> {
  const payload = toInsertPayload(candidate);

  const { data, error } = await supabase
    .from("hopy_response_learning")
    .insert(payload)
    .select("*")
    .single<LearningRecordRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function updateLearningRecord(
  supabase: SupabaseClient,
  existing: LearningRecordRow,
  candidate: LearningCandidate,
): Promise<LearningRecordRow> {
  const nextEvidenceCount = clampEvidenceCount(existing.evidence_count + 1);
  const nextWeight = computeNextWeight({
    existingWeight: existing.weight,
    existingEvidenceCount: existing.evidence_count,
    incomingWeight: candidate.weight,
  });

  const normalizedBody = normalizeText(candidate.body);
  const nextBody =
    normalizedBody.length >= normalizeText(existing.body).length
      ? normalizedBody
      : existing.body;

  const updatePayload = {
    body: nextBody,
    weight: nextWeight,
    evidence_count: nextEvidenceCount,
    current_phase: isValidCurrentPhase(candidate.currentPhase)
      ? candidate.currentPhase
      : existing.current_phase,
    source_type: candidate.sourceType,
    source_message_id: candidate.sourceMessageId ?? existing.source_message_id,
    source_thread_id: candidate.sourceThreadId ?? existing.source_thread_id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("hopy_response_learning")
    .update(updatePayload)
    .eq("id", existing.id)
    .select("*")
    .single<LearningRecordRow>();

  if (error) {
    throw error;
  }

  return data;
}

function validateCandidate(candidate: LearningCandidate): string | null {
  if (!normalizeText(candidate.body)) {
    return "candidate.body is empty";
  }

  if (!normalizeText(candidate.cue)) {
    return "candidate.cue is empty";
  }

  if (
    candidate.scope === "state_specific" &&
    !isValidStateLevel(candidate.stateLevel)
  ) {
    return "state_specific candidate requires valid stateLevel";
  }

  if (candidate.scope === "user" && !candidate.userId) {
    return "user candidate requires userId";
  }

  if (candidate.status !== "active" && candidate.status !== "trash") {
    return "candidate.status is invalid";
  }

  return null;
}

export async function upsertLearningRecord(
  input: UpsertLearningRecordInput,
): Promise<UpsertLearningRecordResult> {
  const validationError = validateCandidate(input.candidate);
  if (validationError) {
    return {
      ok: false,
      action: "noop",
      reason: validationError,
    };
  }

  const existing = await findExistingLearningRecord(
    input.supabase,
    input.candidate,
  );

  if (!existing) {
    const inserted = await insertLearningRecord(input.supabase, input.candidate);
    return {
      ok: true,
      action: "inserted",
      record: inserted,
    };
  }

  const updated = await updateLearningRecord(
    input.supabase,
    existing,
    input.candidate,
  );

  return {
    ok: true,
    action: "updated",
    record: updated,
  };
}