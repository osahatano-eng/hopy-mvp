// /app/api/chat/_lib/db/memories.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CollectedMemoryCandidate,
  MemoryQueryCondition,
  MemorySourceType,
  MemoryStatus,
  SavedMemory,
} from "../memories/types";
import {
  buildPromptMemoryRows,
  buildPromptText,
  clampImportance,
  clampPhaseValue,
  clampText,
  dedupeCandidatesKeepMaxImportance,
  dedupePromptRowsKeepMaxImportance,
  isPolluted,
  mapRowToSavedMemory,
  norm,
  normalizeMemoryType,
  normalizeNullableBoolean,
  normalizeSourceType,
  normalizeStatus,
  type MemoryItem,
  type RawMemoryRow,
} from "./memoriesFilters";
import {
  selectActiveMemoryIdsByBodies,
  selectLatestActiveMemoryCreatedAt,
  selectPromptMemoryRows,
} from "./memoriesQueries";

type InsertMemoriesReason =
  | "inserted"
  | "duplicate"
  | "filtered"
  | "empty_items";

export async function selectMemories(params: {
  supabase: SupabaseClient;
  condition: MemoryQueryCondition;
}): Promise<{ ok: boolean; memories: SavedMemory[]; error?: unknown }> {
  const { supabase, condition } = params;

  let query = supabase
    .from("memories")
    .select(
      [
        "id",
        "user_id",
        "body",
        "content",
        "source_type",
        "memory_type",
        "status",
        "created_at",
        "updated_at",
        "deleted_at",
        "source_message_id",
        "source_thread_id",
      ].join(", "),
    )
    .eq("user_id", condition.user_id);

  if (condition.status) {
    query = query.eq("status", condition.status);
  }

  if (condition.source_type) {
    query = query.eq("source_type", condition.source_type);
  }

  if (condition.memory_type) {
    query = query.eq("memory_type", condition.memory_type);
  }

  if (condition.source_thread_id) {
    query = query.eq("source_thread_id", condition.source_thread_id);
  }

  if (condition.search_text && norm(condition.search_text)) {
    query = query.ilike("body", `%${norm(condition.search_text)}%`);
  }

  query = query
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (condition.limit && condition.limit > 0) {
    query = query.limit(Math.trunc(condition.limit));
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, memories: [], error };
  }

  const memories = (data ?? [])
    .map((row) => mapRowToSavedMemory((row ?? {}) as RawMemoryRow))
    .filter(Boolean) as SavedMemory[];

  return { ok: true, memories };
}

export async function insertMemoryRows(params: {
  supabase: SupabaseClient;
  userId: string;
  sourceType: MemorySourceType;
  status?: MemoryStatus;
  sourceMessageId?: string | null;
  sourceThreadId?: string | null;
  candidates: Array<
    CollectedMemoryCandidate & {
      importance?: number | null;
    }
  >;
  state_level?: number | null;
  current_phase?: number | null;
  state_changed?: boolean | null;
}): Promise<{ ok: boolean; inserted: number; error?: unknown }> {
  const {
    supabase,
    userId,
    sourceType,
    status = "active",
    sourceMessageId = null,
    sourceThreadId = null,
    candidates,
    state_level = null,
    current_phase = null,
    state_changed = null,
  } = params;

  if (!candidates.length) {
    return { ok: true, inserted: 0 };
  }

  const nowIso = new Date().toISOString();
  const normalizedStateLevel = clampPhaseValue(state_level);
  const normalizedCurrentPhase = clampPhaseValue(current_phase);
  const normalizedStateChanged = normalizeNullableBoolean(state_changed);
  const normalizedSourceType = normalizeSourceType(sourceType);
  const normalizedStatus = normalizeStatus(status);

  const payload = candidates
    .map((candidate) => {
      const body = clampText(candidate.body, 180);
      if (!body) return null;

      return {
        user_id: userId,
        body,
        content: body,
        source_type: normalizedSourceType,
        memory_type: normalizeMemoryType(candidate.memory_type),
        status: normalizedStatus,
        source_message_id: candidate.source_message_id ?? sourceMessageId,
        source_thread_id: candidate.source_thread_id ?? sourceThreadId,
        state_level: normalizedStateLevel,
        current_phase: normalizedCurrentPhase,
        state_changed: normalizedStateChanged,
        updated_at: nowIso,
        importance: clampImportance(candidate.importance ?? 3),
      };
    })
    .filter(Boolean);

  if (!payload.length) {
    return { ok: true, inserted: 0 };
  }

  const { error } = await supabase.from("memories").insert(payload);
  return {
    ok: !error,
    inserted: error ? 0 : payload.length,
    error,
  };
}

export async function touchMemoryRows(params: {
  supabase: SupabaseClient;
  ids: string[];
}): Promise<{ ok: boolean; touched: number; error?: unknown }> {
  const { supabase, ids } = params;
  const normalizedIds = ids.map((id) => norm(id)).filter(Boolean);

  if (!normalizedIds.length) {
    return { ok: true, touched: 0 };
  }

  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("memories")
    .update({
      updated_at: nowIso,
    })
    .in("id", normalizedIds);

  return {
    ok: !error,
    touched: error ? 0 : normalizedIds.length,
    error,
  };
}

export async function updateMemoryRowsStatus(params: {
  supabase: SupabaseClient;
  ids: string[];
  status: MemoryStatus;
}): Promise<{ ok: boolean; updated: number; error?: unknown }> {
  const { supabase, ids, status } = params;
  const normalizedIds = ids.map((id) => norm(id)).filter(Boolean);

  if (!normalizedIds.length) {
    return { ok: true, updated: 0 };
  }

  const nowIso = new Date().toISOString();
  const nextStatus = normalizeStatus(status);

  const payload =
    nextStatus === "trash"
      ? {
          status: nextStatus,
          deleted_at: nowIso,
          updated_at: nowIso,
        }
      : {
          status: nextStatus,
          deleted_at: null,
          updated_at: nowIso,
        };

  const { error } = await supabase
    .from("memories")
    .update(payload)
    .in("id", normalizedIds);

  return {
    ok: !error,
    updated: error ? 0 : normalizedIds.length,
    error,
  };
}

/**
 * Prompt 注入用の既存互換 export
 * 今回は呼び出し互換を壊さず、取得は prompt 用に importance を保持したまま行う。
 */
export async function loadMemoriesForPrompt(params: {
  supabase: SupabaseClient;
  userId: string;
  limit?: number;
  uiLang?: "ja" | "en";
}): Promise<{ ok: boolean; text: string; error?: unknown }> {
  const { supabase, userId, limit = 30, uiLang = "ja" } = params;

  const fetchN = Math.max(1, Math.trunc(limit || 0));

  const result = await selectPromptMemoryRows({
    supabase,
    userId,
    limit: fetchN,
  });

  if (!result.ok) {
    return { ok: false, text: "", error: result.error };
  }

  const rows = dedupePromptRowsKeepMaxImportance(
    buildPromptMemoryRows(result.rows),
  );

  const text = buildPromptText({
    rows,
    uiLang,
    limit,
  });

  return { ok: true, text };
}

export async function shouldWriteMemory(params: {
  supabase: SupabaseClient;
  userId: string;
  minIntervalSec: number;
  sourceType?: MemorySourceType;
}): Promise<{ ok: boolean; allow: boolean; reason?: string; error?: unknown }> {
  const { supabase, userId, minIntervalSec, sourceType = "auto" } = params;
  const normalizedSourceType = normalizeSourceType(sourceType);

  const latestResult = await selectLatestActiveMemoryCreatedAt({
    supabase,
    userId,
    sourceType: normalizedSourceType,
  });

  if (!latestResult.ok) {
    return { ok: false, allow: false, error: latestResult.error };
  }

  const latest = latestResult.created_at;
  if (!latest) return { ok: true, allow: true };

  const time = new Date(String(latest)).getTime();
  if (!Number.isFinite(time)) return { ok: true, allow: true };

  const now = Date.now();
  const diffSec = Math.floor((now - time) / 1000);

  if (diffSec < minIntervalSec) {
    return {
      ok: true,
      allow: false,
      reason: `rate_limited_${normalizedSourceType}_${diffSec}s`,
    };
  }

  return { ok: true, allow: true };
}

export async function insertMemories(params: {
  supabase: SupabaseClient;
  userId: string;
  sourceMessageId: string;
  sourceThreadId?: string | null;
  items: MemoryItem[];
  uiLang?: "ja" | "en";
  sourceType?: MemorySourceType;
  status?: MemoryStatus;
  state_level?: number | null;
  current_phase?: number | null;
  state_changed?: boolean | null;
}): Promise<{
  ok: boolean;
  inserted: number;
  reason?: InsertMemoriesReason;
  error?: unknown;
}> {
  const {
    supabase,
    userId,
    sourceMessageId,
    sourceThreadId = null,
    items,
    uiLang = "ja",
    sourceType = "auto",
    status = "active",
    state_level = null,
    current_phase = null,
    state_changed = null,
  } = params;

  if (!items.length) {
    return { ok: true, inserted: 0, reason: "empty_items" };
  }

  const normalizedSourceType = normalizeSourceType(sourceType);

  const rawCandidates: Array<
    CollectedMemoryCandidate & {
      importance: number;
    }
  > = items
    .map((item) => {
      const content = clampText(item.content ?? item.body, 180);
      if (!content) return null;

      if (normalizedSourceType === "auto" && isPolluted(content, uiLang)) {
        return null;
      }

      return {
        body: content,
        memory_type: normalizeMemoryType(item.memory_type),
        source_type: "auto",
        source_message_id: sourceMessageId,
        source_thread_id: sourceThreadId,
        save_hint: "save",
        confidence: null,
        importance: clampImportance(item.importance ?? 1),
      };
    })
    .filter(Boolean) as Array<
    CollectedMemoryCandidate & {
      importance: number;
    }
  >;

  if (!rawCandidates.length) {
    return { ok: true, inserted: 0, reason: "filtered" };
  }

  const deduped = dedupeCandidatesKeepMaxImportance(
    rawCandidates.map((candidate) => ({
      content: candidate.body,
      importance: candidate.importance,
      memory_type: candidate.memory_type,
    })),
  );

  const candidateBodies = Array.from(
    new Set(deduped.map((item) => norm(item.content)).filter(Boolean)),
  );

  const existingResult = await selectActiveMemoryIdsByBodies({
    supabase,
    userId,
    sourceType: normalizedSourceType,
    bodies: candidateBodies,
  });

  if (!existingResult.ok) {
    return { ok: false, inserted: 0, error: existingResult.error };
  }

  const existingIdByContent = new Map<string, string>();
  for (const memory of existingResult.rows) {
    const body = norm(memory.body);
    if (!body) continue;
    if (!existingIdByContent.has(body)) {
      existingIdByContent.set(body, memory.id);
    }
  }

  const duplicateIds = Array.from(
    new Set(
      deduped
        .map((item) => existingIdByContent.get(norm(item.content)) ?? "")
        .filter(Boolean),
    ),
  );

  if (duplicateIds.length) {
    const touched = await touchMemoryRows({
      supabase,
      ids: duplicateIds,
    });

    if (!touched.ok) {
      return { ok: false, inserted: 0, error: touched.error };
    }
  }

  const toInsert = deduped.filter(
    (item) => !existingIdByContent.has(norm(item.content)),
  );

  if (!toInsert.length) {
    return { ok: true, inserted: 0, reason: "duplicate" };
  }

  const inserted = await insertMemoryRows({
    supabase,
    userId,
    sourceType: normalizedSourceType,
    status,
    sourceMessageId,
    sourceThreadId,
    candidates: toInsert.map((item) => ({
      body: item.content,
      memory_type: item.memory_type,
      source_type: "auto",
      source_message_id: sourceMessageId,
      source_thread_id: sourceThreadId,
      save_hint: "save",
      confidence: null,
      importance: item.importance,
    })),
    state_level,
    current_phase,
    state_changed,
  });

  return {
    ok: inserted.ok,
    inserted: inserted.inserted,
    reason: inserted.ok ? "inserted" : undefined,
    error: inserted.error,
  };
}

export async function softDeletePollutedMemories(params: {
  supabase: SupabaseClient;
  userId: string;
  uiLang?: "ja" | "en";
  limit?: number;
}): Promise<{ ok: boolean; deleted: number; error?: unknown }> {
  const { supabase, userId, uiLang = "ja", limit = 300 } = params;

  const result = await selectMemories({
    supabase,
    condition: {
      user_id: userId,
      status: "active",
      source_type: "auto",
      limit,
    },
  });

  if (!result.ok) {
    return { ok: false, deleted: 0, error: result.error };
  }

  const ids = result.memories
    .filter((memory) => isPolluted(memory.body, uiLang))
    .map((memory) => memory.id)
    .filter(Boolean);

  if (!ids.length) {
    return { ok: true, deleted: 0 };
  }

  const updated = await updateMemoryRowsStatus({
    supabase,
    ids,
    status: "trash",
  });

  return {
    ok: updated.ok,
    deleted: updated.updated,
    error: updated.error,
  };
}