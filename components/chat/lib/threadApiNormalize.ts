// /components/chat/lib/threadApiNormalize.ts
import type { Thread } from "./chatTypes";
import { safeIso, nowIso, safeStateLevel } from "./threadApiSupport";

// ✅ 現DB（conversations）実在列に合わせる
// columns: id, user_id, title, created_at, updated_at, state_level, client_request_id, current_phase
export const THREAD_SELECT_FULL = "id, title, updated_at, created_at, state_level, current_phase";

export const THREAD_SELECT_NO_UPDATED = "id, title, created_at, state_level, current_phase";

export const THREAD_SELECT_MIN = "id, title, updated_at, created_at, state_level, current_phase";

export const THREAD_SELECT_MIN_NO_UPDATED = "id, title, created_at, state_level, current_phase";

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

// ✅ Thread を「必ずUIが食える形」に正規化（チャット個別状態も載せる）
// ✅ conversations 実在列を正として扱う
export function normalizeThreadRow(
  row: any,
  titleFallback: string,
  opts?: {
    preferNowIfMissingUpdated?: boolean;
    /**
     * ✅ “確定イベント”の安定化
     * - DBがupdated_atを返せる環境では「上書きしない」（並びの不自然なジャンプを防ぐ）
     * - ただし updated_at が空/無い環境では now を入れて UI の並びが死なないようにする
     */
    bumpNowForEventIfMissingUpdated?: boolean;
  }
): Thread {
  const id = String(row?.id ?? "").trim();
  const titleRaw = String(row?.title ?? "").trim();
  const title = titleRaw || titleFallback;

  const updated_at_raw = safeIso(row?.updated_at);
  const created_at_raw = safeIso(row?.created_at);

  let updated_at = updated_at_raw || created_at_raw;

  // ✅ updated_at が取れない/空でも「確定イベント」で並びが死なないように保険を入れる
  if (!updated_at && opts?.preferNowIfMissingUpdated) {
    updated_at = nowIso();
  }

  // ✅ 確定イベント：updated_at が無い場合のみ now 補完
  // - DB trigger/返却が正しい環境では “上書きしない”
  if (!updated_at && opts?.bumpNowForEventIfMissingUpdated) {
    const n = nowIso();
    if (n) updated_at = n;
  }

  const out: any = { id, title };
  if (updated_at) out.updated_at = updated_at;

  // ✅ conversations 実在列: state_level / current_phase を正として扱う
  const sl = safeStateLevel(row?.state_level);
  if (sl != null) {
    out.state_level = sl;
    out.stateLevel = sl;
    out.level = sl;
  }

  const currentPhase = safePhase(row?.current_phase);

  // ✅ conversations に prev/state_changed 系は無いので、存在する場合だけ通す
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