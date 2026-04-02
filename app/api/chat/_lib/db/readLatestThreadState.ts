// /app/api/chat/_lib/db/readLatestThreadState.ts

export type LatestThreadStateRow = {
  current_phase?: unknown;
  state_level?: unknown;
  prev_phase?: unknown;
  prev_state_level?: unknown;
  state_changed?: unknown;
};

export type LatestThreadState = {
  current_phase: 1 | 2 | 3 | 4 | 5;
  state_level: 1 | 2 | 3 | 4 | 5;
  prev_phase: 1 | 2 | 3 | 4 | 5;
  prev_state_level: 1 | 2 | 3 | 4 | 5;
  state_changed: boolean;
};

export type ReadLatestThreadStateDeps = {
  fetchThreadState: (threadId: string) => Promise<LatestThreadStateRow | null>;
};

export type ReadLatestThreadStateInput = {
  threadId?: unknown;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }

  return fallback;
}

function normalizeStateLevel(
  value: unknown,
  fallback: 1 | 2 | 3 | 4 | 5,
): 1 | 2 | 3 | 4 | 5 {
  if (isFiniteNumber(value)) {
    const rounded = Math.round(value);
    if (rounded <= 1) return 1;
    if (rounded >= 5) return 5;
    if (rounded === 2) return 2;
    if (rounded === 3) return 3;
    if (rounded === 4) return 4;
    return fallback;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return fallback;

    const numeric = Number(s);
    if (Number.isFinite(numeric)) {
      return normalizeStateLevel(numeric, fallback);
    }

    const lower = s.toLowerCase();
    if (s === "混線" || lower === "mixed") return 1;
    if (s === "模索" || lower === "seeking") return 2;
    if (s === "整理" || lower === "organizing") return 3;
    if (s === "収束" || lower === "converging") return 4;
    if (s === "決定" || lower === "deciding") return 5;
  }

  return fallback;
}

function normalizeRow(
  row: LatestThreadStateRow | null,
): LatestThreadState | null {
  if (!row) return null;

  const current = normalizeStateLevel(
    row.state_level ?? row.current_phase,
    1,
  );

  const prev = normalizeStateLevel(
    row.prev_state_level ?? row.prev_phase,
    current,
  );

  return {
    current_phase: current,
    state_level: current,
    prev_phase: prev,
    prev_state_level: prev,
    state_changed: normalizeBoolean(row.state_changed, current !== prev),
  };
}

export async function readLatestThreadState(
  deps: ReadLatestThreadStateDeps,
  input: ReadLatestThreadStateInput,
): Promise<LatestThreadState | null> {
  if (!deps || typeof deps.fetchThreadState !== "function") {
    throw new Error("readLatestThreadState: deps.fetchThreadState is required");
  }

  const threadId = normalizeString(input?.threadId);
  if (!threadId) {
    return null;
  }

  const row = await deps.fetchThreadState(threadId);
  return normalizeRow(row);
}

export default readLatestThreadState;