// /app/api/chat/_lib/memories/types.ts

export const MEMORY_SOURCE_TYPES = ["auto", "manual"] as const;
export type MemorySourceType = (typeof MEMORY_SOURCE_TYPES)[number];

export const MEMORY_TYPES = [
  "trait",
  "theme",
  "support_context",
  "dashboard_signal",
  "manual_note",
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_STATUSES = ["active", "trash"] as const;
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export type MemoryCandidate = {
  body: string;
  memory_type: MemoryType;
  source_type?: Extract<MemorySourceType, "auto">;
  save_hint?: "save" | "skip" | null;
  confidence?: number | null;
  source_message_id?: string | null;
  source_thread_id?: string | null;
};

export type CollectedMemoryCandidate = {
  body: string;
  memory_type: MemoryType;
  source_type: Extract<MemorySourceType, "auto">;
  source_message_id: string | null;
  source_thread_id: string | null;
  save_hint: "save" | "skip" | null;
  confidence: number | null;
};

export type ManualMemoryInput = {
  body: string;
  memory_type?: Extract<MemoryType, "manual_note">;
  source_thread_id?: string | null;
  source_message_id?: string | null;
};

export type SavedMemory = {
  id: string;
  user_id: string;
  body: string;
  source_type: MemorySourceType;
  memory_type: MemoryType;
  status: MemoryStatus;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  source_message_id?: string | null;
  source_thread_id?: string | null;
};

export type MemoryDuplicateKey = {
  body: string;
  memory_type: MemoryType;
  source_type: MemorySourceType;
  source_thread_id?: string | null;
};

export type MemoryQueryCondition = {
  user_id: string;
  status?: MemoryStatus;
  source_type?: MemorySourceType;
  memory_type?: MemoryType;
  source_thread_id?: string | null;
  search_text?: string | null;
  limit?: number;
};

export function isMemorySourceType(value: unknown): value is MemorySourceType {
  return (
    typeof value === "string" &&
    MEMORY_SOURCE_TYPES.includes(value as MemorySourceType)
  );
}

export function isMemoryType(value: unknown): value is MemoryType {
  return (
    typeof value === "string" &&
    MEMORY_TYPES.includes(value as MemoryType)
  );
}

export function isMemoryStatus(value: unknown): value is MemoryStatus {
  return (
    typeof value === "string" &&
    MEMORY_STATUSES.includes(value as MemoryStatus)
  );
}