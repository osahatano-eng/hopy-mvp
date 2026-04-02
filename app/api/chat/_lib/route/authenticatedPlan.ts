// /app/api/chat/_lib/route/authenticatedPlan.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadMemoriesForPrompt } from "../memories/loadMemoriesForPrompt";
import type { Lang } from "../router/simpleRouter";

type ResolvedPlan = "free" | "plus" | "pro";

export type PromptMemoryLoadResult = {
  memoryBlock: string;
  memoryInjected: boolean;
};

const PLUS_MEMORY_PROMPT_LIMIT = 6;
const PRO_MEMORY_PROMPT_LIMIT = 12;

const RESOLVED_PLAN_SET: Record<ResolvedPlan, true> = {
  free: true,
  plus: true,
  pro: true,
};

const PROMPT_MEMORY_LIMIT_BY_PLAN: Record<ResolvedPlan, number | null> = {
  free: null,
  plus: PLUS_MEMORY_PROMPT_LIMIT,
  pro: PRO_MEMORY_PROMPT_LIMIT,
};

const LEARNING_ENABLED_BY_PLAN: Record<ResolvedPlan, boolean> = {
  free: false,
  plus: false,
  pro: true,
};

export function normalizeResolvedPlan(value: unknown): ResolvedPlan | null {
  const normalized = String(value ?? "").trim().toLowerCase();

  return normalized in RESOLVED_PLAN_SET
    ? (normalized as ResolvedPlan)
    : null;
}

export function getPromptMemoryLimitByPlan(
  resolvedPlan: ResolvedPlan,
): number | null {
  return PROMPT_MEMORY_LIMIT_BY_PLAN[resolvedPlan];
}

export function shouldLoadLearningForPlan(
  resolvedPlan: ResolvedPlan,
): boolean {
  return LEARNING_ENABLED_BY_PLAN[resolvedPlan];
}

export async function resolvePromptBundlePlanFromProfiles(args: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<ResolvedPlan> {
  try {
    const { data } = await args.supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", args.userId)
      .maybeSingle();

    const resolved = normalizeResolvedPlan((data as any)?.plan);
    return resolved ?? "free";
  } catch {
    return "free";
  }
}

export async function resolvePromptMemoryLoad(params: {
  supabase: SupabaseClient;
  userId: string;
  uiLang: Lang;
  currentStateLevel: number;
  clientMemoryBlock: string;
  limit?: number | null;
}): Promise<PromptMemoryLoadResult> {
  try {
    const loaded = await loadMemoriesForPrompt({
      supabase: params.supabase,
      userId: params.userId,
      limit: params.limit ?? undefined,
      uiLang: params.uiLang,
      currentStateLevel: params.currentStateLevel,
      clientMemoryBlock: params.clientMemoryBlock,
    });

    const loadedText = String(loaded ?? "").trim();

    if (loadedText.length > 0) {
      return {
        memoryBlock: loadedText,
        memoryInjected: true,
      };
    }

    if (loaded && typeof loaded === "object") {
      const memoryBlock = String((loaded as any).memoryBlock ?? "").trim();
      const memoryInjected =
        typeof (loaded as any).memoryInjected === "boolean"
          ? (loaded as any).memoryInjected
          : memoryBlock.length > 0;

      return {
        memoryBlock,
        memoryInjected,
      };
    }
  } catch {}

  return {
    memoryBlock: "",
    memoryInjected: false,
  };
}

/*
このファイルの正式役割
authenticated の plan / prompt memory 解決ファイル。
profiles.plan を free / plus / pro に正規化し、
plan ごとの memory 読み込み上限と learning 有効可否を返す。
*/

/*
【今回このファイルで修正したこと】
- loadMemoriesForPrompt(...) の戻り値を loaded.trim() で直接読んでいた箇所をやめました。
- 先に String(loaded ?? "").trim() で loadedText を作り、その文字列を使って判定する形へ修正しました。
- loadMemoriesForPrompt.ts 本体や plan 判定ロジックには触っていません。
*/