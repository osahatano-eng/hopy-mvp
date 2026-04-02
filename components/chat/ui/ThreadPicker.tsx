// /components/chat/ui/ThreadPicker.tsx
"use client";

import React, { useMemo } from "react";
import styles from "./ThreadPicker.module.css";
import { getHopyStateVisual, normalizeHopyState } from "../lib/stateBadge";

type UiLang = "ja" | "en";

export type Thread = {
  id: string;
  title?: string | null;
  updated_at?: string | null;

  current_phase?: number | null;
  currentPhase?: number | null;
  phase?: number | null;
  state_phase?: number | null;
  statePhase?: number | null;

  state_level?: number | null;
  stateLevel?: number | null;
  memory_state_level?: number | null;
  memoryStateLevel?: number | null;

  state?: unknown;
  hopy_state?: unknown;
  hopyState?: unknown;
};

function cleanTitle(s: any) {
  const t = String(s ?? "").trim();
  return t.length > 0 ? t : "";
}

function readNumeric(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clampPhase(v: number): 1 | 2 | 3 | 4 | 5 {
  if (!Number.isFinite(v)) return 1;
  const n = Math.round(v);
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  if (n === 4) return 4;
  return 5;
}

function readPhaseCandidate(v: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const n = readNumeric(v);
  if (n == null) return null;
  if (n >= 1 && n <= 5) return clampPhase(n);
  return null;
}

function readLevelCandidate(v: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const n = readNumeric(v);
  if (n == null) return null;
  if (n >= 1 && n <= 5) return clampPhase(n);
  return null;
}

function stateDotColor(token: "phase1" | "phase2" | "phase3" | "phase4" | "phase5") {
  if (token === "phase1") return "var(--hopy-state-phase1, #8f3b3b)";
  if (token === "phase2") return "var(--hopy-state-phase2, #9a6a2f)";
  if (token === "phase3") return "var(--hopy-state-phase3, #8a8f36)";
  if (token === "phase4") return "var(--hopy-state-phase4, #2f7a59)";
  return "var(--hopy-state-phase5, #2f5f8f)";
}

function resolveVisualDotColor(
  visual: ReturnType<typeof getHopyStateVisual>,
  fallbackToken: "phase1" | "phase2" | "phase3" | "phase4" | "phase5"
): string {
  const visualAny = visual as any;

  const candidates = [
    visualAny?.dotColor,
    visualAny?.color,
    visualAny?.accentColor,
    visualAny?.stateColor,
    visualAny?.hex,
  ];

  for (const v of candidates) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }

  return stateDotColor(fallbackToken);
}

function resolveThreadDotColor(thread: Thread, uiLang: UiLang): string | null {
  const normalizedState = normalizeHopyState(thread.state ?? thread.hopy_state ?? thread.hopyState ?? null);

  const phaseCandidates = [
    thread.current_phase,
    thread.currentPhase,
    thread.phase,
    thread.state_phase,
    thread.statePhase,
    (thread.state as any)?.current_phase,
    (thread.state as any)?.currentPhase,
    (thread.state as any)?.phase,
    (thread.state as any)?.state_phase,
    (thread.state as any)?.statePhase,
    (thread.hopy_state as any)?.current_phase,
    (thread.hopy_state as any)?.currentPhase,
    (thread.hopy_state as any)?.phase,
    (thread.hopy_state as any)?.state_phase,
    (thread.hopy_state as any)?.statePhase,
    (thread.hopyState as any)?.current_phase,
    (thread.hopyState as any)?.currentPhase,
    (thread.hopyState as any)?.phase,
    (thread.hopyState as any)?.state_phase,
    (thread.hopyState as any)?.statePhase,
    normalizedState?.current_phase,
  ];

  let phase: 1 | 2 | 3 | 4 | 5 | null = null;
  for (const v of phaseCandidates) {
    const p = readPhaseCandidate(v);
    if (p != null) {
      phase = p;
      break;
    }
  }

  if (phase == null) {
    const levelCandidates = [
      thread.state_level,
      thread.stateLevel,
      thread.memory_state_level,
      thread.memoryStateLevel,
      (thread.state as any)?.state_level,
      (thread.state as any)?.stateLevel,
      (thread.state as any)?.memory_state_level,
      (thread.state as any)?.memoryStateLevel,
      (thread.hopy_state as any)?.state_level,
      (thread.hopy_state as any)?.stateLevel,
      (thread.hopy_state as any)?.memory_state_level,
      (thread.hopy_state as any)?.memoryStateLevel,
      (thread.hopyState as any)?.state_level,
      (thread.hopyState as any)?.stateLevel,
      (thread.hopyState as any)?.memory_state_level,
      (thread.hopyState as any)?.memoryStateLevel,
      normalizedState?.state_level,
      (normalizedState as any)?.level,
    ];

    for (const v of levelCandidates) {
      const level = readLevelCandidate(v);
      if (level != null) {
        phase = level;
        break;
      }
    }
  }

  if (phase == null && !normalizedState) return null;

  const visual = getHopyStateVisual({
    state: normalizedState,
    phase: phase ?? 1,
    uiLang,
  });

  return resolveVisualDotColor(visual, visual.dotToken);
}

export default function ThreadPicker(props: {
  threads: Thread[];
  activeId: string | null;
  uiLang: UiLang;
  onCreate: () => void;
  onSelect: (id: string) => void;
  busy?: boolean;
}) {
  const { threads, activeId, uiLang, onCreate, onSelect, busy = false } = props;

  const newLabel = uiLang === "en" ? "New chat" : "新しいチャット";
  const pillFallback = uiLang === "en" ? "Chat" : "チャット";

  const visibleThreads = useMemo(() => {
    if (!Array.isArray(threads) || threads.length === 0) return [];

    const withTitle = threads.filter((t) => cleanTitle(t?.title).length > 0);

    if (activeId) {
      const active = threads.find((t) => t?.id === activeId);
      const activeHasTitle = cleanTitle(active?.title).length > 0;

      if (!activeHasTitle && active) {
        const exists = withTitle.some((x) => x.id === active.id);
        if (!exists) return [...withTitle, active];
      }
    }
    return withTitle;
  }, [threads, activeId]);

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        onClick={onCreate}
        className={styles.newBtn}
        disabled={busy}
        aria-disabled={busy}
        aria-label={newLabel}
        title={newLabel}
      >
        +
      </button>

      {visibleThreads.length > 0 ? (
        <div className={styles.list} aria-label="threads">
          {visibleThreads.map((t) => {
            const isActive = !!activeId && t.id === activeId;
            const title = cleanTitle(t.title);
            const label = title || pillFallback;
            const dotColor = isActive ? resolveThreadDotColor(t, uiLang) : null;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t.id)}
                className={`${styles.pill} ${isActive ? styles.pillActive : ""}`}
                title={label}
                style={
                  isActive
                    ? {
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }
                    : undefined
                }
              >
                {isActive && dotColor ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      minWidth: 8,
                      minHeight: 8,
                      borderRadius: "999px",
                      display: "inline-block",
                      backgroundColor: dotColor,
                      flexShrink: 0,
                    }}
                  />
                ) : null}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}