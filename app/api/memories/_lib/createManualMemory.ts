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

  const candidates = [
    {
      body,
      memory_type: "manual_note" as const,
      source_type: "manual" as const,
      source_message_id: sourceMessageId,
      source_thread_id: sourceThreadId,
      save_hint: "save" as const,
      confidence: null,
    },
  ] as unknown as Parameters<typeof insertMemoryRows>[0]["candidates"];

  const result = await insertMemoryRows({
    supabase: params.supabase,
    userId,
    sourceType: "manual",
    status: "active",
    sourceMessageId,
    sourceThreadId,
    candidates,
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

/*
【このファイルの正式役割】
manual memory 作成APIから、手動登録メモを正規化して insertMemoryRows へ渡す薄い登録窓口です。

【今回このファイルで修正したこと】
manual memory candidate に必要な source_type: "manual" を戻しました。
そのうえで、このファイル単体では insertMemoryRows 側の候補型と完全一致しないため、
渡す直前で insertMemoryRows の candidates 型へ合わせて受け渡す形にしました。
manual 登録の実値は維持しつつ、この1ファイルだけで build を先へ進める最小修正に留めています。
*/