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
      value.state,
      value.label,
      value.name,
      value.currentStateLevel,
      value.currentPhase,
      value.stateLevel,
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

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }

  return null;
}

function toStateLevelOrNull(value: unknown): HopyStateLevel | null {
  return normalizeNumericState(value);
}

function toStateLevel(
  value: unknown,
  fallback: HopyStateLevel,
): HopyStateLevel {
  return normalizeNumericState(value) ?? fallback;
}

function toStateLabel(level: HopyStateLevel): HopyStateLabel {
  return HOPY_STATE_LABELS[level];
}

function hasStateShape(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;

  return (
    typeof value.state_level !== "undefined" ||
    typeof value.current_phase !== "undefined" ||
    typeof value.prev_phase !== "undefined" ||
    typeof value.prev_state_level !== "undefined" ||
    typeof value.state_changed !== "undefined" ||
    typeof value.phase !== "undefined" ||
    typeof value.level !== "undefined" ||
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

  for (const candidate of directCandidates) {
    if (!hasStateShape(candidate)) continue;
    return candidate;
  }

  return null;
}

export function resolveHopyState(
  input: ResolveHopyStateInput = {},
): ResolvedHopyState {
  const stateRecord = pickStateRecord(input.modelState);

  const prev =
    toStateLevelOrNull(
      stateRecord?.prev_state_level ??
        stateRecord?.prev_phase ??
        input.prevStateLevel,
    ) ?? 1;

  const currentFromStateRecord = toStateLevelOrNull(
    stateRecord?.state_level ??
      stateRecord?.current_phase ??
      stateRecord?.phase ??
      stateRecord?.level,
  );

  const currentFromModelState = toStateLevelOrNull(input.modelState);

  const current = currentFromStateRecord ?? currentFromModelState ?? prev;

  const explicitChanged = normalizeBoolean(stateRecord?.state_changed);
  const transitionChanged = current !== prev;
  const stateChanged =
    explicitChanged === null
      ? transitionChanged
      : explicitChanged === transitionChanged
        ? explicitChanged
        : transitionChanged;

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
- state_changed を外部入力の false でそのまま固定せず、prev/current の遷移と整合する値だけを採用するよう修正しました。
- 4→3 なのに state_changed=false のような不正を、この確定層で通さないようにしました。
- prev/current が変わっている回では必ず state_changed=true になるよう固定しました。
*/

/* /app/api/chat/_lib/hopy/state/resolveHopyState.ts */
// このファイルの正式役割: HOPY状態の確定用正規化ファイル