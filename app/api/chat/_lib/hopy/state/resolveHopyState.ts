// /app/api/chat/_lib/hopy/state/resolveHopyState.ts

export const HOPY_STATE_LABELS = {
  1: "混線",
  2: "模索",
  3: "整理",
  4: "収束",
  5: "決定",
} as const;

export type HopyStateLevel = 1 | 2 | 3 | 4 | 5;
export type HopyStateLabel = (typeof HOPY_STATE_LABELS)[HopyStateLevel];

export type ResolveHopyStateInput = {
  modelState?: unknown;
  prevStateLevel?: unknown;
};

export type ResolvedHopyState = {
  current_phase: HopyStateLevel;
  state_level: HopyStateLevel;
  prev_phase: HopyStateLevel;
  prev_state_level: HopyStateLevel;
  state_changed: boolean;
  label: HopyStateLabel;
  prev_label: HopyStateLabel;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeNumericState(value: unknown): HopyStateLevel | null {
  if (isFiniteNumber(value)) {
    const rounded = Math.round(value);
    if (rounded === 1) return 1;
    if (rounded === 2) return 2;
    if (rounded === 3) return 3;
    if (rounded === 4) return 4;
    if (rounded === 5) return 5;
    return null;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    const numeric = Number(s);
    if (Number.isFinite(numeric)) {
      return normalizeNumericState(numeric);
    }

    const lowered = s.toLowerCase();

    if (lowered === "mixed" || s === "混線") return 1;
    if (lowered === "seeking" || s === "模索") return 2;
    if (lowered === "organizing" || s === "整理") return 3;
    if (lowered === "converging" || s === "収束") return 4;
    if (lowered === "deciding" || s === "決定") return 5;
  }

  if (isRecord(value)) {
    const candidates: unknown[] = [
      value.state_level,
      value.current_phase,
      value.phase,
      value.level,
      value.currentStateLevel,
      value.currentPhase,
      value.stateLevel,
      value.after_state_level,
      value.next_state_level,
      value.next_phase,
      value.state,
      value.label,
      value.name,
    ];

    for (const candidate of candidates) {
      const normalized = normalizeNumericState(candidate);
      if (normalized != null) return normalized;
    }
  }

  return null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "1") return true;
    if (s === "0") return false;
  }

  return null;
}

function toStateLevelOrNull(value: unknown): HopyStateLevel | null {
  return normalizeNumericState(value);
}

function toStateLabel(level: HopyStateLevel): HopyStateLabel {
  return HOPY_STATE_LABELS[level];
}

function hasCurrentStateShape(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;

  return (
    typeof value.state_level !== "undefined" ||
    typeof value.current_phase !== "undefined" ||
    typeof value.phase !== "undefined" ||
    typeof value.level !== "undefined" ||
    typeof value.currentStateLevel !== "undefined" ||
    typeof value.currentPhase !== "undefined" ||
    typeof value.stateLevel !== "undefined" ||
    typeof value.after_state_level !== "undefined" ||
    typeof value.next_state_level !== "undefined" ||
    typeof value.next_phase !== "undefined"
  );
}

function hasStateShape(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;

  return (
    hasCurrentStateShape(value) ||
    typeof value.prev_phase !== "undefined" ||
    typeof value.prev_state_level !== "undefined" ||
    typeof value.before_state_level !== "undefined" ||
    typeof value.previousPhase !== "undefined" ||
    typeof value.previousStateLevel !== "undefined" ||
    typeof value.state_changed !== "undefined" ||
    typeof value.label !== "undefined" ||
    typeof value.prev_label !== "undefined" ||
    typeof value.name !== "undefined"
  );
}

function pickStateRecord(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;

  const directCandidates: unknown[] = [
    value.state,
    value.assistant_state,
    value.hopy_state,
    value.thread_state,
    value.result_state,
    value.result,
    value.output,
    value.data,
    value,
  ];

  let fallbackRecord: Record<string, unknown> | null = null;

  for (const candidate of directCandidates) {
    if (!hasStateShape(candidate)) continue;
    if (hasCurrentStateShape(candidate)) return candidate;
    if (!fallbackRecord) fallbackRecord = candidate;
  }

  return fallbackRecord;
}

export function resolveHopyState(
  input: ResolveHopyStateInput = {},
): ResolvedHopyState {
  const stateRecord = pickStateRecord(input.modelState);

  const prev =
    toStateLevelOrNull(
      stateRecord?.prev_state_level ??
        stateRecord?.prev_phase ??
        stateRecord?.before_state_level ??
        stateRecord?.previousStateLevel ??
        stateRecord?.previousPhase ??
        input.prevStateLevel,
    ) ?? 1;

  const currentFromStateRecord = toStateLevelOrNull(
    stateRecord?.state_level ??
      stateRecord?.current_phase ??
      stateRecord?.phase ??
      stateRecord?.level ??
      stateRecord?.currentStateLevel ??
      stateRecord?.currentPhase ??
      stateRecord?.stateLevel ??
      stateRecord?.after_state_level ??
      stateRecord?.next_state_level ??
      stateRecord?.next_phase,
  );

  const currentFromModelState = toStateLevelOrNull(input.modelState);

  const current = currentFromStateRecord ?? currentFromModelState ?? prev;

  const explicitChanged = normalizeBoolean(stateRecord?.state_changed);
  const transitionChanged = current !== prev;
  const stateChanged = explicitChanged ?? transitionChanged;

  return {
    current_phase: current,
    state_level: current,
    prev_phase: prev,
    prev_state_level: prev,
    state_changed: stateChanged,
    label: toStateLabel(current),
    prev_label: toStateLabel(prev),
  };
}

export default resolveHopyState;

/*
このファイルの正式役割
HOPY状態の確定用正規化ファイル。
modelState と prevStateLevel を受け取り、
current_phase / state_level / prev_phase / prev_state_level / state_changed / label / prev_label を
唯一の正に整えて返す。
*/

/*
【今回このファイルで修正したこと】
- normalizeBoolean(...) で 1 / 0 / "1" / "0" も true / false として読めるように修正しました。
- explicit な state_changed が来ている場合は、それを唯一の正としてそのまま採用するように修正しました。
- current !== prev の再計算結果で explicit な state_changed を上書きする処理を止めました。
- current / prev の正規化ロジックや label の生成責務はこのファイル内だけに維持し、他ファイルには触れていません。
*/

/* /app/api/chat/_lib/hopy/state/resolveHopyState.ts */
// このファイルの正式役割: HOPY状態の確定用正規化ファイル