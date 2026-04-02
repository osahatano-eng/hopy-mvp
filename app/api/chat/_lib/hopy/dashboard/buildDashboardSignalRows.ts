// /app/api/chat/_lib/hopy/dashboard/buildDashboardSignalRows.ts

import type { DashboardSignalCandidate, DashboardSignalType } from "./extractDashboardSignals";

export type DashboardSignalInsertRow = {
  user_id: string;
  source_thread_id: string | null;
  source_message_id: string | null;
  signal_type: DashboardSignalType;
  signal_value: number;
  observed_at: string;
  body: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type BuildDashboardSignalRowsArgs = {
  userId: string;
  candidates: DashboardSignalCandidate[];
  sourceThreadId?: string | null;
  sourceMessageId?: string | null;
  observedAt?: string | Date | null;
  now?: string | Date | null;
};

const MAX_BODY_LENGTH = 200;

function normalizeString(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function normalizeNullableString(input: unknown): string | null {
  const v = normalizeString(input);
  return v || null;
}

function normalizeBody(input: unknown): string {
  const v = normalizeString(input);
  if (!v) return "";
  return v.length > MAX_BODY_LENGTH ? v.slice(0, MAX_BODY_LENGTH).trim() : v;
}

function normalizeSignalType(input: unknown): DashboardSignalType | null {
  const v = normalizeString(input).toLowerCase();
  if (v === "theme_continuity") return "theme_continuity";
  if (v === "support_need") return "support_need";
  if (v === "forward_motion") return "forward_motion";
  if (v === "stagnation") return "stagnation";
  if (v === "instability_sign") return "instability_sign";
  if (v === "continuation_intent") return "continuation_intent";
  if (v === "state_snapshot") return "state_snapshot";
  return null;
}

function normalizeSignalValue(input: unknown): number | null {
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  const v = Math.trunc(n);
  if (v < 1) return 1;
  if (v > 5) return 5;
  return v;
}

function normalizeIsoDate(input: unknown, fallback: string): string {
  if (input instanceof Date) {
    return input.toISOString();
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed) return trimmed;
  }
  return fallback;
}

function buildMetadata(candidate: DashboardSignalCandidate): Record<string, unknown> | null {
  return {
    body_preview: candidate.body,
  };
}

function toInsertRow(args: {
  userId: string;
  candidate: DashboardSignalCandidate;
  sourceThreadId: string | null;
  sourceMessageId: string | null;
  observedAt: string;
  nowIso: string;
}): DashboardSignalInsertRow | null {
  const userId = normalizeString(args.userId);
  const signalType = normalizeSignalType(args.candidate.signal_type);
  const signalValue = normalizeSignalValue(args.candidate.signal_value);
  const body = normalizeBody(args.candidate.body);

  if (!userId || !signalType || signalValue === null || !body) {
    return null;
  }

  return {
    user_id: userId,
    source_thread_id: args.sourceThreadId,
    source_message_id: args.sourceMessageId,
    signal_type: signalType,
    signal_value: signalValue,
    observed_at: args.observedAt,
    body,
    metadata: buildMetadata(args.candidate),
    created_at: args.nowIso,
    updated_at: args.nowIso,
  };
}

function dedupeRows(rows: DashboardSignalInsertRow[]): DashboardSignalInsertRow[] {
  const seen = new Set<string>();
  const result: DashboardSignalInsertRow[] = [];

  for (const row of rows) {
    const key = [
      row.user_id,
      row.source_thread_id ?? "",
      row.source_message_id ?? "",
      row.signal_type,
      row.signal_value,
      row.body,
      row.observed_at,
    ]
      .join("::")
      .toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}

export function buildDashboardSignalRows({
  userId,
  candidates,
  sourceThreadId = null,
  sourceMessageId = null,
  observedAt = null,
  now = null,
}: BuildDashboardSignalRowsArgs): DashboardSignalInsertRow[] {
  const safeUserId = normalizeString(userId);
  if (!safeUserId) return [];

  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  const safeSourceThreadId = normalizeNullableString(sourceThreadId);
  const safeSourceMessageId = normalizeNullableString(sourceMessageId);

  const nowIso = normalizeIsoDate(now, new Date().toISOString());
  const safeObservedAt = normalizeIsoDate(observedAt, nowIso);

  const rows = safeCandidates
    .map((candidate) =>
      toInsertRow({
        userId: safeUserId,
        candidate,
        sourceThreadId: safeSourceThreadId,
        sourceMessageId: safeSourceMessageId,
        observedAt: safeObservedAt,
        nowIso,
      }),
    )
    .filter((row): row is DashboardSignalInsertRow => row !== null);

  return dedupeRows(rows);
}