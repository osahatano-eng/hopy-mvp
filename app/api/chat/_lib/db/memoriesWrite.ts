// /app/api/chat/_lib/db/memoriesWrite.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemoryInsertRow } from "../hopy/memory/buildMemoryRows";

export type MemoriesWriteArgs = {
  supabase: SupabaseClient;
  rows: MemoryInsertRow[];
  tableName?: string;
};

export type MemoriesWriteResult = {
  insertedCount: number;
};

type ExistingMemoryRow = {
  user_id?: unknown;
  body?: unknown;
  memory_type?: unknown;
};

const DEFAULT_TABLE_NAME = "memories";

function normalizeString(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function normalizeRows(input: unknown): MemoryInsertRow[] {
  return Array.isArray(input) ? (input as MemoryInsertRow[]) : [];
}

function normalizeForCompare(input: unknown): string {
  return normalizeString(input)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[。、，．.!！?？"'`´‘’“”（）()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRowKey(row: {
  user_id?: unknown;
  memory_type?: unknown;
  body?: unknown;
}): string {
  const userId = normalizeString(row.user_id).toLowerCase();
  const memoryType = normalizeString(row.memory_type).toLowerCase();
  const body = normalizeString(row.body).toLowerCase();
  return `${userId}::${memoryType}::${body}`;
}

function areBodiesSemanticallyNear(
  a: unknown,
  b: unknown,
  memoryType?: string,
): boolean {
  const normalizedA = normalizeForCompare(a);
  const normalizedB = normalizeForCompare(b);

  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;

  const safeType = normalizeString(memoryType).toLowerCase();
  const allowSemanticCheck = ["trait", "theme", "support_context"].includes(safeType);
  if (!allowSemanticCheck) return false;

  // Free β の安定性優先:
  // 「意味・対象・意図」の厳密判定をこの層で無理に近似推定しない。
  // この保存層では完全一致のみを重複として扱い、
  // 別対象 memory の誤抑止を避ける。
  return false;
}

function dedupeInsertRows(rows: MemoryInsertRow[]): MemoryInsertRow[] {
  const seen = new Set<string>();
  const result: MemoryInsertRow[] = [];

  for (const row of rows) {
    const key = buildRowKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}

function collectDistinctUserIds(rows: MemoryInsertRow[]): string[] {
  return Array.from(
    new Set(
      rows
        .map((row) => normalizeString(row.user_id))
        .filter((v) => !!v),
    ),
  );
}

async function readExistingRows(args: {
  supabase: SupabaseClient;
  tableName: string;
  userIds: string[];
}): Promise<ExistingMemoryRow[]> {
  if (args.userIds.length === 0) return [];

  const { data, error } = await args.supabase
    .from(args.tableName)
    .select("user_id, body, memory_type")
    .in("user_id", args.userIds)
    .eq("status", "active");

  if (error) {
    throw new Error(`memoriesWrite read failed: ${error.message}`);
  }

  return Array.isArray(data) ? (data as ExistingMemoryRow[]) : [];
}

function isSemanticDuplicateRow(
  row: MemoryInsertRow,
  existingRows: ExistingMemoryRow[],
): boolean {
  const rowUserId = normalizeString(row.user_id).toLowerCase();
  const rowMemoryType = normalizeString(row.memory_type).toLowerCase();
  const rowBody = normalizeString(row.body);

  if (!rowUserId || !rowMemoryType || !rowBody) return false;

  for (const existing of existingRows) {
    const existingUserId = normalizeString(existing.user_id).toLowerCase();
    const existingMemoryType = normalizeString(existing.memory_type).toLowerCase();
    const existingBody = normalizeString(existing.body);

    if (!existingUserId || !existingMemoryType || !existingBody) continue;
    if (existingUserId !== rowUserId) continue;
    if (existingMemoryType !== rowMemoryType) continue;

    if (areBodiesSemanticallyNear(rowBody, existingBody, rowMemoryType)) {
      return true;
    }
  }

  return false;
}

function removeExistingDuplicates(
  rows: MemoryInsertRow[],
  existingRows: ExistingMemoryRow[],
): MemoryInsertRow[] {
  const existingKeys = new Set(existingRows.map((row) => buildRowKey(row)));
  const acceptedRows: MemoryInsertRow[] = [];

  for (const row of rows) {
    const key = buildRowKey(row);
    if (!key) continue;
    if (existingKeys.has(key)) continue;
    if (isSemanticDuplicateRow(row, existingRows)) continue;
    if (isSemanticDuplicateRow(row, acceptedRows)) continue;

    acceptedRows.push(row);
  }

  return acceptedRows;
}

export async function memoriesWrite({
  supabase,
  rows,
  tableName = DEFAULT_TABLE_NAME,
}: MemoriesWriteArgs): Promise<MemoriesWriteResult> {
  const safeRows = dedupeInsertRows(normalizeRows(rows));

  if (safeRows.length === 0) {
    return { insertedCount: 0 };
  }

  const userIds = collectDistinctUserIds(safeRows);
  const existingRows = await readExistingRows({
    supabase,
    tableName,
    userIds,
  });

  const insertRows = removeExistingDuplicates(safeRows, existingRows);

  if (insertRows.length === 0) {
    return { insertedCount: 0 };
  }

  const { error } = await supabase.from(tableName).insert(insertRows);

  if (error) {
    throw new Error(`memoriesWrite insert failed: ${error.message}`);
  }

  return { insertedCount: insertRows.length };
}