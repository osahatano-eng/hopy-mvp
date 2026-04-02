// /app/api/chat/_lib/memories/collectMemoryCandidates.ts

import type { CollectedMemoryCandidate } from "./types";
import { isMemoryType } from "./types";

type CollectMemoryCandidatesParams = {
  payload: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function readSaveHint(value: unknown): "save" | "skip" | null {
  return value === "save" || value === "skip" ? value : null;
}

function readThreadSummary(payload: Record<string, unknown>): Record<string, unknown> | null {
  const value = payload.thread_summary;
  return isRecord(value) ? value : null;
}

function readFallbackThreadId(payload: Record<string, unknown>): string | null {
  const threadSummary = readThreadSummary(payload);
  if (threadSummary) {
    return (
      readNullableString(threadSummary.thread_id) ??
      readNullableString(threadSummary.id)
    );
  }

  return null;
}

function readFallbackMessageId(payload: Record<string, unknown>): string | null {
  const threadSummary = readThreadSummary(payload);
  if (threadSummary) {
    return (
      readNullableString(threadSummary.latest_reply_id) ??
      readNullableString(threadSummary.reply_id) ??
      readNullableString(threadSummary.message_id)
    );
  }

  return null;
}

function normalizeMemoryCandidate(
  raw: unknown,
  fallbackThreadId: string | null,
  fallbackMessageId: string | null,
): CollectedMemoryCandidate | null {
  if (!isRecord(raw)) return null;

  const body = readString(raw.body)?.trim() ?? "";
  if (!body) return null;

  const memoryType = raw.memory_type;
  if (!isMemoryType(memoryType)) return null;

  const sourceThreadId =
    readNullableString(raw.source_thread_id) ?? fallbackThreadId;

  const sourceMessageId =
    readNullableString(raw.source_message_id) ?? fallbackMessageId;

  return {
    body,
    memory_type: memoryType,
    source_type: "auto",
    source_thread_id: sourceThreadId,
    source_message_id: sourceMessageId,
    save_hint: readSaveHint(raw.save_hint),
    confidence: readConfidence(raw.confidence),
  };
}

export function collectMemoryCandidates(
  params: CollectMemoryCandidatesParams,
): CollectedMemoryCandidate[] {
  const payload = params.payload;
  if (!isRecord(payload)) return [];

  const rawCandidates = payload.memory_candidates;
  if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) {
    return [];
  }

  const fallbackThreadId = readFallbackThreadId(payload);
  const fallbackMessageId = readFallbackMessageId(payload);

  const normalized: CollectedMemoryCandidate[] = [];

  for (const rawCandidate of rawCandidates) {
    const candidate = normalizeMemoryCandidate(
      rawCandidate,
      fallbackThreadId,
      fallbackMessageId,
    );

    if (!candidate) continue;
    normalized.push(candidate);
  }

  return normalized;
}