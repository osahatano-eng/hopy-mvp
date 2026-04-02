// /app/api/memories/_lib/createManualMemory.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import { insertMemoryRows } from "../../chat/_lib/db/memories";
import type { ManualMemoryInput } from "../../chat/_lib/memories/types";

export type CreateManualMemoryResult =
  | {
      ok: true;
      inserted: number;
    }
  | {
      ok: false;
      inserted: 0;
      reason:
        | "invalid_user_id"
        | "empty_body"
        | "insert_failed";
      error?: unknown;
    };

type CreateManualMemoryParams = {
  supabase: SupabaseClient;
  userId: string;
  input: ManualMemoryInput;
};

function normalizeUserId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBody(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export async function createManualMemory(
  params: CreateManualMemoryParams,
): Promise<CreateManualMemoryResult> {
  const userId = normalizeUserId(params.userId);
  if (!userId) {
    return {
      ok: false,
      inserted: 0,
      reason: "invalid_user_id",
    };
  }

  const body = normalizeBody(params.input.body);
  if (!body) {
    return {
      ok: false,
      inserted: 0,
      reason: "empty_body",
    };
  }

  const sourceMessageId = normalizeOptionalString(
    params.input.source_message_id,
  );
  const sourceThreadId = normalizeOptionalString(
    params.input.source_thread_id,
  );

  const result = await insertMemoryRows({
    supabase: params.supabase,
    userId,
    sourceType: "manual",
    status: "active",
    sourceMessageId,
    sourceThreadId,
    candidates: [
      {
        body,
        memory_type: "manual_note",
        source_type: "manual",
        source_message_id: sourceMessageId,
        source_thread_id: sourceThreadId,
        save_hint: "save",
        confidence: null,
      },
    ],
  });

  if (!result.ok) {
    return {
      ok: false,
      inserted: 0,
      reason: "insert_failed",
      error: result.error,
    };
  }

  return {
    ok: true,
    inserted: result.inserted,
  };
}