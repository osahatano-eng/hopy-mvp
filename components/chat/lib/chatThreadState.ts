// /components/chat/lib/chatThreadState.ts
import type { ChatMsg, Thread } from "./chatTypes";
import type { HopyState } from "./stateBadge";

export function readNumeric(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function readBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return null;
}

export function clampStatePhase(v: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
  const n = readNumeric(v);
  if (n == null) return undefined;
  const r = Math.round(n);
  if (r < 1 || r > 5) return undefined;
  if (r === 1) return 1;
  if (r === 2) return 2;
  if (r === 3) return 3;
  if (r === 4) return 4;
  return 5;
}

export function clampStateLevel(v: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
  const n = readNumeric(v);
  if (n == null) return undefined;
  const r = Math.round(n);
  if (r < 1 || r > 5) return undefined;
  if (r === 1) return 1;
  if (r === 2) return 2;
  if (r === 3) return 3;
  if (r === 4) return 4;
  return 5;
}

export function pickDefined(...values: any[]) {
  for (const v of values) {
    if (v !== undefined) return v;
  }
  return undefined;
}

export function readStateLike(source: any) {
  if (!source || typeof source !== "object") return null;

  const candidates = [
    source?.state,
    source?.assistant_state,
    source?.assistantState,
    source?.reply_state,
    source?.replyState,
    source?.hopy_state,
    source?.hopyState,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") return candidate;
  }

  return null;
}

export function mergeThreadStatePatch(thread: Thread, patch: any): Thread {
  const prevRaw = thread as any;
  const patchRaw = patch as any;

  const prevState = readStateLike(prevRaw);
  const patchState = readStateLike(patchRaw);

  const stateLevel = clampStateLevel(
    pickDefined(
      patchRaw?.state_level,
      patchRaw?.stateLevel,
      patchState?.state_level,
      patchState?.stateLevel,
      prevRaw?.state_level,
      prevRaw?.stateLevel,
      prevState?.state_level,
      prevState?.stateLevel
    )
  );

  const currentPhase = clampStatePhase(
    pickDefined(
      patchRaw?.current_phase,
      patchRaw?.currentPhase,
      patchState?.current_phase,
      patchState?.currentPhase,
      prevRaw?.current_phase,
      prevRaw?.currentPhase,
      prevState?.current_phase,
      prevState?.currentPhase
    )
  );

  const prevPhase = clampStatePhase(
    pickDefined(
      patchRaw?.prev_phase,
      patchRaw?.prevPhase,
      patchState?.prev_phase,
      patchState?.prevPhase,
      prevRaw?.prev_phase,
      prevRaw?.prevPhase,
      prevState?.prev_phase,
      prevState?.prevPhase
    )
  );

  const prevStateLevel = clampStateLevel(
    pickDefined(
      patchRaw?.prev_state_level,
      patchRaw?.prevStateLevel,
      patchState?.prev_state_level,
      patchState?.prevStateLevel,
      prevRaw?.prev_state_level,
      prevRaw?.prevStateLevel,
      prevState?.prev_state_level,
      prevState?.prevStateLevel
    )
  );

  const stateChanged = (() => {
    const picked = pickDefined(
      patchRaw?.state_changed,
      patchRaw?.stateChanged,
      patchState?.state_changed,
      patchState?.stateChanged,
      prevRaw?.state_changed,
      prevRaw?.stateChanged,
      prevState?.state_changed,
      prevState?.stateChanged
    );
    const parsed = readBool(picked);
    return parsed == null ? undefined : parsed;
  })();

  const mergedState = {
    ...(prevState && typeof prevState === "object" ? prevState : {}),
    ...(patchState && typeof patchState === "object" ? patchState : {}),
  } as Record<string, any>;

  if (stateLevel !== undefined) {
    mergedState.state_level = stateLevel;
    mergedState.stateLevel = stateLevel;
  }

  if (currentPhase !== undefined) {
    mergedState.current_phase = currentPhase;
    mergedState.currentPhase = currentPhase;
  }

  if (prevPhase !== undefined) {
    mergedState.prev_phase = prevPhase;
    mergedState.prevPhase = prevPhase;
  }

  if (prevStateLevel !== undefined) {
    mergedState.prev_state_level = prevStateLevel;
    mergedState.prevStateLevel = prevStateLevel;
  }

  if (stateChanged !== undefined) {
    mergedState.state_changed = stateChanged;
    mergedState.stateChanged = stateChanged;
  }

  const next: any = { ...prevRaw };

  if (stateLevel !== undefined) {
    next.state_level = stateLevel;
    next.stateLevel = stateLevel;
  }

  if (currentPhase !== undefined) {
    next.current_phase = currentPhase;
    next.currentPhase = currentPhase;
  }

  if (prevPhase !== undefined) {
    next.prev_phase = prevPhase;
    next.prevPhase = prevPhase;
  }

  if (prevStateLevel !== undefined) {
    next.prev_state_level = prevStateLevel;
    next.prevStateLevel = prevStateLevel;
  }

  if (stateChanged !== undefined) {
    next.state_changed = stateChanged;
    next.stateChanged = stateChanged;
  }

  if (
    stateLevel !== undefined ||
    currentPhase !== undefined ||
    prevPhase !== undefined ||
    prevStateLevel !== undefined ||
    stateChanged !== undefined ||
    Object.keys(mergedState).length > 0
  ) {
    next.state = mergedState;
    next.hopy_state = mergedState;
    next.hopyState = mergedState;
  }

  return next as Thread;
}

export function mergeThreadStateFromMessage(thread: Thread, msg: ChatMsg): Thread {
  return mergeThreadStatePatch(thread, msg);
}

export function mergeThreadStateFromUserState(thread: Thread, userState: HopyState | null): Thread {
  void userState;
  return thread;
}

export function readActiveThreadStateLevel(thread: Thread | null): number | undefined {
  const raw = thread as any;
  if (!raw || typeof raw !== "object") return undefined;

  const state = readStateLike(raw);

  const currentPhase = clampStatePhase(
    pickDefined(
      raw?.current_phase,
      raw?.currentPhase,
      state?.current_phase,
      state?.currentPhase
    )
  );
  if (currentPhase !== undefined) return currentPhase;

  return clampStateLevel(
    pickDefined(
      raw?.state_level,
      raw?.stateLevel,
      state?.state_level,
      state?.stateLevel
    )
  );
}