// /app/api/chat/_lib/hopy/result/buildHopyTurnResult.ts

import {
  resolveHopyState,
  type ResolvedHopyState,
} from "../state/resolveHopyState";
import {
  buildThreadPatchFromTurn,
  type ThreadPatchFromTurn,
} from "../thread/buildThreadPatchFromTurn";

export type BuildHopyTurnResultInput = {
  parsed?: {
    reply?: unknown;
    state?: unknown;
    memoryCandidates?: unknown;
    dashboardSignals?: unknown;
    expressionCandidates?: unknown;
    titleCandidate?: unknown;
    notification?: unknown;
    debug?: unknown;
    assistant_state?: unknown;
    current_phase?: unknown;
    state_level?: unknown;
    prev_phase?: unknown;
    prev_state_level?: unknown;
    state_changed?: unknown;
    label?: unknown;
    prev_label?: unknown;
  } | null;
  modelOutput?: unknown;
  prevStateLevel?: unknown;
  assistantCreatedAt?: unknown;
};

export type HopyTurnResult = {
  reply: string;
  state: ResolvedHopyState;
  threadPatch: ThreadPatchFromTurn;
  memoryCandidates: unknown[];
  dashboardSignals: unknown[];
  expressionCandidates: unknown[];
  notification: {
    unread_count: number;
    updated_at: string | null;
  };
  debug?: unknown;
};

function normalizeReply(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) {
      return Math.max(0, Math.round(n));
    }
  }

  return 0;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pickParsedLike(
  input: BuildHopyTurnResultInput,
): Record<string, unknown> {
  const parsed =
    input.parsed && typeof input.parsed === "object"
      ? (input.parsed as Record<string, unknown>)
      : {};

  const modelOutput =
    input.modelOutput && typeof input.modelOutput === "object"
      ? (input.modelOutput as Record<string, unknown>)
      : {};

  return {
    ...modelOutput,
    ...parsed,
    state:
      typeof parsed.state !== "undefined" ? parsed.state : modelOutput.state,
    assistant_state:
      typeof parsed.assistant_state !== "undefined"
        ? parsed.assistant_state
        : modelOutput.assistant_state,
    current_phase:
      typeof parsed.current_phase !== "undefined"
        ? parsed.current_phase
        : modelOutput.current_phase,
    state_level:
      typeof parsed.state_level !== "undefined"
        ? parsed.state_level
        : modelOutput.state_level,
    prev_phase:
      typeof parsed.prev_phase !== "undefined"
        ? parsed.prev_phase
        : modelOutput.prev_phase,
    prev_state_level:
      typeof parsed.prev_state_level !== "undefined"
        ? parsed.prev_state_level
        : modelOutput.prev_state_level,
    state_changed:
      typeof parsed.state_changed !== "undefined"
        ? parsed.state_changed
        : modelOutput.state_changed,
    label:
      typeof parsed.label !== "undefined" ? parsed.label : modelOutput.label,
    prev_label:
      typeof parsed.prev_label !== "undefined"
        ? parsed.prev_label
        : modelOutput.prev_label,
  };
}

function hasOwnStateShape(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;

  return (
    typeof value.current_phase !== "undefined" ||
    typeof value.state_level !== "undefined" ||
    typeof value.prev_phase !== "undefined" ||
    typeof value.prev_state_level !== "undefined" ||
    typeof value.state_changed !== "undefined" ||
    typeof value.label !== "undefined" ||
    typeof value.prev_label !== "undefined"
  );
}

function pickModelState(source: Record<string, unknown>): unknown {
  if (hasOwnStateShape(source.state)) {
    return source.state;
  }

  if (hasOwnStateShape(source.assistant_state)) {
    return source.assistant_state;
  }

  if (hasOwnStateShape(source)) {
    return {
      current_phase: source.current_phase,
      state_level: source.state_level,
      prev_phase: source.prev_phase,
      prev_state_level: source.prev_state_level,
      state_changed: source.state_changed,
      label: source.label,
      prev_label: source.prev_label,
    };
  }

  if (typeof source.state !== "undefined") {
    return source.state;
  }

  return undefined;
}

export function buildHopyTurnResult(
  input: BuildHopyTurnResultInput = {},
): HopyTurnResult {
  const source = pickParsedLike(input);

  const reply = normalizeReply(source.reply);

  const state = resolveHopyState({
    modelState: pickModelState(source),
    prevStateLevel: input.prevStateLevel,
  });

  const threadPatch = buildThreadPatchFromTurn({
    reply,
    state,
    assistantCreatedAt: input.assistantCreatedAt,
    titleCandidate: source.titleCandidate,
  });

  return {
    reply,
    state,
    threadPatch,
    memoryCandidates: normalizeArray(
      source.memoryCandidates ?? source.memory_candidates ?? source.memories,
    ),
    dashboardSignals: normalizeArray(
      source.dashboardSignals ?? source.dashboard_signals,
    ),
    expressionCandidates: normalizeArray(
      source.expressionCandidates ?? source.expression_candidates,
    ),
    notification: {
      unread_count: normalizeCount(
        source.notification && typeof source.notification === "object"
          ? (source.notification as Record<string, unknown>).unread_count
          : undefined,
      ),
      updated_at: normalizeIsoDatetime(
        source.notification && typeof source.notification === "object"
          ? (source.notification as Record<string, unknown>).updated_at
          : undefined,
      ),
    },
    ...(typeof source.debug === "undefined" ? {} : { debug: source.debug }),
  };
}

export default buildHopyTurnResult;