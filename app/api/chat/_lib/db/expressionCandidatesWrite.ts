// /app/api/chat/_lib/db/expressionCandidatesWrite.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpressionCandidate } from "../hopy/expression/extractExpressionCandidates";
import { shouldPersistExpressionCandidate } from "../hopy/expression/shouldPersistExpressionCandidate";

export type ExpressionCandidateRow = {
  user_id: string;
  phrase: string;
  normalized_phrase: string;
  standard_form: string;
  category: string;
  tone: "negative" | "neutral" | "positive";
  context_summary: string;
  usage_count_hint: number;
  status: "active";
  source_thread_id: string | null;
  source_message_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WriteExpressionCandidatesInput = {
  supabase: SupabaseClient;
  userId: string;
  threadId?: string | null;
  sourceMessageId?: string | null;
  candidates: ExpressionCandidate[];
};

export type WriteExpressionCandidatesResult = {
  ok: boolean;
  attempted: number;
  inserted: number;
  skipped: number;
  reasons: Array<{
    normalizedPhrase: string;
    reason: string;
  }>;
};

const TABLE_NAME = "expression_candidates";
const ACTIVE_STATUS = "active";

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function normalizePhrase(input: string): string {
  return normalizeWhitespace(input)
    .toLowerCase()
    .replace(/[。、，．.!！?？"'`´‘’“”()\[\]{}<>]/g, "")
    .trim();
}

function clampUsageCountHint(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(5, Math.trunc(value)));
}

function buildRow(args: {
  userId: string;
  threadId?: string | null;
  sourceMessageId?: string | null;
  candidate: ExpressionCandidate;
  nowIso: string;
}): ExpressionCandidateRow {
  const phrase = normalizeWhitespace(String(args.candidate.phrase ?? ""));
  const normalizedPhrase =
    normalizePhrase(String(args.candidate.normalizedPhrase ?? "")) || normalizePhrase(phrase);

  return {
    user_id: args.userId,
    phrase,
    normalized_phrase: normalizedPhrase,
    standard_form: normalizeWhitespace(String(args.candidate.standardForm ?? "")),
    category: normalizeWhitespace(String(args.candidate.category ?? "")) || "other",
    tone:
      args.candidate.tone === "negative" ||
      args.candidate.tone === "positive" ||
      args.candidate.tone === "neutral"
        ? args.candidate.tone
        : "neutral",
    context_summary: normalizeWhitespace(String(args.candidate.contextSummary ?? "")),
    usage_count_hint: clampUsageCountHint(Number(args.candidate.usageCountHint ?? 1)),
    status: ACTIVE_STATUS,
    source_thread_id: args.threadId ? String(args.threadId) : null,
    source_message_id: args.sourceMessageId ? String(args.sourceMessageId) : null,
    created_at: args.nowIso,
    updated_at: args.nowIso,
  };
}

async function readExistingNormalizedPhrases(args: {
  supabase: SupabaseClient;
  userId: string;
  normalizedPhrases: string[];
}): Promise<Set<string>> {
  if (args.normalizedPhrases.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await args.supabase
    .from(TABLE_NAME)
    .select("normalized_phrase")
    .eq("user_id", args.userId)
    .eq("status", ACTIVE_STATUS)
    .in("normalized_phrase", args.normalizedPhrases);

  if (error) {
    throw error;
  }

  const found = new Set<string>();

  for (const row of data ?? []) {
    const normalized = normalizePhrase(String((row as { normalized_phrase?: string | null })?.normalized_phrase ?? ""));
    if (normalized) {
      found.add(normalized);
    }
  }

  return found;
}

export async function expressionCandidatesWrite(
  input: WriteExpressionCandidatesInput,
): Promise<WriteExpressionCandidatesResult> {
  const userId = normalizeWhitespace(String(input.userId ?? ""));
  const candidates = Array.isArray(input.candidates) ? input.candidates : [];

  if (!userId || candidates.length === 0) {
    return {
      ok: true,
      attempted: candidates.length,
      inserted: 0,
      skipped: candidates.length,
      reasons: [],
    };
  }

  const normalizedTargets = candidates
    .map((candidate) => normalizePhrase(String(candidate?.normalizedPhrase ?? "")) || normalizePhrase(String(candidate?.phrase ?? "")))
    .filter(Boolean);

  const existingNormalized = await readExistingNormalizedPhrases({
    supabase: input.supabase,
    userId,
    normalizedPhrases: Array.from(new Set(normalizedTargets)),
  });

  const batchSeen = new Set<string>(existingNormalized);
  const nowIso = new Date().toISOString();
  const rows: ExpressionCandidateRow[] = [];
  const reasons: Array<{ normalizedPhrase: string; reason: string }> = [];

  for (const candidate of candidates) {
    const normalizedPhrase =
      normalizePhrase(String(candidate?.normalizedPhrase ?? "")) || normalizePhrase(String(candidate?.phrase ?? ""));

    const decision = shouldPersistExpressionCandidate({
      candidate,
      existingNormalizedPhrases: Array.from(batchSeen),
    });

    if (!decision.shouldPersist) {
      reasons.push({
        normalizedPhrase,
        reason: decision.reason,
      });
      continue;
    }

    const row = buildRow({
      userId,
      threadId: input.threadId,
      sourceMessageId: input.sourceMessageId,
      candidate,
      nowIso,
    });

    if (!row.normalized_phrase) {
      reasons.push({
        normalizedPhrase,
        reason: "empty_normalized_phrase",
      });
      continue;
    }

    rows.push(row);
    batchSeen.add(row.normalized_phrase);
  }

  if (rows.length > 0) {
    const { error } = await input.supabase.from(TABLE_NAME).insert(rows);

    if (error) {
      throw error;
    }
  }

  return {
    ok: true,
    attempted: candidates.length,
    inserted: rows.length,
    skipped: candidates.length - rows.length,
    reasons,
  };
}

export default expressionCandidatesWrite;