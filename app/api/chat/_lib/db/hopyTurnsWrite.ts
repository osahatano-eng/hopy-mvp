// /app/api/chat/_lib/db/hopyTurnsWrite.ts

export type HopyTurnRow = {
  user_id: string;
  thread_id: string;
  reply: string;
  state_level: number;
  current_phase: number;
  prev_phase: number;
  prev_state_level: number;
  state_changed: boolean;
  source_user_message_id?: string | null;
  source_assistant_message_id?: string | null;
  model_version?: string | null;
  prompt_digest?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type HopyTurnsWriteDeps = {
  insertRows: (rows: HopyTurnRow[]) => Promise<unknown>;
};

export type WriteHopyTurnsInput = {
  rows: HopyTurnRow[];
};

export type WriteHopyTurnsResult = {
  attempted: number;
  inserted: number;
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

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeRow(row: HopyTurnRow): HopyTurnRow {
  const stateLevel = normalizeStateLevel(row.state_level, 1);
  const currentPhase = normalizeStateLevel(row.current_phase, stateLevel);
  const prevPhase = normalizeStateLevel(row.prev_phase, currentPhase);
  const prevStateLevel = normalizeStateLevel(row.prev_state_level, prevPhase);

  const stateChanged = hasMeaningfulValue(row.state_changed)
    ? normalizeBoolean(row.state_changed)
    : currentPhase !== prevPhase;

  return {
    user_id: normalizeString(row.user_id),
    thread_id: normalizeString(row.thread_id),
    reply: normalizeString(row.reply),
    state_level: stateLevel,
    current_phase: currentPhase,
    prev_phase: prevPhase,
    prev_state_level: prevStateLevel,
    state_changed: stateChanged,
    source_user_message_id: normalizeNullableString(row.source_user_message_id),
    source_assistant_message_id: normalizeNullableString(
      row.source_assistant_message_id,
    ),
    model_version: normalizeNullableString(row.model_version),
    prompt_digest: normalizeNullableString(row.prompt_digest),
    created_at: normalizeIsoDatetime(row.created_at),
    metadata: normalizeMetadata(row.metadata),
  };
}

function validateRow(row: HopyTurnRow): void {
  if (!row.user_id) {
    throw new Error("writeHopyTurns: row.user_id is required");
  }

  if (!row.thread_id) {
    throw new Error("writeHopyTurns: row.thread_id is required");
  }

  if (!row.reply) {
    throw new Error("writeHopyTurns: row.reply is required");
  }
}

export async function writeHopyTurns(
  deps: HopyTurnsWriteDeps,
  input: WriteHopyTurnsInput,
): Promise<WriteHopyTurnsResult> {
  if (!deps || typeof deps.insertRows !== "function") {
    throw new Error("writeHopyTurns: deps.insertRows is required");
  }

  const rows = Array.isArray(input?.rows) ? input.rows : [];
  const normalizedRows = rows.map(normalizeRow);

  for (const row of normalizedRows) {
    validateRow(row);
  }

  if (normalizedRows.length === 0) {
    return {
      attempted: 0,
      inserted: 0,
    };
  }

  await deps.insertRows(normalizedRows);

  return {
    attempted: normalizedRows.length,
    inserted: normalizedRows.length,
  };
}

export default writeHopyTurns;