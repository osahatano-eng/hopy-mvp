// /app/api/chat/_lib/memories/findDuplicateMemory.ts

import type { CollectedMemoryCandidate, SavedMemory } from "./types";

type FindDuplicateMemoryParams = {
  candidate: CollectedMemoryCandidate | null | undefined;
  existingMemories: SavedMemory[];
};

export type FindDuplicateMemoryResult =
  | {
      isDuplicate: false;
      matched: null;
      action: "insert";
    }
  | {
      isDuplicate: true;
      matched: SavedMemory;
      action: "touch";
    };

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isSameThread(
  candidateThreadId: string | null,
  memoryThreadId: string | null | undefined,
): boolean {
  if (!candidateThreadId && !memoryThreadId) return true;
  if (!candidateThreadId || !memoryThreadId) return false;
  return candidateThreadId === memoryThreadId;
}

export function findDuplicateMemory(
  params: FindDuplicateMemoryParams,
): FindDuplicateMemoryResult {
  const { candidate, existingMemories } = params;

  if (!candidate) {
    return {
      isDuplicate: false,
      matched: null,
      action: "insert",
    };
  }

  const candidateBody = normalizeText(candidate.body);
  if (!candidateBody) {
    return {
      isDuplicate: false,
      matched: null,
      action: "insert",
    };
  }

  for (const memory of existingMemories) {
    if (memory.status !== "active") continue;
    if (memory.source_type !== candidate.source_type) continue;
    if (memory.memory_type !== candidate.memory_type) continue;
    if (!isSameThread(candidate.source_thread_id, memory.source_thread_id)) {
      continue;
    }

    const memoryBody = normalizeText(memory.body);
    if (memoryBody !== candidateBody) continue;

    return {
      isDuplicate: true,
      matched: memory,
      action: "touch",
    };
  }

  return {
    isDuplicate: false,
    matched: null,
    action: "insert",
  };
}