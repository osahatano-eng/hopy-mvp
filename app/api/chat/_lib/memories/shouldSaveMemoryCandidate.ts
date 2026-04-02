// /app/api/chat/_lib/memories/shouldSaveMemoryCandidate.ts

import type { CollectedMemoryCandidate } from "./types";

type ShouldSaveMemoryCandidateResult =
  | {
      shouldSave: true;
      reason: "ok";
    }
  | {
      shouldSave: false;
      reason:
        | "invalid_candidate"
        | "empty_body"
        | "invalid_memory_type"
        | "invalid_source_type"
        | "save_hint_skip"
        | "low_confidence";
    };

type ShouldSaveMemoryCandidateParams = {
  candidate: CollectedMemoryCandidate | null | undefined;
};

const ALLOWED_MEMORY_TYPES = new Set([
  "trait",
  "theme",
  "support_context",
  "dashboard_signal",
  "manual_note",
] as const);

const AUTO_SOURCE_TYPE = "auto";
const MIN_CONFIDENCE = 0.3;

export function shouldSaveMemoryCandidate(
  params: ShouldSaveMemoryCandidateParams,
): ShouldSaveMemoryCandidateResult {
  const candidate = params.candidate;
  if (!candidate) {
    return { shouldSave: false, reason: "invalid_candidate" };
  }

  const body = typeof candidate.body === "string" ? candidate.body.trim() : "";
  if (!body) {
    return { shouldSave: false, reason: "empty_body" };
  }

  if (!ALLOWED_MEMORY_TYPES.has(candidate.memory_type)) {
    return { shouldSave: false, reason: "invalid_memory_type" };
  }

  if (candidate.source_type !== AUTO_SOURCE_TYPE) {
    return { shouldSave: false, reason: "invalid_source_type" };
  }

  if (candidate.save_hint === "skip") {
    return { shouldSave: false, reason: "save_hint_skip" };
  }

  if (
    typeof candidate.confidence === "number" &&
    Number.isFinite(candidate.confidence) &&
    candidate.confidence < MIN_CONFIDENCE
  ) {
    return { shouldSave: false, reason: "low_confidence" };
  }

  return { shouldSave: true, reason: "ok" };
}