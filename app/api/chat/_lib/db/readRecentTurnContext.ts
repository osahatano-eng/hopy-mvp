// /app/api/chat/_lib/db/readRecentTurnContext.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type RecentTurnContextItem = {
  role: "user" | "assistant";
  content: string;
  created_at: string | null;
};

export type ReadRecentTurnContextArgs = {
  supabase: SupabaseClient;
  threadId: string;
  limit?: number;
  tableName?: string;
};

type MessageRow = {
  role?: unknown;
  content?: unknown;
  body?: unknown;
  text?: unknown;
  created_at?: unknown;
};

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;
const DEFAULT_TABLE_NAME = "messages";

function normalizeThreadId(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function normalizeLimit(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  const v = Math.trunc(n);
  if (v <= 0) return DEFAULT_LIMIT;
  return Math.min(v, MAX_LIMIT);
}

function normalizeRole(input: unknown): "user" | "assistant" | null {
  const v = String(input ?? "").trim().toLowerCase();
  if (v === "user") return "user";
  if (v === "assistant") return "assistant";
  return null;
}

function normalizeContent(row: MessageRow): string {
  const candidates = [row.content, row.body, row.text];
  for (const value of candidates) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}

function normalizeCreatedAt(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed || null;
}

function isContextRow(row: MessageRow): row is Required<Pick<MessageRow, "created_at">> & MessageRow {
  const role = normalizeRole(row.role);
  const content = normalizeContent(row);
  return !!role && !!content;
}

export async function readRecentTurnContext({
  supabase,
  threadId,
  limit = DEFAULT_LIMIT,
  tableName = DEFAULT_TABLE_NAME,
}: ReadRecentTurnContextArgs): Promise<RecentTurnContextItem[]> {
  const safeThreadId = normalizeThreadId(threadId);
  const safeLimit = normalizeLimit(limit);

  if (!safeThreadId) return [];

  const { data, error } = await supabase
    .from(tableName)
    .select("role, content, body, text, created_at")
    .eq("thread_id", safeThreadId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`readRecentTurnContext failed: ${error.message}`);
  }

  const rows = Array.isArray(data) ? (data as MessageRow[]) : [];

  return rows
    .filter(isContextRow)
    .reverse()
    .map((row) => ({
      role: normalizeRole(row.role)!,
      content: normalizeContent(row),
      created_at: normalizeCreatedAt(row.created_at),
    }));
}