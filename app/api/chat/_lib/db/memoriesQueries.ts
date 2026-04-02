// /app/api/chat/_lib/db/memoriesQueries.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import type { MemorySourceType } from "../memories/types";
import { norm, type RawMemoryRow } from "./memoriesFilters";

function isRawMemoryRow(value: unknown): value is RawMemoryRow {
  if (!value || typeof value !== "object") return false;

  const row = value as Record<string, unknown>;

  return (
    (typeof row.id === "string" || row.id == null) &&
    (typeof row.body === "string" || row.body == null) &&
    (typeof row.content === "string" || row.content == null) &&
    (typeof row.source_type === "string" || row.source_type == null) &&
    (typeof row.memory_type === "string" || row.memory_type == null) &&
    (typeof row.importance === "number" || row.importance == null) &&
    (typeof row.created_at === "string" || row.created_at == null)
  );
}

export async function selectPromptMemoryRows(params: {
  supabase: SupabaseClient;
  userId: string;
  limit: number;
}): Promise<{ ok: boolean; rows: RawMemoryRow[]; error?: unknown }> {
  const { supabase, userId, limit } = params;

  const { data, error } = await supabase
    .from("memories")
    .select(
      [
        "body",
        "content",
        "source_type",
        "memory_type",
        "importance",
      ].join(", "),
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("importance", { ascending: false })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.trunc(limit)));

  if (error) {
    return { ok: false, rows: [], error };
  }

  const safeRows: unknown[] = Array.isArray(data) ? data : [];
  const rows: RawMemoryRow[] = [];

  for (const row of safeRows) {
    if (!isRawMemoryRow(row)) continue;
    rows.push(row);
  }

  return {
    ok: true,
    rows,
  };
}

export async function selectActiveMemoryIdsByBodies(params: {
  supabase: SupabaseClient;
  userId: string;
  sourceType: MemorySourceType;
  bodies: string[];
}): Promise<{
  ok: boolean;
  rows: Array<{ id: string; body: string }>;
  error?: unknown;
}> {
  const { supabase, userId, sourceType, bodies } = params;

  const normalizedBodies = Array.from(
    new Set(bodies.map((body) => norm(body)).filter(Boolean)),
  );

  if (normalizedBodies.length <= 0) {
    return { ok: true, rows: [] };
  }

  const { data, error } = await supabase
    .from("memories")
    .select("id, body")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("source_type", sourceType)
    .in("body", normalizedBodies);

  if (error) {
    return { ok: false, rows: [], error };
  }

  const safeRows: unknown[] = Array.isArray(data) ? data : [];
  const rows: Array<{ id: string; body: string }> = [];

  for (const row of safeRows) {
    if (!isRawMemoryRow(row)) continue;
    const id = norm(row.id);
    const body = norm(row.body);
    if (!id || !body) continue;
    rows.push({ id, body });
  }

  return { ok: true, rows };
}

export async function selectLatestActiveMemoryCreatedAt(params: {
  supabase: SupabaseClient;
  userId: string;
  sourceType: MemorySourceType;
}): Promise<{ ok: boolean; created_at: string | null; error?: unknown }> {
  const { supabase, userId, sourceType } = params;

  const { data, error } = await supabase
    .from("memories")
    .select("created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("source_type", sourceType)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return { ok: false, created_at: null, error };
  }

  const firstRow = Array.isArray(data) ? data[0] : null;
  const createdAt = isRawMemoryRow(firstRow) ? norm(firstRow.created_at) : "";
  return {
    ok: true,
    created_at: createdAt || null,
  };
}

/*
このファイルの正式役割:
memories テーブルから prompt用メモリ行・重複確認用id/body・最新作成日時を取得して返すDB読み出し層。
*/

/*
【今回このファイルで修正したこと】
Supabase の戻り値を RawMemoryRow[] へ直接キャストするのをやめ、unknown[] として受けて isRawMemoryRow で型確認できた行だけ使うように修正した。
selectPromptMemoryRows・selectActiveMemoryIdsByBodies・selectLatestActiveMemoryCreatedAt の3箇所を直接キャストなしへ統一した。
*/