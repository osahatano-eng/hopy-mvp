// /app/api/chat/_lib/db/memoriesReadForPrompt.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type PromptMemorySourceType = "auto" | "manual";
export type PromptMemoryType =
  | "trait"
  | "theme"
  | "support_context"
  | "dashboard_signal"
  | "manual_note";

export type PromptMemoryItem = {
  id: string;
  body: string;
  source_type: PromptMemorySourceType;
  memory_type: PromptMemoryType;
  created_at: string | null;
  updated_at: string | null;
};

export type MemoriesReadForPromptArgs = {
  supabase: SupabaseClient;
  userId: string;
  limit?: number;
  tableName?: string;
};

type MemoryRow = {
  id?: unknown;
  body?: unknown;
  source_type?: unknown;
  memory_type?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_TABLE_NAME = "memories";

function normalizeUserId(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function normalizeLimit(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  const v = Math.trunc(n);
  if (v <= 0) return DEFAULT_LIMIT;
  return Math.min(v, MAX_LIMIT);
}

function normalizeString(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function normalizeNullableString(input: unknown): string | null {
  const v = normalizeString(input);
  return v || null;
}

function normalizeSourceType(input: unknown): PromptMemorySourceType | null {
  const v = normalizeString(input).toLowerCase();
  if (v === "auto") return "auto";
  if (v === "manual") return "manual";
  return null;
}

function normalizeMemoryType(input: unknown): PromptMemoryType | null {
  const v = normalizeString(input).toLowerCase();
  if (v === "trait") return "trait";
  if (v === "theme") return "theme";
  if (v === "support_context") return "support_context";
  if (v === "dashboard_signal") return "dashboard_signal";
  if (v === "manual_note") return "manual_note";
  return null;
}

function toPromptMemoryItem(row: MemoryRow): PromptMemoryItem | null {
  const id = normalizeString(row.id);
  const body = normalizeString(row.body);
  const sourceType = normalizeSourceType(row.source_type);
  const memoryType = normalizeMemoryType(row.memory_type);

  if (!id || !body || !sourceType || !memoryType) {
    return null;
  }

  return {
    id,
    body,
    source_type: sourceType,
    memory_type: memoryType,
    created_at: normalizeNullableString(row.created_at),
    updated_at: normalizeNullableString(row.updated_at),
  };
}

export async function memoriesReadForPrompt({
  supabase,
  userId,
  limit = DEFAULT_LIMIT,
  tableName = DEFAULT_TABLE_NAME,
}: MemoriesReadForPromptArgs): Promise<PromptMemoryItem[]> {
  const safeUserId = normalizeUserId(userId);
  const safeLimit = normalizeLimit(limit);

  if (!safeUserId) return [];

  const { data, error } = await supabase
    .from(tableName)
    .select("id, body, source_type, memory_type, created_at, updated_at")
    .eq("user_id", safeUserId)
    .eq("status", "active")
    .in("source_type", ["auto", "manual"])
    .in("memory_type", [
      "trait",
      "theme",
      "support_context",
      "dashboard_signal",
      "manual_note",
    ])
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`memoriesReadForPrompt failed: ${error.message}`);
  }

  const rows = Array.isArray(data) ? (data as MemoryRow[]) : [];

  return rows
    .map(toPromptMemoryItem)
    .filter((item): item is PromptMemoryItem => item !== null);
}