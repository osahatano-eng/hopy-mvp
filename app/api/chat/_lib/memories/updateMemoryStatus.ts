// /app/api/chat/_lib/memories/updateMemoryStatus.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import { updateMemoryRowsStatus } from "../db/memories";
import type { MemoryStatus } from "./types";

export type UpdateMemoryStatusResult =
  | {
      ok: true;
      updated: number;
    }
  | {
      ok: false;
      updated: 0;
      reason: "empty_ids" | "invalid_status" | "update_failed";
      error?: unknown;
    };

type UpdateMemoryStatusParams = {
  supabase: SupabaseClient;
  ids: string[];
  status: MemoryStatus;
};

function normalizeIds(ids: string[]): string[] {
  return Array.from(
    new Set(
      ids
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function isValidStatus(value: unknown): value is MemoryStatus {
  return value === "active" || value === "trash";
}

export async function updateMemoryStatus(
  params: UpdateMemoryStatusParams,
): Promise<UpdateMemoryStatusResult> {
  const ids = normalizeIds(params.ids);
  if (!ids.length) {
    return {
      ok: false,
      updated: 0,
      reason: "empty_ids",
    };
  }

  if (!isValidStatus(params.status)) {
    return {
      ok: false,
      updated: 0,
      reason: "invalid_status",
    };
  }

  const result = await updateMemoryRowsStatus({
    supabase: params.supabase,
    ids,
    status: params.status,
  });

  if (!result.ok) {
    return {
      ok: false,
      updated: 0,
      reason: "update_failed",
      error: result.error,
    };
  }

  return {
    ok: true,
    updated: result.updated,
  };
}