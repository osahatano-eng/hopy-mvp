// /app/api/chat/_lib/db/interventionLog.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tone5, Strategy4 } from "../router/simpleRouter";

/**
 * NOTE:
 * - DBの intervention_log.thread_id は uuid 型
 * - アプリ側は uuid 文字列として扱う（Supabase は uuid string を受け付ける）
 * - avoid_phrases は DBで jsonb（default '[]'::jsonb）。配列をそのまま渡してOK（jsonbに入る）
 *
 * ✅ audit:
 * - system_core_digest / build_sig を受け取り、DBに保存できるようにする
 */

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeLimit(limit: any, fallback = 8) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return fallback;
  return clampInt(n, 1, 20);
}

function reqNonEmpty(name: string, v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`${name}_empty`);
  return s;
}

function clampText(v: unknown, max = 8000) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeStringArray(v: unknown, itemMax = 220, maxItems = 30): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const it of v) {
    const s = String(it ?? "").trim();
    if (!s) continue;
    out.push(s.length > itemMax ? s.slice(0, itemMax) : s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function extractSystemCoreVersionFromBuildSig(buildSig: unknown): string {
  const source = clampText(buildSig, 700);
  if (!source) return "unknown";

  const match = source.match(/system_core:([^:|]+):/);
  const version = String(match?.[1] ?? "").trim();

  return version || "unknown";
}

function isSystemCoreVersionRlsError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "").trim();
  const message = String((error as any)?.message ?? "").toLowerCase();
  const details = String((error as any)?.details ?? "").toLowerCase();
  const hint = String((error as any)?.hint ?? "").toLowerCase();

  const text = `${message} ${details} ${hint}`;

  return (
    code === "42501" ||
    (text.includes("row-level security") && text.includes("system_core_versions")) ||
    (text.includes("policy") && text.includes("system_core_versions"))
  );
}

async function ensureSystemCoreVersionRow(args: {
  supabase: SupabaseClient;
  digest?: string | null;
  build_sig?: string | null;
  prompt?: string | null;
}): Promise<{ ok: boolean; skipped?: boolean; error?: any }> {
  const digest = clampText(args.digest, 500);
  if (!digest) return { ok: true };

  const payload: any = {
    digest,
    version: extractSystemCoreVersionFromBuildSig(args.build_sig),
    prompt: clampText(args.prompt, 32000) || "[missing system core prompt]",
  };

  const { error } = await args.supabase
    .from("system_core_versions")
    .upsert(payload, { onConflict: "digest" });

  if (!error) return { ok: true };

  if (isSystemCoreVersionRlsError(error)) {
    return { ok: true, skipped: true };
  }

  return { ok: false, error };
}

export async function selectPrevStyleId(args: {
  supabase: SupabaseClient;
  user_id: string; // uuid string
  thread_id: string; // uuid string
}): Promise<number | null> {
  const { supabase, user_id, thread_id } = args;

  const { data, error } = await supabase
    .from("intervention_log")
    .select("style_id")
    .eq("user_id", user_id)
    .eq("thread_id", thread_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  const v = Number((data as any)?.style_id);
  return Number.isFinite(v) ? v : null;
}

export async function selectRecentOutputs(args: {
  supabase: SupabaseClient;
  user_id: string; // uuid string
  thread_id: string; // uuid string
  limit?: number;
}): Promise<string[]> {
  const { supabase, user_id, thread_id } = args;
  const lim = normalizeLimit(args.limit, 8);

  const { data, error } = await supabase
    .from("intervention_log")
    .select("hopy_output")
    .eq("user_id", user_id)
    .eq("thread_id", thread_id)
    .order("created_at", { ascending: false })
    .limit(lim);

  if (error || !data) return [];

  return (data as any[])
    .map((r: any) => String(r?.hopy_output ?? ""))
    .filter(Boolean);
}

export async function updatePrevOutcome(args: {
  supabase: SupabaseClient;
  user_id: string; // uuid string
  thread_id: string; // uuid string
  next_tone: Tone5;
  next_intensity: number;
  current_strategy: Strategy4;
  outcome_error?: string | null;
}): Promise<{ ok: boolean; updated: number; error?: any }> {
  const {
    supabase,
    user_id,
    thread_id,
    next_tone,
    next_intensity,
    current_strategy,
  } = args;

  const { data: prev, error: selErr } = await supabase
    .from("intervention_log")
    .select("id, input_intensity, selected_strategy")
    .eq("user_id", user_id)
    .eq("thread_id", thread_id)
    .is("next_tone", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr) return { ok: false, updated: 0, error: selErr };
  if (!(prev as any)?.id) return { ok: true, updated: 0 };

  const prevIntensity = Number((prev as any)?.input_intensity);
  const tone_shift = Number.isFinite(prevIntensity)
    ? clampInt(next_intensity - prevIntensity, -4, 4)
    : 0;

  const prevStrategy = String((prev as any)?.selected_strategy ?? "");
  const continued = prevStrategy ? prevStrategy === current_strategy : false;

  const patch: any = {
    next_tone,
    tone_shift,
    continued,
  };

  if (args.outcome_error) {
    patch.outcome_error = String(args.outcome_error).slice(0, 2000);
  }

  const { error: upErr } = await supabase
    .from("intervention_log")
    .update(patch)
    .eq("id", (prev as any).id);

  return { ok: !upErr, updated: upErr ? 0 : 1, error: upErr };
}

export async function insertInterventionLog(args: {
  supabase: SupabaseClient;
  user_id: string; // uuid string
  thread_id: string; // uuid string
  turn_key: string;

  user_input: string;
  input_lang: "ja" | "en";
  input_tone: Tone5;
  input_intensity: number;

  selected_strategy: Strategy4;
  style_id: number;

  hopy_output: string;

  // DB: jsonb default []
  avoid_phrases: string[];

  model: string;

  /**
   * ✅ audit
   * - system_digest: 互換/検索用途（従来）
   * - system_core_digest: 憲法(prompt+version)のdigest（DBのsystem_core_versions参照）
   * - build_sig: このビルドがどの憲法seedに紐づくか
   */
  system_digest: string;
  system_core_digest?: string | null;
  build_sig?: string | null;
  system_core_prompt?: string | null;

  phase_before: number;
  phase_after: number;
  score_before: number;
  score_after: number;

  insert_error?: string | null;
}): Promise<{ ok: boolean; error?: any }> {
  const { supabase } = args;

  try {
    const user_id = reqNonEmpty("user_id", args.user_id);
    const thread_id = reqNonEmpty("thread_id", args.thread_id);
    const turn_key = reqNonEmpty("turn_key", args.turn_key);

    const normalizedSystemCoreDigest = args.system_core_digest
      ? clampText(args.system_core_digest, 500)
      : "";

    if (normalizedSystemCoreDigest) {
      const ensured = await ensureSystemCoreVersionRow({
        supabase,
        digest: normalizedSystemCoreDigest,
        build_sig: args.build_sig ?? null,
        prompt: args.system_core_prompt ?? null,
      });

      if (!ensured.ok) {
        return { ok: false, error: ensured.error };
      }
    }

    const payload: any = {
      user_id,
      thread_id,
      turn_key,

      user_input: clampText(args.user_input, 8000),
      input_lang: args.input_lang === "en" ? "en" : "ja",
      input_tone: args.input_tone,
      input_intensity: safeNum(args.input_intensity, 1),

      selected_strategy: args.selected_strategy,
      style_id: safeNum(args.style_id, 0),

      hopy_output: clampText(args.hopy_output, 8000),

      avoid_phrases: normalizeStringArray(args.avoid_phrases, 220, 30),

      model: clampText(args.model ?? "", 120),
      system_digest: clampText(args.system_digest ?? "", 500),

      // ✅ audit columns（存在するなら入れる。nullは許容）
      system_core_digest: normalizedSystemCoreDigest || null,
      build_sig: args.build_sig ? clampText(args.build_sig, 700) : null,

      phase_before: safeNum(args.phase_before, 0),
      phase_after: safeNum(args.phase_after, 0),
      score_before: safeNum(args.score_before, 0),
      score_after: safeNum(args.score_after, 0),
    };

    if (args.insert_error) {
      payload.insert_error = String(args.insert_error).slice(0, 2000);
    }

    const { error } = await supabase.from("intervention_log").insert(payload);

    if (error) return { ok: false, error };
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}