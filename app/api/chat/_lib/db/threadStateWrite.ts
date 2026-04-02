// /app/api/chat/_lib/db/threadStateWrite.ts

export type ThreadStateWriteRow = {
  thread_id: string;
  current_phase: number;
  state_level: number;
  prev_phase: number;
  prev_state_level?: number | null;
  state_changed: boolean;
  updated_at?: string | null;
  last_assistant_at?: string | null;
  latest_reply?: string | null;
  title?: string | null;
};

export type ThreadStateWriteDeps = {
  updateThread: (row: ThreadStateWriteRow) => Promise<unknown>;
};

export type WriteThreadStateInput = {
  row: ThreadStateWriteRow;
};

export type WriteThreadStateResult = {
  updated: boolean;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || typeof value === "undefined") return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeNullableString(value: unknown): string | null {
  const s = normalizeString(value);
  return s || null;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }

  return false;
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

function normalizeIsoDatetime(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    const date = new Date(s);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

function normalizeRow(row: ThreadStateWriteRow): ThreadStateWriteRow {
  const currentPhase = normalizeStateLevel(row.current_phase, 1);
  const stateLevel = normalizeStateLevel(row.state_level, currentPhase);
  const prevPhase = normalizeStateLevel(row.prev_phase, currentPhase);
  const prevStateLevel = normalizeStateLevel(
    row.prev_state_level ?? prevPhase,
    prevPhase,
  );

  const stateChanged = hasMeaningfulValue(row.state_changed)
    ? normalizeBoolean(row.state_changed)
    : currentPhase !== prevPhase;

  return {
    thread_id: normalizeString(row.thread_id),
    current_phase: currentPhase,
    state_level: stateLevel,
    prev_phase: prevPhase,
    prev_state_level: prevStateLevel,
    state_changed: stateChanged,
    updated_at: normalizeIsoDatetime(row.updated_at) ?? new Date().toISOString(),
    last_assistant_at: normalizeIsoDatetime(row.last_assistant_at),
    latest_reply: normalizeNullableString(row.latest_reply),
    title: normalizeNullableString(row.title),
  };
}

function validateRow(row: ThreadStateWriteRow): void {
  if (!row.thread_id) {
    throw new Error("writeThreadState: row.thread_id is required");
  }
}

export async function writeThreadState(
  deps: ThreadStateWriteDeps,
  input: WriteThreadStateInput,
): Promise<WriteThreadStateResult> {
  if (!deps || typeof deps.updateThread !== "function") {
    throw new Error("writeThreadState: deps.updateThread is required");
  }

  const normalizedRow = normalizeRow(input?.row as ThreadStateWriteRow);
  validateRow(normalizedRow);

  await deps.updateThread(normalizedRow);

  return {
    updated: true,
  };
}

export default writeThreadState;