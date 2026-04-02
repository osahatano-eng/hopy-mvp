// /app/api/chat/_lib/memories/loadMemoriesForPrompt.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import { selectMemories } from "../db/memories";
import type {
  MemorySourceType,
  MemoryType,
  SavedMemory,
} from "./types";

export type PromptMemoryItem = {
  id: string;
  body: string;
  source_type: MemorySourceType;
  memory_type: MemoryType;
  created_at: string;
  updated_at: string;
  source_message_id?: string | null;
  source_thread_id?: string | null;
};

export type LoadMemoriesForPromptResult =
  | {
      ok: true;
      memories: PromptMemoryItem[];
      memoryBlock: string;
      memoryInjected: boolean;
    }
  | {
      ok: false;
      memories: [];
      memoryBlock: string;
      memoryInjected: boolean;
      reason: "invalid_user_id" | "select_failed";
      error?: unknown;
    };

type LoadMemoriesForPromptParams = {
  supabase: SupabaseClient;
  userId: string;
  limit?: number;
  sourceType?: MemorySourceType;
  memoryType?: MemoryType;
  uiLang?: string;
  currentStateLevel?: number;
  clientMemoryBlock?: string;
};

function normalizeUserId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 30;

  const i = Math.trunc(n);
  if (i < 1) return 1;
  if (i > 100) return 100;
  return i;
}

function toPromptMemoryItem(memory: SavedMemory): PromptMemoryItem {
  return {
    id: memory.id,
    body: memory.body,
    source_type: memory.source_type,
    memory_type: memory.memory_type,
    created_at: memory.created_at,
    updated_at: memory.updated_at,
    source_message_id: memory.source_message_id ?? null,
    source_thread_id: memory.source_thread_id ?? null,
  };
}

function escapePromptLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildMemoryLine(
  memory: Pick<PromptMemoryItem, "body" | "memory_type">,
  index: number,
): string {
  const body = escapePromptLine(String(memory.body ?? ""));
  if (!body) return "";
  return `${index + 1}. [${memory.memory_type}] ${body}`;
}

function buildMemoryBlockFromLines(lines: string[]): string {
  const filtered = lines.filter(Boolean);
  if (filtered.length <= 0) return "";
  return ["[MEMORIES]", ...filtered].join("\n");
}

export async function loadMemoriesForPrompt(
  params: LoadMemoriesForPromptParams,
): Promise<LoadMemoriesForPromptResult> {
  const {
    supabase,
    userId: rawUserId,
    limit,
    sourceType,
    memoryType,
    clientMemoryBlock: rawClientMemoryBlock,
  } = params;

  const userId = normalizeUserId(rawUserId);
  const normalizedLimit = normalizeLimit(limit);
  const clientMemoryBlock = String(rawClientMemoryBlock ?? "").trim();
  const hasClientMemoryBlock = clientMemoryBlock.length > 0;

  if (!userId) {
    return {
      ok: false,
      memories: [],
      memoryBlock: clientMemoryBlock,
      memoryInjected: hasClientMemoryBlock,
      reason: "invalid_user_id",
    };
  }

  const result = await selectMemories({
    supabase,
    condition: {
      user_id: userId,
      status: "active",
      source_type: sourceType,
      memory_type: memoryType,
      limit: normalizedLimit,
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      memories: [],
      memoryBlock: clientMemoryBlock,
      memoryInjected: hasClientMemoryBlock,
      reason: "select_failed",
      error: result.error,
    };
  }

  const memories: PromptMemoryItem[] = [];
  const lines: string[] = [];

  for (let index = 0; index < result.memories.length; index += 1) {
    const promptMemory = toPromptMemoryItem(result.memories[index]);
    memories.push(promptMemory);

    const line = buildMemoryLine(promptMemory, index);
    if (line) {
      lines.push(line);
    }
  }

  const loadedMemoryBlock = buildMemoryBlockFromLines(lines);
  const memoryBlock = loadedMemoryBlock || clientMemoryBlock;
  const memoryInjected = memoryBlock.length > 0;

  return {
    ok: true,
    memories,
    memoryBlock,
    memoryInjected,
  };
}