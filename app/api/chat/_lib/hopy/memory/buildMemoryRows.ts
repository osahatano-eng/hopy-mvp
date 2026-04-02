// /app/api/chat/_lib/hopy/memory/buildMemoryRows.ts

import type { AutoMemoryCandidate } from "./extractAutoMemoryCandidates";

export type MemoryRowSourceType = "auto" | "manual";
export type MemoryRowType =
  | "trait"
  | "theme"
  | "support_context"
  | "dashboard_signal"
  | "manual_note";
export type MemoryRowStatus = "active" | "trash";

export type BuildMemoryRowsArgs = {
  userId: string;
  candidates: AutoMemoryCandidate[];
  sourceMessageId?: string | null;
  sourceThreadId?: string | null;
  now?: string | Date | null;
};

export type MemoryInsertRow = {
  user_id: string;
  body: string;
  source_type: MemoryRowSourceType;
  memory_type: MemoryRowType;
  status: MemoryRowStatus;
  source_message_id: string | null;
  source_thread_id: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeString(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function normalizeNullableString(input: unknown): string | null {
  const v = normalizeString(input);
  return v || null;
}

function normalizeSourceType(input: unknown): MemoryRowSourceType | null {
  const v = normalizeString(input).toLowerCase();
  if (v === "auto") return "auto";
  if (v === "manual") return "manual";
  return null;
}

function normalizeMemoryType(input: unknown): MemoryRowType | null {
  const v = normalizeString(input).toLowerCase();
  if (v === "trait") return "trait";
  if (v === "theme") return "theme";
  if (v === "support_context") return "support_context";
  if (v === "dashboard_signal") return "dashboard_signal";
  if (v === "manual_note") return "manual_note";
  return null;
}

function normalizeBody(input: unknown): string {
  return normalizeString(input);
}

function normalizeNow(input: unknown): string {
  if (input instanceof Date) {
    return input.toISOString();
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed) return trimmed;
  }
  return new Date().toISOString();
}

function toInsertRow(args: {
  userId: string;
  candidate: AutoMemoryCandidate;
  sourceMessageId: string | null;
  sourceThreadId: string | null;
  nowIso: string;
}): MemoryInsertRow | null {
  const userId = normalizeString(args.userId);
  const body = normalizeBody(args.candidate.body);
  const sourceType = normalizeSourceType(args.candidate.source_type);
  const memoryType = normalizeMemoryType(args.candidate.memory_type);

  if (!userId || !body || !sourceType || !memoryType) {
    return null;
  }

  return {
    user_id: userId,
    body,
    source_type: sourceType,
    memory_type: memoryType,
    status: "active",
    source_message_id: args.sourceMessageId,
    source_thread_id: args.sourceThreadId,
    created_at: args.nowIso,
    updated_at: args.nowIso,
  };
}

function dedupeRows(rows: MemoryInsertRow[]): MemoryInsertRow[] {
  const seen = new Set<string>();
  const result: MemoryInsertRow[] = [];

  for (const row of rows) {
    const key = `${row.user_id}::${row.memory_type}::${row.body}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}

export function buildMemoryRows({
  userId,
  candidates,
  sourceMessageId = null,
  sourceThreadId = null,
  now = null,
}: BuildMemoryRowsArgs): MemoryInsertRow[] {
  const safeUserId = normalizeString(userId);
  if (!safeUserId) return [];

  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  const safeSourceMessageId = normalizeNullableString(sourceMessageId);
  const safeSourceThreadId = normalizeNullableString(sourceThreadId);
  const nowIso = normalizeNow(now);

  const rows = safeCandidates
    .map((candidate) =>
      toInsertRow({
        userId: safeUserId,
        candidate,
        sourceMessageId: safeSourceMessageId,
        sourceThreadId: safeSourceThreadId,
        nowIso,
      }),
    )
    .filter((row): row is MemoryInsertRow => row !== null);

  return dedupeRows(rows);
}