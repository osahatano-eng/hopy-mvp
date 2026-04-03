// /components/chat/ui/leftRailState.ts
import type { HopyState } from "../lib/stateBadge";

function clampPhase1to5(x: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  const r = Math.trunc(n);
  if (r < 1 || r > 5) return null;
  return r as 1 | 2 | 3 | 4 | 5;
}

function hasCanonicalPhaseKeys(value: unknown): value is {
  current_phase?: unknown;
  state_level?: unknown;
  prev_phase?: unknown;
  prev_state_level?: unknown;
  state_changed?: unknown;
  updated_at?: unknown;
} {
  if (!value || typeof value !== "object") return false;

  const obj = value as Record<string, unknown>;

  return (
    "current_phase" in obj ||
    "state_level" in obj ||
    "prev_phase" in obj ||
    "prev_state_level" in obj ||
    "state_changed" in obj
  );
}

function resolveCanonicalStateSource(thread: unknown): Record<string, unknown> | null {
  if (!thread || typeof thread !== "object") return null;

  const th = thread as Record<string, unknown>;

  if (!hasCanonicalPhaseKeys(th)) {
    return null;
  }

  return th;
}

export function toPhaseOrNull(v: unknown): 1 | 2 | 3 | 4 | 5 | null {
  return clampPhase1to5(v);
}

export function safePhaseFromThread(thread: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const source = resolveCanonicalStateSource(thread);
  if (!source) return null;

  const candidates = [source.current_phase, source.state_level];

  for (const value of candidates) {
    const phase = clampPhase1to5(value);
    if (phase != null) return phase;
  }

  return null;
}

export function safePrevPhaseFromThread(thread: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const source = resolveCanonicalStateSource(thread);
  if (!source) return null;

  const candidates = [source.prev_phase, source.prev_state_level];

  for (const value of candidates) {
    const phase = clampPhase1to5(value);
    if (phase != null) return phase;
  }

  return null;
}

export function safeStateChangedFromThread(thread: unknown): boolean | null {
  const source = resolveCanonicalStateSource(thread);
  if (!source) return null;

  const value = source.state_changed;

  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;

  return null;
}

export function buildActiveThreadStateFromThread(thread: unknown): HopyState {
  const source = resolveCanonicalStateSource(thread);
  if (!source) return null;

  const resolvedCurrent = safePhaseFromThread(source);
  const prevPhase = safePrevPhaseFromThread(source);
  const resolvedChanged = safeStateChangedFromThread(source);

  if (resolvedCurrent == null && prevPhase == null) {
    return null;
  }

  const updatedAt = String(source.updated_at ?? "").trim() || null;

  return {
    current_phase: resolvedCurrent,
    state_level: resolvedCurrent,
    prev_phase: prevPhase,
    prev_state_level: prevPhase,
    state_changed: resolvedChanged ?? false,
    updated_at: updatedAt,
  };
}

export function buildActiveThreadState(activeThread: unknown): HopyState {
  try {
    if (!activeThread) return null;
    return buildActiveThreadStateFromThread(activeThread);
  } catch {
    return null;
  }
}

/*
このファイルの正式役割
左カラム用の activeThreadState を安全に組み立てる補助だけを持つファイル。
thread から 1..5 / 5段階の canonical state を読み取り、表示用 HopyState へ整えることに限定する。
*/

/*
【今回このファイルで修正したこと】
1. safePhaseFromThread の戻り型を number | null ではなく 1 | 2 | 3 | 4 | 5 | null に固定しました。
2. safePrevPhaseFromThread の戻り型も同じく 1 | 2 | 3 | 4 | 5 | null に固定しました。
3. 1..5 に絞った値が途中で broad な number に広がらないようにしました。
4. leftRail の表示構造や state の意味定義には触れていません。
*/