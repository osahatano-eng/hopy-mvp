// /components/chat/lib/threadApiNormalize.ts
import type { Thread } from "./chatTypes";
import { safeIso, nowIso, safeStateLevel } from "./threadApiSupport";

const THREAD_SELECT_COLUMNS_WITH_UPDATED =
  "id, title, updated_at, created_at, state_level, current_phase";

const THREAD_SELECT_COLUMNS_NO_UPDATED =
  "id, title, created_at, state_level, current_phase";

export const THREAD_SELECT_FULL = THREAD_SELECT_COLUMNS_WITH_UPDATED;
export const THREAD_SELECT_MIN = THREAD_SELECT_COLUMNS_WITH_UPDATED;

export const THREAD_SELECT_NO_UPDATED = THREAD_SELECT_COLUMNS_NO_UPDATED;
export const THREAD_SELECT_MIN_NO_UPDATED = THREAD_SELECT_COLUMNS_NO_UPDATED;

function safePhase(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 1 || i > 5) return null;
  return i;
}

function safeBool(v: any): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return null;
}

export function normalizeThreadRow(
  row: any,
  titleFallback: string,
  opts?: {
    preferNowIfMissingUpdated?: boolean;
    bumpNowForEventIfMissingUpdated?: boolean;
  },
): Thread {
  const id = String(row?.id ?? "").trim();
  const titleRaw = String(row?.title ?? "").trim();
  const title = titleRaw || titleFallback;

  const updated_at_raw = safeIso(row?.updated_at);
  const created_at_raw = safeIso(row?.created_at);

  let updated_at = updated_at_raw || created_at_raw;

  if (!updated_at && opts?.preferNowIfMissingUpdated) {
    updated_at = nowIso();
  }

  if (!updated_at && opts?.bumpNowForEventIfMissingUpdated) {
    const n = nowIso();
    if (n) updated_at = n;
  }

  const out: any = { id, title };
  if (updated_at) out.updated_at = updated_at;

  const sl = safeStateLevel(row?.state_level);
  if (sl != null) {
    out.state_level = sl;
    out.stateLevel = sl;
    out.level = sl;
  }

  const currentPhase = safePhase(row?.current_phase);
  const prevPhase = safePhase(row?.prev_phase);
  const prevStateLevel = safeStateLevel(row?.prev_state_level);
  const stateChanged = safeBool(row?.state_changed);

  if (currentPhase != null) {
    out.current_phase = currentPhase;
    out.currentPhase = currentPhase;
    out.phase = currentPhase;
    out.state_phase = currentPhase;
    out.statePhase = currentPhase;
  }

  if (prevPhase != null) {
    out.prev_phase = prevPhase;
    out.prevPhase = prevPhase;
    out.previous_phase = prevPhase;
    out.previousPhase = prevPhase;
    out.state_prev_phase = prevPhase;
    out.statePrevPhase = prevPhase;
  }

  if (prevStateLevel != null) {
    out.prev_state_level = prevStateLevel;
    out.prevStateLevel = prevStateLevel;
    out.previous_state_level = prevStateLevel;
    out.previousStateLevel = prevStateLevel;
  }

  if (stateChanged != null) {
    out.state_changed = stateChanged;
    out.stateChanged = stateChanged;
    out.phase_changed = stateChanged;
    out.phaseChanged = stateChanged;
  }

  if (
    sl != null ||
    currentPhase != null ||
    prevPhase != null ||
    prevStateLevel != null ||
    stateChanged != null
  ) {
    const hopyState = {
      state_level: sl ?? null,
      stateLevel: sl ?? null,
      level: sl ?? null,
      current_phase: currentPhase ?? null,
      currentPhase: currentPhase ?? null,
      phase: currentPhase ?? null,
      state_phase: currentPhase ?? null,
      statePhase: currentPhase ?? null,
      prev_phase: prevPhase ?? null,
      prevPhase: prevPhase ?? null,
      previous_phase: prevPhase ?? null,
      previousPhase: prevPhase ?? null,
      prev_state_level: prevStateLevel ?? null,
      prevStateLevel: prevStateLevel ?? null,
      previous_state_level: prevStateLevel ?? null,
      previousStateLevel: prevStateLevel ?? null,
      state_changed: stateChanged ?? null,
      stateChanged: stateChanged ?? null,
      phase_changed: stateChanged ?? null,
      phaseChanged: stateChanged ?? null,
    };

    out.state = hopyState;
    out.hopy_state = hopyState;
    out.hopyState = hopyState;
  }

  return out as Thread;
}

/*
このファイルの正式役割
conversations 行を Thread に正規化する共通ファイル。
select 文字列の共通定義と、UI が受け取れる Thread 形への変換だけを担当する。
取得・作成・更新・本文表示の責務は持たない。

【今回このファイルで修正したこと】
1. THREAD_SELECT_FULL と THREAD_SELECT_MIN の重複定義を共通化しました。
2. THREAD_SELECT_NO_UPDATED と THREAD_SELECT_MIN_NO_UPDATED の重複定義を共通化しました。
3. normalizeThreadRow の出力内容、state 1..5、updated_at 補完、alias フィールド構成には触っていません。
*/

/* /components/chat/lib/threadApiNormalize.ts */