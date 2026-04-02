// /app/api/chat/_lib/hopy/thread/buildThreadPatchFromTurn.ts

import type { HopyStateLevel } from "../state/resolveHopyState";

export type BuildThreadPatchFromTurnInput = {
  reply?: unknown;
  state?: {
    current_phase?: unknown;
    state_level?: unknown;
    prev_phase?: unknown;
    prev_state_level?: unknown;
    state_changed?: unknown;
  } | null;
  assistantCreatedAt?: unknown;
  titleCandidate?: unknown;
};

export type ThreadPatchFromTurn = {
  current_phase: HopyStateLevel;
  state_level: HopyStateLevel;
  prev_phase: HopyStateLevel;
  prev_state_level: HopyStateLevel;
  state_changed: boolean;
  last_assistant_at: string | null;
  latest_reply: string;
  titleCandidate?: string;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeStateLevel(value: unknown, fallback: HopyStateLevel): HopyStateLevel {
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

    if (s === "混線" || s.toLowerCase() === "mixed") return 1;
    if (s === "模索" || s.toLowerCase() === "seeking") return 2;
    if (s === "整理" || s.toLowerCase() === "organizing") return 3;
    if (s === "収束" || s.toLowerCase() === "converging") return 4;
    if (s === "決定" || s.toLowerCase() === "deciding") return 5;
  }

  return fallback;
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

function normalizeReply(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
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

function normalizeTitleCandidate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  return s ? s : undefined;
}

export function buildThreadPatchFromTurn(
  input: BuildThreadPatchFromTurnInput = {},
): ThreadPatchFromTurn {
  const state = input.state ?? null;

  const current = normalizeStateLevel(
    state?.state_level ?? state?.current_phase,
    1,
  );

  const prev = normalizeStateLevel(
    state?.prev_phase ?? state?.prev_state_level,
    current,
  );

  const stateChanged = normalizeBoolean(
    state?.state_changed,
    current !== prev,
  );

  const patch: ThreadPatchFromTurn = {
    current_phase: current,
    state_level: current,
    prev_phase: prev,
    prev_state_level: prev,
    state_changed: stateChanged,
    last_assistant_at: normalizeIsoDatetime(input.assistantCreatedAt),
    latest_reply: normalizeReply(input.reply),
  };

  const titleCandidate = normalizeTitleCandidate(input.titleCandidate);
  if (titleCandidate) {
    patch.titleCandidate = titleCandidate;
  }

  return patch;
}

export default buildThreadPatchFromTurn;