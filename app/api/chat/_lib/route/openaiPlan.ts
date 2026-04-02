// /app/api/chat/_lib/route/openaiPlan.ts
import type { PromptBundle } from "./promptBundle";

const FREE_REPLY_MAX_TOKENS = 350;
const PLUS_REPLY_MAX_TOKENS = 520;
const PRO_REPLY_MAX_TOKENS = 760;

export type ResolvedPlanLike = "free" | "plus" | "pro";

function readPlanMarker(stylePrompt: string): ResolvedPlanLike | null {
  if (
    stylePrompt.includes("PLAN_MARKER:pro") ||
    stylePrompt.includes("プラン識別:pro")
  ) {
    return "pro";
  }

  if (
    stylePrompt.includes("PLAN_MARKER:plus") ||
    stylePrompt.includes("プラン識別:plus")
  ) {
    return "plus";
  }

  if (
    stylePrompt.includes("PLAN_MARKER:free") ||
    stylePrompt.includes("プラン識別:free")
  ) {
    return "free";
  }

  return null;
}

function readLegacyPlanHint(stylePrompt: string): ResolvedPlanLike | null {
  if (
    stylePrompt.includes("回答長さガイド（プラン別）：\n・Pro は") ||
    stylePrompt.includes("Reply length guidance (plan-aware):\n- Pro may answer")
  ) {
    return "pro";
  }

  if (
    stylePrompt.includes("回答長さガイド（プラン別）：\n・Plus は") ||
    stylePrompt.includes(
      "Reply length guidance (plan-aware):\n- Plus should feel fuller",
    )
  ) {
    return "plus";
  }

  if (
    stylePrompt.includes("回答長さガイド（プラン別）：\n・Free は") ||
    stylePrompt.includes(
      "Reply length guidance (plan-aware):\n- Free must stay lightweight",
    )
  ) {
    return "free";
  }

  return null;
}

export function detectResolvedPlanFromPromptBundle(
  promptBundle: PromptBundle,
): ResolvedPlanLike {
  const stylePrompt = String(promptBundle.styleSystemPrompt ?? "");

  const markerPlan = readPlanMarker(stylePrompt);
  if (markerPlan) return markerPlan;

  const legacyPlan = readLegacyPlanHint(stylePrompt);
  if (legacyPlan) return legacyPlan;

  return "free";
}

export function getReplyMaxTokensByPlan(
  resolvedPlan: ResolvedPlanLike,
): number {
  if (resolvedPlan === "pro") return PRO_REPLY_MAX_TOKENS;
  if (resolvedPlan === "plus") return PLUS_REPLY_MAX_TOKENS;
  return FREE_REPLY_MAX_TOKENS;
}