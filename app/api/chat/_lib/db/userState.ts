// /app/api/chat/_lib/db/userState.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { clampInt, envInt } from "../env";
import type { Lang } from "../router/simpleRouter";
import {
  stabilizedDelta,
  detectTrigger,
  phaseFromScoreHysteresis,
  type StabilizedDelta,
} from "../state/score";

export type UserState = {
  user_id: string;
  current_phase: number; // 1..5
  stability_score: number; // -100..100
  last_trigger: string | null;
  updated_at?: string;
};

type TriggerMeta = {
  at: string; // ISO
  lang: Lang;
  ctx: "dev" | "normal";
  tone: string | null;
  neg_streak: number;
  delta_raw: number;
  delta_guarded: number;
  delta_applied: number;
  cooldown: boolean;
  reasons: string[];
};

function reqNonEmpty(name: string, v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`${name}_empty`);
  return s;
}

function safeJsonParse<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(String(s)) as T;
  } catch {
    return null;
  }
}

function safeStringOrNull(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function safeIsoString(v: any): string | undefined {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  return s;
}

function normalizePhase5(v: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return clampInt(Math.round(n), 1, 5) as 1 | 2 | 3 | 4 | 5;
}

function resolveNextPhase(params: {
  prevPhase: 1 | 2 | 3 | 4 | 5;
  nextScore: number;
  deltaApplied: number;
}): 1 | 2 | 3 | 4 | 5 {
  const scoreDrivenPhase = normalizePhase5(
    phaseFromScoreHysteresis({
      score: params.nextScore,
      prevPhase: params.prevPhase,
    })
  );

  if (scoreDrivenPhase !== params.prevPhase) {
    return scoreDrivenPhase;
  }

  if (params.deltaApplied > 0) {
    return normalizePhase5(params.prevPhase + 1);
  }

  if (params.deltaApplied < 0) {
    return normalizePhase5(params.prevPhase - 1);
  }

  return params.prevPhase;
}

function mapUserStateRow(row: any): UserState {
  return {
    user_id: String(row.user_id),
    current_phase: normalizePhase5(row.current_phase ?? 1),
    stability_score: clampInt(row.stability_score ?? 0, -100, 100),
    last_trigger: safeStringOrNull(row.last_trigger),
    updated_at: safeIsoString(row.updated_at),
  };
}

function getNegStreakFromLastTrigger(lastTrigger: string | null | undefined) {
  const meta = safeJsonParse<any>(lastTrigger);
  const n = meta?.neg_streak;
  if (typeof n === "number" && Number.isFinite(n)) return clampInt(n, 0, 9999);
  return 0;
}

function detectPositiveMissionBoost(text: string, uiLang: Lang): {
  boost: number;
  reasons: string[];
} {
  const s = String(text ?? "").trim();
  if (!s) return { boost: 0, reasons: [] };

  if (uiLang === "ja") {
    const hasHopy = /HOPY/.test(s);
    const hasWorld = /世界|世界中|世に出/.test(s);
    const hasHelp = /役に立|助け|支え/.test(s);
    const hasJoy = /うれしい|嬉しい|最高|喜び/.test(s);
    const hasWish = /願い|願って|届けたい|広めたい/.test(s);

    const reasons: string[] = [];
    if (hasHopy) reasons.push("mission_hopy");
    if (hasWorld) reasons.push("mission_world");
    if (hasHelp) reasons.push("mission_help");
    if (hasJoy) reasons.push("mission_joy");
    if (hasWish) reasons.push("mission_wish");

    const strongCore =
      (hasHopy && hasWorld && hasHelp) ||
      (hasWorld && hasHelp && hasJoy) ||
      (hasHopy && hasHelp && hasWish) ||
      (hasHopy && hasWorld && hasWish);

    if (!strongCore) return { boost: 0, reasons: [] };

    return {
      boost: 8,
      reasons,
    };
  }

  const sl = s.toLowerCase();
  const hasHopy = /hopy/.test(sl);
  const hasWorld = /world|people|public|launch|release/.test(sl);
  const hasHelp = /help|support|useful/.test(sl);
  const hasJoy = /happy|glad|great|best|joy/.test(sl);
  const hasWish = /wish|hope|want to|would love to/.test(sl);

  const reasons: string[] = [];
  if (hasHopy) reasons.push("mission_hopy");
  if (hasWorld) reasons.push("mission_world");
  if (hasHelp) reasons.push("mission_help");
  if (hasJoy) reasons.push("mission_joy");
  if (hasWish) reasons.push("mission_wish");

  const strongCore =
    (hasHopy && hasWorld && hasHelp) ||
    (hasWorld && hasHelp && hasJoy) ||
    (hasHopy && hasHelp && hasWish) ||
    (hasHopy && hasWorld && hasWish);

  if (!strongCore) return { boost: 0, reasons: [] };

  return {
    boost: 8,
    reasons,
  };
}

function buildTriggerMeta(params: {
  uiLang: Lang;
  delta: StabilizedDelta;
  tone: string | null;
  deltaAppliedFinal?: number;
  extraReasons?: string[];
}): TriggerMeta {
  const now = new Date().toISOString();
  const finalDeltaApplied =
    typeof params.deltaAppliedFinal === "number" && Number.isFinite(params.deltaAppliedFinal)
      ? Math.trunc(params.deltaAppliedFinal)
      : params.delta.delta_applied;

  const reasons = Array.isArray(params.delta.reasons) ? [...params.delta.reasons] : [];
  if (Array.isArray(params.extraReasons) && params.extraReasons.length) {
    for (const r of params.extraReasons) {
      const v = String(r ?? "").trim();
      if (!v) continue;
      if (!reasons.includes(v)) reasons.push(v);
    }
  }

  return {
    at: now,
    lang: params.uiLang,
    ctx: params.delta.is_dev_context ? "dev" : "normal",
    tone: params.tone ?? null,
    neg_streak: params.delta.neg_streak_next,
    delta_raw: params.delta.delta_raw,
    delta_guarded: params.delta.delta_guarded,
    delta_applied: finalDeltaApplied,
    cooldown: params.delta.is_cooldown,
    reasons,
  };
}

export function computeNextUserState(params: {
  text: string;
  uiLang: Lang;
  prev: UserState | null;
}): {
  nextScore: number;
  nextPhase: number;
  nextTrigger: string | null;
  deltaApplied: number;
  negStreakNext: number;
  isCooldown: boolean;
} {
  const rawText = String(params.text ?? "").trim();
  const uiLang = params.uiLang;

  const prevScore = clampInt(params.prev?.stability_score ?? 0, -100, 100);
  const prevPhase = normalizePhase5(params.prev?.current_phase ?? 1);
  const negStreakPrev = getNegStreakFromLastTrigger(params.prev?.last_trigger);
  const minIntervalSec = envInt("USER_STATE_MIN_INTERVAL_SEC", 12);

  const delta = stabilizedDelta({
    text: rawText,
    uiLang,
    updatedAt: params.prev?.updated_at ?? null,
    minIntervalSec,
    negStreakPrev,
  });

  const tone = detectTrigger(rawText, uiLang);

  const missionBoost =
    !delta.is_cooldown && delta.delta_applied <= 0
      ? detectPositiveMissionBoost(rawText, uiLang)
      : { boost: 0, reasons: [] as string[] };

  const deltaAppliedFinal = clampInt(delta.delta_applied + missionBoost.boost, -100, 100);
  const nextScore = clampInt(prevScore + deltaAppliedFinal, -100, 100);

  const meta = buildTriggerMeta({
    uiLang,
    delta,
    tone,
    deltaAppliedFinal,
    extraReasons: missionBoost.boost > 0 ? missionBoost.reasons : [],
  });

  const nextPhase = resolveNextPhase({
    prevPhase,
    nextScore,
    deltaApplied: deltaAppliedFinal,
  });

  const nextTrigger = JSON.stringify(meta);

  return {
    nextScore,
    nextPhase,
    nextTrigger,
    deltaApplied: deltaAppliedFinal,
    negStreakNext: delta.neg_streak_next,
    isCooldown: delta.is_cooldown,
  };
}

async function selectUserStateRow(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<{ ok: boolean; row?: any; error?: any }> {
  const { data, error } = await params.supabase
    .from("user_state")
    .select("user_id,current_phase,stability_score,last_trigger,updated_at")
    .eq("user_id", params.userId)
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error };
  return { ok: true, row: data ?? null };
}

export async function getOrCreateUserState(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<{ ok: boolean; state?: UserState; error?: any }> {
  const { supabase } = params;

  try {
    const userId = reqNonEmpty("userId", params.userId);

    const selected = await selectUserStateRow({ supabase, userId });
    if (!selected.ok) return { ok: false, error: selected.error };

    if (selected.row) {
      return {
        ok: true,
        state: mapUserStateRow(selected.row),
      };
    }

    const now = new Date().toISOString();

    const { data: ins, error: insErr } = await supabase
      .from("user_state")
      .insert({
        user_id: userId,
        current_phase: 1,
        stability_score: 0,
        last_trigger: null,
        updated_at: now,
      })
      .select("user_id,current_phase,stability_score,last_trigger,updated_at")
      .single();

    if (insErr) return { ok: false, error: insErr };

    return {
      ok: true,
      state: mapUserStateRow(ins),
    };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function writeUserState(params: {
  supabase: SupabaseClient;
  userId: string;
  nextScore: number;
  nextPhase: number;
  trigger: string | null;
}): Promise<{ ok: boolean; state?: UserState; error?: any }> {
  const { supabase } = params;

  try {
    const userId = reqNonEmpty("userId", params.userId);
    const score = clampInt(params.nextScore ?? 0, -100, 100);
    const phase = normalizePhase5(params.nextPhase ?? 1);
    const now = new Date().toISOString();

    const payload = {
      user_id: userId,
      stability_score: score,
      current_phase: phase,
      last_trigger: params.trigger ?? null,
      updated_at: now,
    };

    const existing = await selectUserStateRow({ supabase, userId });
    if (!existing.ok) return { ok: false, error: existing.error };

    if (existing.row) {
      const { data: updated, error: updateErr } = await supabase
        .from("user_state")
        .update({
          stability_score: payload.stability_score,
          current_phase: payload.current_phase,
          last_trigger: payload.last_trigger,
          updated_at: payload.updated_at,
        })
        .eq("user_id", userId)
        .select("user_id,current_phase,stability_score,last_trigger,updated_at")
        .limit(1)
        .single();

      if (updateErr) return { ok: false, error: updateErr };

      return {
        ok: true,
        state: mapUserStateRow(updated),
      };
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("user_state")
      .insert(payload)
      .select("user_id,current_phase,stability_score,last_trigger,updated_at")
      .single();

    if (insertErr) return { ok: false, error: insertErr };

    return {
      ok: true,
      state: mapUserStateRow(inserted),
    };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * route 側が迷子にならないためのワンショット更新
 * - prev を渡して next を計算し、そのまま保存する
 * - cooldown時は保存しない（updated_at を進めない）
 * - skipped / skip_reason を返す
 */
export async function updateUserStateFromMessage(params: {
  supabase: SupabaseClient;
  userId: string;
  uiLang: Lang;
  text: string;
}): Promise<{
  ok: boolean;
  state?: UserState;
  error?: any;
  skipped?: boolean;
  skip_reason?: string | null;
  applied?: {
    deltaApplied: number;
    nextScore: number;
    nextPhase: number;
    triggerJson: string | null;
  };
}> {
  try {
    const userId = reqNonEmpty("userId", params.userId);

    const prevRes = await getOrCreateUserState({
      supabase: params.supabase,
      userId,
    });
    if (!prevRes.ok) return { ok: false, error: prevRes.error };

    const prev = prevRes.state ?? null;

    const next = computeNextUserState({
      text: params.text,
      uiLang: params.uiLang,
      prev,
    });

    if (next.isCooldown) {
      return {
        ok: true,
        state: prev ?? undefined,
        skipped: true,
        skip_reason: "cooldown",
        applied: {
          deltaApplied: 0,
          nextScore: next.nextScore,
          nextPhase: next.nextPhase,
          triggerJson: next.nextTrigger,
        },
      };
    }

    const wr = await writeUserState({
      supabase: params.supabase,
      userId,
      nextScore: next.nextScore,
      nextPhase: next.nextPhase,
      trigger: next.nextTrigger,
    });

    if (!wr.ok) return { ok: false, error: wr.error };

    return {
      ok: true,
      state: wr.state,
      skipped: false,
      skip_reason: null,
      applied: {
        deltaApplied: next.deltaApplied,
        nextScore: next.nextScore,
        nextPhase: next.nextPhase,
        triggerJson: next.nextTrigger,
      },
    };
  } catch (error) {
    return { ok: false, error };
  }
}

/*
このファイルの正式役割
user_state の読取・初回作成・更新本体です。
新規ユーザーなら初回 row を作成し、
既存ユーザーなら current_phase / stability_score / last_trigger / updated_at を更新します。
route 層からは update.ts 経由で呼ばれる前提です。
*/

/*
【今回このファイルで修正したこと】
- Lang の import 元を現行ルート系とそろえて ../router/simpleRouter に戻しました。
- それ以外の user_state 読取・初回作成・更新ロジックは変えていません。
*/
// このファイルの正式役割: user_state の読取・初回作成・更新本体