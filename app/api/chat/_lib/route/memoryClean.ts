// /app/api/chat/_lib/route/memoryClean.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import { softDeletePollutedMemories } from "../db/memories";
import type { Lang } from "../router/simpleRouter";

export type MemoryCleanResult = {
  triggered: boolean;
  enabled: boolean;
  attempted: boolean;
  ok: boolean | null;
  deleted: number;
  limit: number;
  reason: string | null;
};

export async function handleMemoryClean(args: {
  supabase: SupabaseClient;
  userId: string;
  uiLang: Lang;
  cleanTrigger: boolean;
  allowMemoryClean: boolean;
  memoryCleanLimit: number;
}): Promise<MemoryCleanResult> {
  const result: MemoryCleanResult = {
    triggered: args.cleanTrigger,
    enabled: args.allowMemoryClean,
    attempted: false,
    ok: null,
    deleted: 0,
    limit: args.memoryCleanLimit,
    reason: null,
  };

  if (!args.cleanTrigger) {
    return result;
  }

  if (!args.allowMemoryClean) {
    result.attempted = false;
    result.ok = false;
    result.reason = "disabled_by_env";
    return result;
  }

  try {
    result.attempted = true;

    const res = await softDeletePollutedMemories({
      supabase: args.supabase,
      userId: args.userId,
      uiLang: args.uiLang,
      limit: args.memoryCleanLimit,
    });

    result.ok = res.ok;
    result.deleted = res.deleted;
    result.reason = res.ok ? "cleaned" : "clean_failed";
    return result;
  } catch (e: any) {
    result.attempted = true;
    result.ok = false;
    result.reason = String(e?.message ?? e);
    return result;
  }
}