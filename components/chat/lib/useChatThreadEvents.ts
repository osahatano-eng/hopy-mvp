// /components/chat/lib/useChatThreadEvents.ts
"use client";

import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lang, Thread, ChatMsg } from "./chatTypes";
import { deleteThread as deleteThreadApi } from "./threadApi";
import { clearActiveThreadId, saveActiveThreadId } from "./threadStore";
import { dedupeThreadsById, normalizeThreadCandidate, sortThreadsPreferUpdatedAtDesc } from "./threadUtils";

type Params = {
  supabase: SupabaseClient;
  uiLang: Lang;
  loggedInRef: React.MutableRefObject<boolean>;
  threads: Thread[];
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
  activeThreadIdRef: React.MutableRefObject<string | null>;
  setActiveThreadId: React.Dispatch<React.SetStateAction<string | null>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  setThreadBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setUserStateErr: React.Dispatch<React.SetStateAction<string | null>>;
  noteThreadDecision: (tid: string, reason: string) => void;
};

function isUuidLikeThreadId(value: string) {
  const v = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function hasThreadId(list: Thread[] | null | undefined, id: string) {
  const tid = String(id ?? "").trim();
  if (!tid) return false;
  const arr = Array.isArray(list) ? list : [];
  return arr.some((t) => String((t as any)?.id ?? "").trim() === tid);
}

function readStateLike(source: any) {
  if (!source || typeof source !== "object") return null;

  const candidates = [
    source?.assistant_state,
    source?.assistantState,
    source?.reply_state,
    source?.replyState,
    source?.state,
    source?.hopy_state,
    source?.hopyState,
    source?.memory_state,
    source?.memoryState,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") return candidate;
  }

  return null;
}

function pickDefined(...values: any[]) {
  for (const v of values) {
    if (v !== undefined) return v;
  }
  return undefined;
}

function readNumeric(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readBool(v: unknown): boolean | null {
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

function clampPhase(v: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
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

function clampLevel(v: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
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

function shouldApplyStatePatch(patch: any, targetThreadId: string): boolean {
  const sourceThreadId = String(patch?.threadId ?? patch?.id ?? "").trim();
  if (!sourceThreadId) return false;
  if (!targetThreadId) return false;
  return sourceThreadId === targetThreadId;
}

function mergeThreadPatch(prevThread: Thread, patch: any, titleFallback: string): Thread {
  const prevRaw = prevThread as any;
  const patchRaw = patch as any;

  const next: any = { ...prevRaw };

  const title = String(patchRaw?.title ?? "").trim();
  if (title) {
    next.title = title;
  } else if (!String(next.title ?? "").trim()) {
    next.title = titleFallback;
  }

  const updatedAt = String(
    patchRaw?.updated_at ??
      patchRaw?.updatedAt ??
      patchRaw?.state_updated_at ??
      patchRaw?.stateUpdatedAt ??
      patchRaw?.assistant_state?.updated_at ??
      patchRaw?.assistantState?.updated_at ??
      patchRaw?.state?.updated_at
  ).trim();
  if (updatedAt) next.updated_at = updatedAt;

  const targetThreadId = String(prevRaw?.id ?? "").trim();
  const allowStatePatch = shouldApplyStatePatch(patchRaw, targetThreadId);

  const directFields = [
    "state_level",
    "stateLevel",
    "memory_state_level",
    "memoryStateLevel",
    "assistant_state_level",
    "assistantStateLevel",
    "level",
    "current_phase",
    "currentPhase",
    "phase",
    "state_phase",
    "statePhase",
    "assistant_phase",
    "assistantPhase",
    "memory_phase",
    "memoryPhase",
    "stability_score",
    "stabilityScore",
    "last_trigger",
    "lastTrigger",
    "state_updated_at",
    "stateUpdatedAt",
    "state_changed",
    "stateChanged",
    "phase_changed",
    "phaseChanged",
    "assistant_state_changed",
    "assistantStateChanged",
    "memory_state_changed",
    "memoryStateChanged",
    "changed",
    "prev_phase",
    "prevPhase",
    "previous_phase",
    "previousPhase",
    "state_prev_phase",
    "statePrevPhase",
    "assistant_prev_phase",
    "assistantPrevPhase",
    "memory_prev_phase",
    "memoryPrevPhase",
    "prev_state_level",
    "prevStateLevel",
    "previous_state_level",
    "previousStateLevel",
    "assistant_prev_state_level",
    "assistantPrevStateLevel",
    "memory_prev_state_level",
    "memoryPrevStateLevel",
  ] as const;

  if (allowStatePatch) {
    for (const key of directFields) {
      if (patchRaw?.[key] !== undefined) {
        next[key] = patchRaw[key];
      }
    }
  }

  const prevState = readStateLike(prevRaw);
  const patchState = allowStatePatch ? readStateLike(patchRaw) : null;

  const mergedState = {
    ...(prevState && typeof prevState === "object" ? prevState : {}),
    ...(patchState && typeof patchState === "object" ? patchState : {}),
  } as any;

  const currentPhase = clampPhase(
    pickDefined(
      allowStatePatch ? patchRaw?.current_phase : undefined,
      allowStatePatch ? patchRaw?.currentPhase : undefined,
      allowStatePatch ? patchRaw?.phase : undefined,
      allowStatePatch ? patchRaw?.state_phase : undefined,
      allowStatePatch ? patchRaw?.statePhase : undefined,
      allowStatePatch ? patchRaw?.assistant_phase : undefined,
      allowStatePatch ? patchRaw?.assistantPhase : undefined,
      allowStatePatch ? patchRaw?.memory_phase : undefined,
      allowStatePatch ? patchRaw?.memoryPhase : undefined,
      allowStatePatch ? patchState?.current_phase : undefined,
      allowStatePatch ? patchState?.currentPhase : undefined,
      allowStatePatch ? patchState?.phase : undefined,
      allowStatePatch ? patchState?.state_phase : undefined,
      allowStatePatch ? patchState?.statePhase : undefined,
      allowStatePatch ? patchState?.assistant_phase : undefined,
      allowStatePatch ? patchState?.assistantPhase : undefined,
      prevRaw?.current_phase,
      prevRaw?.currentPhase,
      prevRaw?.phase,
      prevRaw?.state_phase,
      prevRaw?.statePhase,
      prevRaw?.assistant_phase,
      prevRaw?.assistantPhase,
      prevRaw?.memory_phase,
      prevRaw?.memoryPhase,
      prevState?.current_phase,
      prevState?.currentPhase,
      prevState?.phase,
      prevState?.state_phase,
      prevState?.statePhase,
      prevState?.assistant_phase,
      prevState?.assistantPhase,
      prevRaw?.state_level,
      prevRaw?.stateLevel,
      prevRaw?.assistant_state_level,
      prevRaw?.assistantStateLevel,
      prevRaw?.memory_state_level,
      prevRaw?.memoryStateLevel,
      prevRaw?.level,
      prevState?.state_level,
      prevState?.stateLevel,
      prevState?.assistant_state_level,
      prevState?.assistantStateLevel,
      prevState?.memory_state_level,
      prevState?.memoryStateLevel,
      prevState?.level
    )
  );

  const stateLevel = clampLevel(
    pickDefined(
      allowStatePatch ? patchRaw?.state_level : undefined,
      allowStatePatch ? patchRaw?.stateLevel : undefined,
      allowStatePatch ? patchRaw?.assistant_state_level : undefined,
      allowStatePatch ? patchRaw?.assistantStateLevel : undefined,
      allowStatePatch ? patchRaw?.memory_state_level : undefined,
      allowStatePatch ? patchRaw?.memoryStateLevel : undefined,
      allowStatePatch ? patchRaw?.level : undefined,
      allowStatePatch ? patchState?.state_level : undefined,
      allowStatePatch ? patchState?.stateLevel : undefined,
      allowStatePatch ? patchState?.assistant_state_level : undefined,
      allowStatePatch ? patchState?.assistantStateLevel : undefined,
      allowStatePatch ? patchState?.memory_state_level : undefined,
      allowStatePatch ? patchState?.memoryStateLevel : undefined,
      allowStatePatch ? patchState?.level : undefined,
      currentPhase,
      prevRaw?.state_level,
      prevRaw?.stateLevel,
      prevRaw?.assistant_state_level,
      prevRaw?.assistantStateLevel,
      prevRaw?.memory_state_level,
      prevRaw?.memoryStateLevel,
      prevRaw?.level,
      prevState?.state_level,
      prevState?.stateLevel,
      prevState?.assistant_state_level,
      prevState?.assistantStateLevel,
      prevState?.memory_state_level,
      prevState?.memoryStateLevel,
      prevState?.level
    )
  );

  const prevPhase = clampPhase(
    pickDefined(
      allowStatePatch ? patchRaw?.prev_phase : undefined,
      allowStatePatch ? patchRaw?.prevPhase : undefined,
      allowStatePatch ? patchRaw?.previous_phase : undefined,
      allowStatePatch ? patchRaw?.previousPhase : undefined,
      allowStatePatch ? patchRaw?.state_prev_phase : undefined,
      allowStatePatch ? patchRaw?.statePrevPhase : undefined,
      allowStatePatch ? patchRaw?.assistant_prev_phase : undefined,
      allowStatePatch ? patchRaw?.assistantPrevPhase : undefined,
      allowStatePatch ? patchRaw?.memory_prev_phase : undefined,
      allowStatePatch ? patchRaw?.memoryPrevPhase : undefined,
      allowStatePatch ? patchState?.prev_phase : undefined,
      allowStatePatch ? patchState?.prevPhase : undefined,
      allowStatePatch ? patchState?.previous_phase : undefined,
      allowStatePatch ? patchState?.previousPhase : undefined,
      allowStatePatch ? patchState?.assistant_prev_phase : undefined,
      allowStatePatch ? patchState?.assistantPrevPhase : undefined,
      prevRaw?.prev_phase,
      prevRaw?.prevPhase,
      prevRaw?.previous_phase,
      prevRaw?.previousPhase,
      prevRaw?.state_prev_phase,
      prevRaw?.statePrevPhase,
      prevRaw?.assistant_prev_phase,
      prevRaw?.assistantPrevPhase,
      prevRaw?.memory_prev_phase,
      prevRaw?.memoryPrevPhase,
      prevState?.prev_phase,
      prevState?.prevPhase,
      prevState?.previous_phase,
      prevState?.previousPhase,
      prevState?.assistant_prev_phase,
      prevState?.assistantPrevPhase,
      prevRaw?.prev_state_level,
      prevRaw?.prevStateLevel,
      prevRaw?.assistant_prev_state_level,
      prevRaw?.assistantPrevStateLevel,
      prevRaw?.memory_prev_state_level,
      prevRaw?.memoryPrevStateLevel,
      prevState?.prev_state_level,
      prevState?.prevStateLevel,
      prevState?.assistant_prev_state_level,
      prevState?.assistantPrevStateLevel
    )
  );

  const prevStateLevel = clampLevel(
    pickDefined(
      allowStatePatch ? patchRaw?.prev_state_level : undefined,
      allowStatePatch ? patchRaw?.prevStateLevel : undefined,
      allowStatePatch ? patchRaw?.previous_state_level : undefined,
      allowStatePatch ? patchRaw?.previousStateLevel : undefined,
      allowStatePatch ? patchRaw?.assistant_prev_state_level : undefined,
      allowStatePatch ? patchRaw?.assistantPrevStateLevel : undefined,
      allowStatePatch ? patchRaw?.memory_prev_state_level : undefined,
      allowStatePatch ? patchRaw?.memoryPrevStateLevel : undefined,
      allowStatePatch ? patchState?.prev_state_level : undefined,
      allowStatePatch ? patchState?.prevStateLevel : undefined,
      allowStatePatch ? patchState?.previous_state_level : undefined,
      allowStatePatch ? patchState?.previousStateLevel : undefined,
      allowStatePatch ? patchState?.assistant_prev_state_level : undefined,
      allowStatePatch ? patchState?.assistantPrevStateLevel : undefined,
      prevPhase,
      prevRaw?.prev_state_level,
      prevRaw?.prevStateLevel,
      prevRaw?.previous_state_level,
      prevRaw?.previousStateLevel,
      prevRaw?.assistant_prev_state_level,
      prevRaw?.assistantPrevStateLevel,
      prevRaw?.memory_prev_state_level,
      prevRaw?.memoryPrevStateLevel,
      prevState?.prev_state_level,
      prevState?.prevStateLevel,
      prevState?.previous_state_level,
      prevState?.previousStateLevel,
      prevState?.assistant_prev_state_level,
      prevState?.assistantPrevStateLevel
    )
  );

  const stateChanged = (() => {
    const picked = pickDefined(
      allowStatePatch ? patchRaw?.state_changed : undefined,
      allowStatePatch ? patchRaw?.stateChanged : undefined,
      allowStatePatch ? patchRaw?.phase_changed : undefined,
      allowStatePatch ? patchRaw?.phaseChanged : undefined,
      allowStatePatch ? patchRaw?.assistant_state_changed : undefined,
      allowStatePatch ? patchRaw?.assistantStateChanged : undefined,
      allowStatePatch ? patchRaw?.memory_state_changed : undefined,
      allowStatePatch ? patchRaw?.memoryStateChanged : undefined,
      allowStatePatch ? patchRaw?.changed : undefined,
      allowStatePatch ? patchState?.state_changed : undefined,
      allowStatePatch ? patchState?.stateChanged : undefined,
      allowStatePatch ? patchState?.phase_changed : undefined,
      allowStatePatch ? patchState?.phaseChanged : undefined,
      allowStatePatch ? patchState?.assistant_state_changed : undefined,
      allowStatePatch ? patchState?.assistantStateChanged : undefined,
      allowStatePatch ? patchState?.changed : undefined,
      prevRaw?.state_changed,
      prevRaw?.stateChanged,
      prevRaw?.phase_changed,
      prevRaw?.phaseChanged,
      prevRaw?.assistant_state_changed,
      prevRaw?.assistantStateChanged,
      prevState?.state_changed,
      prevState?.stateChanged,
      prevState?.phase_changed,
      prevState?.phaseChanged,
      prevState?.assistant_state_changed,
      prevState?.assistantStateChanged
    );
    const parsed = readBool(picked);
    if (parsed != null) return parsed;
    if (currentPhase !== undefined && prevPhase !== undefined) return currentPhase !== prevPhase;
    return undefined;
  })();

  const stabilityScore = readNumeric(
    pickDefined(
      allowStatePatch ? patchRaw?.stability_score : undefined,
      allowStatePatch ? patchRaw?.stabilityScore : undefined,
      allowStatePatch ? patchState?.stability_score : undefined,
      allowStatePatch ? patchState?.stabilityScore : undefined,
      prevRaw?.stability_score,
      prevRaw?.stabilityScore,
      prevState?.stability_score,
      prevState?.stabilityScore
    )
  );

  const lastTrigger = pickDefined(
    allowStatePatch ? patchRaw?.last_trigger : undefined,
    allowStatePatch ? patchRaw?.lastTrigger : undefined,
    allowStatePatch ? patchState?.last_trigger : undefined,
    allowStatePatch ? patchState?.lastTrigger : undefined,
    prevRaw?.last_trigger,
    prevRaw?.lastTrigger,
    prevState?.last_trigger,
    prevState?.lastTrigger
  );

  const stateUpdatedAt = String(
    pickDefined(
      allowStatePatch ? patchRaw?.state_updated_at : undefined,
      allowStatePatch ? patchRaw?.stateUpdatedAt : undefined,
      allowStatePatch ? patchState?.updated_at : undefined,
      allowStatePatch ? patchState?.state_updated_at : undefined,
      allowStatePatch ? patchState?.stateUpdatedAt : undefined,
      prevRaw?.state_updated_at,
      prevRaw?.stateUpdatedAt,
      prevState?.updated_at,
      prevState?.state_updated_at,
      prevState?.stateUpdatedAt
    ) ?? ""
  ).trim();

  if (currentPhase !== undefined) {
    mergedState.current_phase = currentPhase;
    mergedState.currentPhase = currentPhase;
    mergedState.phase = currentPhase;
    mergedState.state_phase = currentPhase;
    mergedState.statePhase = currentPhase;
    next.current_phase = currentPhase;
    next.currentPhase = currentPhase;
    next.phase = currentPhase;
    next.state_phase = currentPhase;
    next.statePhase = currentPhase;
    next.assistant_phase = currentPhase;
    next.assistantPhase = currentPhase;
    next.memory_phase = currentPhase;
    next.memoryPhase = currentPhase;
  }

  if (stateLevel !== undefined) {
    mergedState.state_level = stateLevel;
    mergedState.stateLevel = stateLevel;
    mergedState.level = stateLevel;
    next.state_level = stateLevel;
    next.stateLevel = stateLevel;
    next.assistant_state_level = stateLevel;
    next.assistantStateLevel = stateLevel;
    next.memory_state_level = stateLevel;
    next.memoryStateLevel = stateLevel;
    next.level = stateLevel;
  }

  if (prevPhase !== undefined) {
    mergedState.prev_phase = prevPhase;
    mergedState.prevPhase = prevPhase;
    mergedState.previous_phase = prevPhase;
    mergedState.previousPhase = prevPhase;
    next.prev_phase = prevPhase;
    next.prevPhase = prevPhase;
    next.previous_phase = prevPhase;
    next.previousPhase = prevPhase;
    next.state_prev_phase = prevPhase;
    next.statePrevPhase = prevPhase;
    next.assistant_prev_phase = prevPhase;
    next.assistantPrevPhase = prevPhase;
    next.memory_prev_phase = prevPhase;
    next.memoryPrevPhase = prevPhase;
  }

  if (prevStateLevel !== undefined) {
    mergedState.prev_state_level = prevStateLevel;
    mergedState.prevStateLevel = prevStateLevel;
    mergedState.previous_state_level = prevStateLevel;
    mergedState.previousStateLevel = prevStateLevel;
    next.prev_state_level = prevStateLevel;
    next.prevStateLevel = prevStateLevel;
    next.previous_state_level = prevStateLevel;
    next.previousStateLevel = prevStateLevel;
    next.assistant_prev_state_level = prevStateLevel;
    next.assistantPrevStateLevel = prevStateLevel;
    next.memory_prev_state_level = prevStateLevel;
    next.memoryPrevStateLevel = prevStateLevel;
  }

  if (stateChanged !== undefined) {
    mergedState.state_changed = stateChanged;
    mergedState.stateChanged = stateChanged;
    mergedState.phase_changed = stateChanged;
    mergedState.phaseChanged = stateChanged;
    mergedState.changed = stateChanged;
    next.state_changed = stateChanged;
    next.stateChanged = stateChanged;
    next.phase_changed = stateChanged;
    next.phaseChanged = stateChanged;
    next.assistant_state_changed = stateChanged;
    next.assistantStateChanged = stateChanged;
    next.memory_state_changed = stateChanged;
    next.memoryStateChanged = stateChanged;
    next.changed = stateChanged;
  }

  if (stabilityScore != null) {
    mergedState.stability_score = stabilityScore;
    mergedState.stabilityScore = stabilityScore;
    next.stability_score = stabilityScore;
  }

  if (lastTrigger !== undefined) {
    mergedState.last_trigger = lastTrigger;
    next.last_trigger = lastTrigger;
  }

  if (stateUpdatedAt) {
    mergedState.updated_at = stateUpdatedAt;
    next.state_updated_at = stateUpdatedAt;
  }

  if (Object.keys(mergedState).length > 0) {
    next.state = mergedState;
    next.assistant_state = mergedState;
    next.assistantState = mergedState;
    next.hopy_state = mergedState;
    next.hopyState = mergedState;
    next.memory_state = mergedState;
    next.memoryState = mergedState;
  }

  return next as Thread;
}

export function useChatThreadEvents({
  supabase,
  uiLang,
  loggedInRef,
  threads,
  setThreads,
  activeThreadIdRef,
  setActiveThreadId,
  setMessages,
  setVisibleCount,
  setThreadBusy,
  setUserStateErr,
  noteThreadDecision,
}: Params) {
  const threadsRef = useRef<Thread[]>([]);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  const lastManualSelectRef = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const MANUAL_SELECT_GUARD_MS = 1800;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onWorkspaceClear = (e: any) => {
      try {
        if (!loggedInRef.current) return;

        const d = e?.detail ?? {};
        const reason = String(d.reason ?? "").trim();

        try {
          setMessages([]);
        } catch {}

        try {
          setVisibleCount(200);
        } catch {}

        try {
          setUserStateErr(null);
        } catch {}

        if (reason === "ui:create-thread") {
          try {
            clearActiveThreadId();
          } catch {}

          try {
            activeThreadIdRef.current = null;
          } catch {}

          try {
            setActiveThreadId(null);
          } catch {}
        }
      } catch {}
    };

    window.addEventListener("hopy:workspace-clear", onWorkspaceClear as any);
    return () => {
      window.removeEventListener("hopy:workspace-clear", onWorkspaceClear as any);
    };
  }, [activeThreadIdRef, loggedInRef, setActiveThreadId, setMessages, setUserStateErr, setVisibleCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onSelectThread = (e: any) => {
      try {
        const d = e?.detail ?? {};
        const reason = String(d.reason ?? "").trim();
        const source = String(d.source ?? "").trim().toLowerCase();
        const id = String(d.threadId ?? d.id ?? "").trim();
        if (!id) return;
        if (!isUuidLikeThreadId(id)) return;

        const isManual =
          source === "direct" ||
          reason === "ui" ||
          reason.startsWith("ui:") ||
          reason === "thread-click" ||
          reason === "thread:list:click";

        if (!isManual) return;

        lastManualSelectRef.current = { id, at: Date.now() };
      } catch {}
    };

    window.addEventListener("hopy:select-thread", onSelectThread as any);
    return () => {
      window.removeEventListener("hopy:select-thread", onSelectThread as any);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const titleFallback = uiLang === "en" ? "New chat" : "新規チャット";

    const upsertOne = (prev: Thread[], patch: any) => {
      const cand = normalizeThreadCandidate(patch, titleFallback);
      if (!cand) return prev;

      const id = String((cand as any).id ?? "").trim();
      if (!id || !isUuidLikeThreadId(id)) return prev;

      let found = false;
      let changed = false;

      const next = prev.map((t) => {
        const tid = String((t as any)?.id ?? "").trim();
        if (tid !== id) return t;

        found = true;

        const merged = mergeThreadPatch(t, patch, titleFallback);
        if (JSON.stringify(merged) === JSON.stringify(t)) return t;

        changed = true;
        return merged;
      });

      if (!found) {
        changed = true;
        const base = { id, title: String((cand as any)?.title ?? "").trim() || titleFallback } as Thread;
        return [mergeThreadPatch(base, patch, titleFallback), ...prev];
      }

      return changed ? next : prev;
    };

    const applyListIfProvided = (raw: any): Thread[] | null => {
      const arr = Array.isArray(raw) ? raw : null;
      if (!arr) return null;

      const mapped: Thread[] = [];
      for (const x of arr) {
        const th = normalizeThreadCandidate(x, titleFallback);
        if (!th) continue;

        const id = String((th as any)?.id ?? "").trim();
        if (!id || !isUuidLikeThreadId(id)) continue;

        mapped.push(mergeThreadPatch(th, x, titleFallback));
      }

      return sortThreadsPreferUpdatedAtDesc(dedupeThreadsById(mapped));
    };

    const onThreadsRefresh = (e: any) => {
      try {
        if (!loggedInRef.current) return;

        const d = e?.detail ?? {};
        const reason = String(d.reason ?? "").trim();

        const rawId = String(d.threadId ?? d.id ?? "").trim();
        if (rawId && !isUuidLikeThreadId(rawId)) return;

        const list1 = applyListIfProvided(d.threads);
        const list2 = applyListIfProvided(d.items);
        const list3 = applyListIfProvided(d.list);
        const provided = list1 ?? list2 ?? list3;

        if (provided) {
          const hasActiveThread = Boolean(String(activeThreadIdRef.current ?? "").trim());
          const activeId = String(activeThreadIdRef.current ?? "").trim();
          const hasExistingThreads = Array.isArray(threadsRef.current) && threadsRef.current.length > 0;

          const recentManual = lastManualSelectRef.current;
          const manualId = String(recentManual.id ?? "").trim();
          const withinManualGuard =
            !!manualId && Date.now() - Number(recentManual.at || 0) <= MANUAL_SELECT_GUARD_MS;

          if (provided.length === 0 && (hasActiveThread || hasExistingThreads)) {
            return;
          }

          if (hasExistingThreads || hasActiveThread) {
            const missingActive = activeId ? !hasThreadId(provided, activeId) : false;
            const missingManual = withinManualGuard && manualId ? !hasThreadId(provided, manualId) : false;

            if (missingActive || missingManual) {
              setThreads((prev) => {
                const providedMap = new Map<string, Thread>();
                for (const t of provided) {
                  const id = String((t as any)?.id ?? "").trim();
                  if (!id) continue;
                  providedMap.set(id, t);
                }

                const mergedFromPrev = prev.map((t) => {
                  const id = String((t as any)?.id ?? "").trim();
                  const incoming = providedMap.get(id);
                  if (!incoming) return t;
                  return mergeThreadPatch(t, incoming, titleFallback);
                });

                const prevIds = new Set(
                  mergedFromPrev.map((t) => String((t as any)?.id ?? "").trim()).filter(Boolean)
                );

                const appendedNew = provided.filter((t) => {
                  const id = String((t as any)?.id ?? "").trim();
                  return !!id && !prevIds.has(id);
                });

                return sortThreadsPreferUpdatedAtDesc(dedupeThreadsById([...mergedFromPrev, ...appendedNew]));
              });
              return;
            }
          }

          setThreads((prev) => {
            const providedMap = new Map<string, Thread>();
            for (const t of provided) {
              const id = String((t as any)?.id ?? "").trim();
              if (!id) continue;
              providedMap.set(id, t);
            }

            const mergedFromPrev = (Array.isArray(prev) ? prev : []).map((t) => {
              const id = String((t as any)?.id ?? "").trim();
              const incoming = providedMap.get(id);
              if (!incoming) return t;
              return mergeThreadPatch(t, incoming, titleFallback);
            });

            const prevIds = new Set(
              mergedFromPrev.map((t) => String((t as any)?.id ?? "").trim()).filter(Boolean)
            );

            const appendedNew = provided.filter((t) => {
              const id = String((t as any)?.id ?? "").trim();
              return !!id && !prevIds.has(id);
            });

            return sortThreadsPreferUpdatedAtDesc(dedupeThreadsById([...mergedFromPrev, ...appendedNew]));
          });
          return;
        }

        const id = rawId;
        if (!id) return;

        const deletedFlag =
          Boolean((d as any)?.deleted) ||
          Boolean((d as any)?.isDeleted) ||
          Boolean((d as any)?.removed) ||
          Boolean((d as any)?.isRemoved);
        const isDeleteReason = reason.toLowerCase().includes("delete") || reason.toLowerCase().includes("removed");
        if (deletedFlag || isDeleteReason) {
          setThreads((prev) => prev.filter((t) => String((t as any)?.id ?? "").trim() !== id));
          return;
        }

        const title = String(d.title ?? "").trim();
        const updated_at = String(
          d.updated_at ?? d.updatedAt ?? d.state_updated_at ?? d.stateUpdatedAt ?? ""
        ).trim();

        const prevTitle = String(
          d.prevTitle ??
            d.previousTitle ??
            d.prev ??
            d.prev_title ??
            d.previous_title ??
            d.beforeTitle ??
            d.before_title ??
            ""
        ).trim();

        setThreads((prev) => {
          if (reason.includes("rollback")) {
            if (!prevTitle) return prev;
            return sortThreadsPreferUpdatedAtDesc(
              upsertOne(prev, { ...d, id, title: prevTitle, updated_at: updated_at || "" })
            );
          }

          if (title) {
            return sortThreadsPreferUpdatedAtDesc(upsertOne(prev, { ...d, id, title, updated_at }));
          }

          return sortThreadsPreferUpdatedAtDesc(upsertOne(prev, { ...d, id, updated_at }));
        });
      } catch {}
    };

    window.addEventListener("hopy:threads-refresh", onThreadsRefresh as any);
    return () => {
      window.removeEventListener("hopy:threads-refresh", onThreadsRefresh as any);
    };
  }, [loggedInRef, setThreads, uiLang, activeThreadIdRef]);

  const deleteInflightRef = useRef(false);
  const lastDeleteIdRef = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const DELETE_DEDUPE_MS = 1200;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onDeleteThread = async (e: any) => {
      try {
        if (!loggedInRef.current) return;

        const d = e?.detail ?? {};
        const tid = String(d.threadId ?? d.id ?? "").trim();
        if (!tid) return;
        if (!isUuidLikeThreadId(tid)) return;

        const now = Date.now();
        const prev = lastDeleteIdRef.current;
        if (prev.id === tid && now - (prev.at || 0) <= DELETE_DEDUPE_MS) return;
        lastDeleteIdRef.current = { id: tid, at: now };

        if (deleteInflightRef.current) return;
        deleteInflightRef.current = true;

        setThreadBusy(true);

        const wasActive = String(activeThreadIdRef.current ?? "").trim() === tid;
        const removedThread = threadsRef.current.find((t) => String((t as any)?.id ?? "").trim() === tid) ?? null;
        const remainingAfterRemove = threadsRef.current.filter((t) => String((t as any)?.id ?? "").trim() !== tid);
        const nextIdCandidate = String((remainingAfterRemove[0] as any)?.id ?? "").trim() || null;

        setThreads((prevThreads) => prevThreads.filter((t) => String((t as any)?.id ?? "").trim() !== tid));

        if (wasActive) {
          try {
            clearActiveThreadId();
          } catch {}
          try {
            setActiveThreadId(null);
          } catch {}
          try {
            activeThreadIdRef.current = null;
          } catch {}
          try {
            setMessages([]);
          } catch {}
          try {
            setVisibleCount(200);
          } catch {}
        }

        const r = await deleteThreadApi({ supabase, threadId: tid } as any);
        if (!r?.ok) {
          const msg = String((r as any)?.error ?? "thread_delete_failed").trim();
          setUserStateErr(msg || "thread_delete_failed");

          if (removedThread) {
            setThreads((prevThreads) => {
              const exists = prevThreads.some((t) => String((t as any)?.id ?? "").trim() === tid);
              if (exists) return prevThreads;
              return sortThreadsPreferUpdatedAtDesc([removedThread, ...prevThreads]);
            });
          }

          if (wasActive) {
            try {
              const backId = String((removedThread as any)?.id ?? "").trim();
              if (backId) {
                saveActiveThreadId(backId);
                activeThreadIdRef.current = backId;
                noteThreadDecision(backId, "delete:rollback:setActiveThreadId");
                setActiveThreadId(backId);
              }
            } catch {}
          }
          return;
        }

        if (wasActive && nextIdCandidate) {
          try {
            saveActiveThreadId(nextIdCandidate);
          } catch {}
          try {
            activeThreadIdRef.current = nextIdCandidate;
          } catch {}
          try {
            noteThreadDecision(nextIdCandidate, "delete:confirmed:setActiveThreadId");
          } catch {}
          try {
            setActiveThreadId(nextIdCandidate);
          } catch {}
        }

        try {
          window.dispatchEvent(
            new CustomEvent("hopy:threads-refresh", {
              detail: { reason: "delete:confirmed", threadId: tid, id: tid, source: "event" },
            })
          );
        } catch {}
      } catch (err: any) {
        const msg = String(err?.message ?? err ?? "thread_delete_failed").trim();
        setUserStateErr(msg || "thread_delete_failed");
      } finally {
        deleteInflightRef.current = false;
        try {
          setThreadBusy(false);
        } catch {}
      }
    };

    window.addEventListener("hopy:delete-thread", onDeleteThread as any);
    return () => {
      window.removeEventListener("hopy:delete-thread", onDeleteThread as any);
    };
  }, [
    activeThreadIdRef,
    loggedInRef,
    noteThreadDecision,
    setActiveThreadId,
    setMessages,
    setThreadBusy,
    setThreads,
    setUserStateErr,
    setVisibleCount,
    supabase,
  ]);
}