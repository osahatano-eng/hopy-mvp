// /app/api/chat/_lib/route/memoryWrite.ts
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  insertMemoryRows,
  selectMemories,
  shouldWriteMemory,
  touchMemoryRows,
} from "../db/memories";
import { findDuplicateMemory } from "../memories/findDuplicateMemory";
import { shouldSaveMemoryCandidate } from "../memories/shouldSaveMemoryCandidate";
import type { CollectedMemoryCandidate, MemoryType } from "../memories/types";
import type { Lang } from "../router/simpleRouter";

export type MemoryWriteResult = {
  mem_write_attempted: boolean;
  mem_write_allowed: boolean;
  mem_write_inserted: number;
  mem_write_reason: string | null;
  mem_items_count: number;
  mem_parse_ok: boolean | null;
  mem_extract_preview: string | null;
  mem_used_heuristic: boolean | null;
};

type ConfirmedMemoryCandidate = {
  source_type?: string | null;
  memory_type?: string | null;
  body?: string | null;
  savable?: boolean | null;
  source_message_id?: string | null;
  source_thread_id?: string | null;
  thread_id?: string | null;
  save_hint?: "save" | "skip" | null;
  confidence?: number | null;
};

type CandidateWithImportance = CollectedMemoryCandidate & {
  importance: number;
};

const MEMORY_WRITE_DB_TIMEOUT_MS = 4000;

function debugInsertError(
  reason: string,
  err: unknown,
  debugSave: boolean,
): string {
  if (!debugSave) return reason;
  const detail = String(
    (err as any)?.message ?? (err as any)?.error ?? err ?? "",
  ).trim();
  return detail ? `${reason}:${detail}` : reason;
}

function normalizeMemoryMinIntervalSec(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 30;
  }

  const normalized = Math.trunc(value);

  if (normalized < 15) {
    return 15;
  }

  if (normalized > 30) {
    return 30;
  }

  return normalized;
}

function normalizeMemoryType(value: unknown): MemoryType {
  const v = String(value ?? "").trim();
  if (
    v === "trait" ||
    v === "theme" ||
    v === "support_context" ||
    v === "dashboard_signal" ||
    v === "manual_note"
  ) {
    return v;
  }
  return "theme";
}

function normalizeCandidateSourceType(
  value: unknown,
): "auto" | "manual" | "unknown" {
  const v = String(value ?? "").trim();
  if (v === "auto") return "auto";
  if (v === "manual") return "manual";
  return "unknown";
}

function isSavableCandidate(value: unknown): boolean {
  if (value === false) return false;
  if (value === "false") return false;
  if (value === 0) return false;
  if (value === "0") return false;
  return true;
}

function withMemoryWriteTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  reason: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(reason));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function collectMemoryCandidates(args: {
  candidates: ConfirmedMemoryCandidate[] | null | undefined;
  sourceMessageId: string;
  sourceThreadId?: string | null;
}): CandidateWithImportance[] {
  const arr = Array.isArray(args.candidates) ? args.candidates : [];
  const items: CandidateWithImportance[] = [];

  for (const candidate of arr) {
    if (!candidate || typeof candidate !== "object") continue;
    if (!isSavableCandidate(candidate.savable)) continue;

    const sourceType = normalizeCandidateSourceType(candidate.source_type);
    if (sourceType === "manual") continue;

    const body = String(candidate.body ?? "").trim();
    if (!body) continue;

    items.push({
      body,
      importance: 5,
      memory_type: normalizeMemoryType(candidate.memory_type),
      source_type: "auto",
      source_message_id:
        typeof candidate.source_message_id === "string" &&
        candidate.source_message_id.trim()
          ? candidate.source_message_id.trim()
          : args.sourceMessageId,
      source_thread_id:
        typeof candidate.source_thread_id === "string" &&
        candidate.source_thread_id.trim()
          ? candidate.source_thread_id.trim()
          : typeof candidate.thread_id === "string" && candidate.thread_id.trim()
            ? candidate.thread_id.trim()
            : (args.sourceThreadId ?? null),
      save_hint:
        candidate.save_hint === "save" || candidate.save_hint === "skip"
          ? candidate.save_hint
          : "save",
      confidence:
        typeof candidate.confidence === "number" &&
        Number.isFinite(candidate.confidence)
          ? candidate.confidence
          : null,
    });
  }

  return items;
}

function resolveMemWriteReason(args: {
  insertCount: number;
  touchedCount: number;
  filteredCount: number;
  totalCount: number;
}): string {
  if (args.insertCount > 0) return "inserted";
  if (args.touchedCount > 0) return "duplicate";
  if (args.totalCount === 0) return "no_confirmed_memory_candidates";
  if (args.filteredCount >= args.totalCount) return "confirmed_payload_blocked";
  return "unknown_zero_insert";
}

export async function handleMemoryWrite(args: {
  openai: OpenAI;
  modelName: string;
  memoryExtractTimeoutMs: number;
  memoryMinIntervalSec: number;
  debugSave: boolean;

  supabase: SupabaseClient;
  userId: string;
  sourceMessageId: string;
  sourceThreadId?: string | null;
  uiLang: Lang;
  userText: string;
  assistantText: string;
  routedTone: string;
  routedIntensity: number | string;
  usedHeuristicConfirmedMemoryCandidates?: boolean | null;

  stateLevel?: number | null;
  currentPhase?: number | null;
  stateChanged?: boolean | null;
  prevPhase?: number | null;
  prevStateLevel?: number | null;

  confirmedMemoryCandidates?: ConfirmedMemoryCandidate[] | null;
}): Promise<MemoryWriteResult> {
  let mem_write_attempted = false;
  let mem_write_allowed = false;
  let mem_write_inserted = 0;
  let mem_write_reason: string | null = null;

  let mem_items_count = 0;
  let mem_parse_ok: boolean | null = null;
  let mem_extract_preview: string | null = null;
  const mem_used_heuristic: boolean | null =
    args.usedHeuristicConfirmedMemoryCandidates === true;

  const effectiveMemoryMinIntervalSec = normalizeMemoryMinIntervalSec(
    args.memoryMinIntervalSec,
  );

  try {
    const gate = await withMemoryWriteTimeout(
      shouldWriteMemory({
        supabase: args.supabase,
        userId: args.userId,
        minIntervalSec: effectiveMemoryMinIntervalSec,
      }),
      MEMORY_WRITE_DB_TIMEOUT_MS,
      "should_write_memory_timeout",
    );

    mem_write_attempted = true;

    if (!(gate.ok && gate.allow)) {
      mem_write_allowed = false;
      mem_write_reason = gate.reason ?? "rate_limited";
      return {
        mem_write_attempted,
        mem_write_allowed,
        mem_write_inserted,
        mem_write_reason,
        mem_items_count,
        mem_parse_ok,
        mem_extract_preview,
        mem_used_heuristic,
      };
    }

    mem_write_allowed = true;

    const confirmedCandidates = Array.isArray(args.confirmedMemoryCandidates)
      ? args.confirmedMemoryCandidates
      : null;

    if (!confirmedCandidates) {
      mem_parse_ok = true;
      mem_write_reason = "no_confirmed_memory_candidates";
      return {
        mem_write_attempted,
        mem_write_allowed,
        mem_write_inserted,
        mem_write_reason,
        mem_items_count,
        mem_parse_ok,
        mem_extract_preview,
        mem_used_heuristic,
      };
    }

    const collectedCandidates = collectMemoryCandidates({
      candidates: confirmedCandidates,
      sourceMessageId: args.sourceMessageId,
      sourceThreadId: args.sourceThreadId ?? null,
    });

    mem_items_count = collectedCandidates.length;
    mem_parse_ok = true;

    if (args.debugSave) {
      mem_extract_preview = JSON.stringify({
        source:
          mem_used_heuristic === true
            ? "heuristic_confirmed_memory_candidates"
            : "confirmed_memory_candidates",
        total: confirmedCandidates.length,
        collected: collectedCandidates.length,
        items: collectedCandidates.map((item) => ({
          body: item.body,
          memory_type: item.memory_type,
          source_type: item.source_type,
          save_hint: item.save_hint,
          confidence: item.confidence,
        })),
      }).slice(0, 260);
    }

    if (!collectedCandidates.length) {
      mem_write_reason = "confirmed_payload_blocked";
      return {
        mem_write_attempted,
        mem_write_allowed,
        mem_write_inserted,
        mem_write_reason,
        mem_items_count,
        mem_parse_ok,
        mem_extract_preview,
        mem_used_heuristic,
      };
    }

    const saveAllowedCandidates: CandidateWithImportance[] = [];
    let filteredCount = 0;

    for (const candidate of collectedCandidates) {
      const saveDecision = shouldSaveMemoryCandidate({
        candidate,
      });

      if (!saveDecision.shouldSave) {
        filteredCount += 1;
        continue;
      }

      saveAllowedCandidates.push(candidate);
    }

    if (!saveAllowedCandidates.length) {
      mem_write_reason = resolveMemWriteReason({
        insertCount: 0,
        touchedCount: 0,
        filteredCount,
        totalCount: collectedCandidates.length,
      });

      return {
        mem_write_attempted,
        mem_write_allowed,
        mem_write_inserted,
        mem_write_reason,
        mem_items_count,
        mem_parse_ok,
        mem_extract_preview,
        mem_used_heuristic,
      };
    }

    const existingResult = await withMemoryWriteTimeout(
      selectMemories({
        supabase: args.supabase,
        condition: {
          user_id: args.userId,
          status: "active",
          source_type: "auto",
        },
      }),
      MEMORY_WRITE_DB_TIMEOUT_MS,
      "select_memories_timeout",
    );

    if (!existingResult.ok) {
      mem_write_reason = debugInsertError(
        "select_error",
        existingResult.error,
        args.debugSave,
      );

      return {
        mem_write_attempted,
        mem_write_allowed,
        mem_write_inserted,
        mem_write_reason,
        mem_items_count,
        mem_parse_ok,
        mem_extract_preview,
        mem_used_heuristic,
      };
    }

    const toInsert: CandidateWithImportance[] = [];
    const duplicateIds: string[] = [];

    for (const candidate of saveAllowedCandidates) {
      const duplicateDecision = findDuplicateMemory({
        candidate,
        existingMemories: existingResult.memories,
      });

      if (duplicateDecision.isDuplicate) {
        duplicateIds.push(duplicateDecision.matched.id);
        continue;
      }

      toInsert.push(candidate);
    }

    const normalizedDuplicateIds = Array.from(new Set(duplicateIds));
    let touchedCount = 0;

    if (normalizedDuplicateIds.length) {
      const touched = await withMemoryWriteTimeout(
        touchMemoryRows({
          supabase: args.supabase,
          ids: normalizedDuplicateIds,
        }),
        MEMORY_WRITE_DB_TIMEOUT_MS,
        "touch_memory_rows_timeout",
      );

      if (!touched.ok) {
        mem_write_reason = debugInsertError(
          "touch_error",
          touched.error,
          args.debugSave,
        );

        return {
          mem_write_attempted,
          mem_write_allowed,
          mem_write_inserted,
          mem_write_reason,
          mem_items_count,
          mem_parse_ok,
          mem_extract_preview,
          mem_used_heuristic,
        };
      }

      touchedCount = touched.touched;
    }

    if (toInsert.length) {
      const inserted = await withMemoryWriteTimeout(
        insertMemoryRows({
          supabase: args.supabase,
          userId: args.userId,
          sourceType: "auto",
          status: "active",
          sourceMessageId: args.sourceMessageId,
          sourceThreadId: args.sourceThreadId ?? null,
          candidates: toInsert,
          state_level: args.stateLevel ?? null,
          current_phase: args.currentPhase ?? null,
          state_changed: args.stateChanged ?? null,
        }),
        MEMORY_WRITE_DB_TIMEOUT_MS,
        "insert_memory_rows_timeout",
      );

      if (!inserted.ok) {
        mem_write_reason = debugInsertError(
          "insert_error",
          inserted.error,
          args.debugSave,
        );

        return {
          mem_write_attempted,
          mem_write_allowed,
          mem_write_inserted,
          mem_write_reason,
          mem_items_count,
          mem_parse_ok,
          mem_extract_preview,
          mem_used_heuristic,
        };
      }

      mem_write_inserted = inserted.inserted;
    }

    mem_write_reason = resolveMemWriteReason({
      insertCount: mem_write_inserted,
      touchedCount,
      filteredCount,
      totalCount: collectedCandidates.length,
    });
  } catch (e: any) {
    mem_write_reason = String(e?.message ?? e);
  }

  return {
    mem_write_attempted,
    mem_write_allowed,
    mem_write_inserted,
    mem_write_reason,
    mem_items_count,
    mem_parse_ok,
    mem_extract_preview,
    mem_used_heuristic,
  };
}
/*
【このファイルの正式役割】
confirmedMemoryCandidates を受け取り、
memory 保存可否判定、重複判定、既存 memory 参照、
touch / insert までを行う memory 保存本体ファイル。
*/

/*
【今回このファイルで修正したこと】
1. shouldWriteMemory / selectMemories / touchMemoryRows / insertMemoryRows に、このファイル内だけの timeout を追加しました。
2. これにより、confirmedMemoryCandidates が出た回だけ DB memory 保存待ちで長引いても、送信・回答全体が止まり続けないようにしました。
3. 状態の唯一の正、Compass、reply 本文、他機能には触っていません。
*/
// このファイルの正式役割: memory 保存本体ファイル