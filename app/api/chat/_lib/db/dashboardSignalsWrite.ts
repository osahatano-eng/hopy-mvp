// /app/api/chat/_lib/db/dashboardSignalsWrite.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardSignalInsertRow } from "../hopy/dashboard/buildDashboardSignalRows";

export type DashboardSignalsWriteArgs = {
  supabase: SupabaseClient;
  rows: DashboardSignalInsertRow[];
  tableName?: string;
};

export type DashboardSignalsWriteResult = {
  insertedCount: number;
};

type ExistingDashboardSignalRow = {
  user_id?: unknown;
  source_thread_id?: unknown;
  source_message_id?: unknown;
  signal_type?: unknown;
  signal_value?: unknown;
  body?: unknown;
  observed_at?: unknown;
};

const DEFAULT_TABLE_NAME = "dashboard_signals";

function normalizeString(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function normalizeRows(input: unknown): DashboardSignalInsertRow[] {
  return Array.isArray(input) ? (input as DashboardSignalInsertRow[]) : [];
}

function normalizeSignalValue(input: unknown): string {
  const n = Number(input);
  if (!Number.isFinite(n)) return "";
  const v = Math.trunc(n);
  if (v < 1) return "1";
  if (v > 5) return "5";
  return String(v);
}

function buildRowKey(row: {
  user_id?: unknown;
  source_thread_id?: unknown;
  source_message_id?: unknown;
  signal_type?: unknown;
  signal_value?: unknown;
  body?: unknown;
  observed_at?: unknown;
}): string {
  const userId = normalizeString(row.user_id).toLowerCase();
  const sourceThreadId = normalizeString(row.source_thread_id).toLowerCase();
  const sourceMessageId = normalizeString(row.source_message_id).toLowerCase();
  const signalType = normalizeString(row.signal_type).toLowerCase();
  const signalValue = normalizeSignalValue(row.signal_value);
  const body = normalizeString(row.body).toLowerCase();
  const observedAt = normalizeString(row.observed_at).toLowerCase();

  return [
    userId,
    sourceThreadId,
    sourceMessageId,
    signalType,
    signalValue,
    body,
    observedAt,
  ].join("::");
}

function dedupeInsertRows(rows: DashboardSignalInsertRow[]): DashboardSignalInsertRow[] {
  const seen = new Set<string>();
  const result: DashboardSignalInsertRow[] = [];

  for (const row of rows) {
    const key = buildRowKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}

function collectDistinctUserIds(rows: DashboardSignalInsertRow[]): string[] {
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
}): Promise<ExistingDashboardSignalRow[]> {
  if (args.userIds.length === 0) return [];

  const { data, error } = await args.supabase
    .from(args.tableName)
    .select(
      "user_id, source_thread_id, source_message_id, signal_type, signal_value, body, observed_at",
    )
    .in("user_id", args.userIds);

  if (error) {
    throw new Error(`dashboardSignalsWrite read failed: ${error.message}`);
  }

  return Array.isArray(data) ? (data as ExistingDashboardSignalRow[]) : [];
}

function removeExistingDuplicates(
  rows: DashboardSignalInsertRow[],
  existingRows: ExistingDashboardSignalRow[],
): DashboardSignalInsertRow[] {
  const existingKeys = new Set(existingRows.map((row) => buildRowKey(row)));

  return rows.filter((row) => {
    const key = buildRowKey(row);
    return !!key && !existingKeys.has(key);
  });
}

export async function dashboardSignalsWrite({
  supabase,
  rows,
  tableName = DEFAULT_TABLE_NAME,
}: DashboardSignalsWriteArgs): Promise<DashboardSignalsWriteResult> {
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
    throw new Error(`dashboardSignalsWrite insert failed: ${error.message}`);
  }

  return { insertedCount: insertRows.length };
}