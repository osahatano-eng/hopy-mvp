// /app/api/chat/_lib/db/memoriesQueries.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import type { MemorySourceType } from "../memories/types";
import { norm, type RawMemoryRow } from "./memoriesFilters";

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

  return {
    ok: true,
    rows: ((data ?? []) as RawMemoryRow[]).filter(Boolean),
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

  const rows = ((data ?? []) as RawMemoryRow[])
    .map((row) => {
      const id = norm(row.id);
      const body = norm(row.body);
      if (!id || !body) return null;
      return { id, body };
    })
    .filter(Boolean) as Array<{ id: string; body: string }>;

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

  const createdAt = norm((data?.[0] as RawMemoryRow | undefined)?.created_at);
  return {
    ok: true,
    created_at: createdAt || null,
  };
}