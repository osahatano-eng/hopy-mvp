// /components/chat/view/chatStreamAssistantState.tsx
"use client";

import React from "react";

import type { Lang } from "../lib/chatTypes";
import type { ChatMsg } from "../lib/chatTypes";
import { getHopyStateVisual } from "../lib/stateBadge";

export type AssistantDotMeta = {
  show: boolean;
  changed: boolean;
  phase: 1 | 2 | 3 | 4 | 5;
  label: string;
  dotToken: "phase1" | "phase2" | "phase3" | "phase4" | "phase5";
  dotColor: string;
};

function stateDotColor(token: AssistantDotMeta["dotToken"]) {
  if (token === "phase1") return "var(--hopy-state-phase1, #8f3b3b)";
  if (token === "phase2") return "var(--hopy-state-phase2, #9a6a2f)";
  if (token === "phase3") return "var(--hopy-state-phase3, #8a8f36)";
  if (token === "phase4") return "var(--hopy-state-phase4, #2f7a59)";
  return "var(--hopy-state-phase5, #2f5f8f)";
}

function resolveVisualDotColor(
  visual: ReturnType<typeof getHopyStateVisual>,
  fallbackToken: AssistantDotMeta["dotToken"],
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

function clampPhase(v: number): 1 | 2 | 3 | 4 | 5 {
  if (!Number.isFinite(v)) return 1;
  const n = Math.round(v);
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  if (n === 4) return 4;
  return 5;
}

function readLevelCandidate(v: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const n = readNumeric(v);
  if (n == null) return null;
  if (n >= 1 && n <= 5) return clampPhase(n);
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function phaseToDotToken(
  phase: 1 | 2 | 3 | 4 | 5,
): AssistantDotMeta["dotToken"] {
  if (phase === 1) return "phase1";
  if (phase === 2) return "phase2";
  if (phase === 3) return "phase3";
  if (phase === 4) return "phase4";
  return "phase5";
}

function readConfirmedState(
  msg: ChatMsg,
): {
  current_phase: 1 | 2 | 3 | 4 | 5;
  state_level: 1 | 2 | 3 | 4 | 5;
  prev_phase?: 1 | 2 | 3 | 4 | 5;
  prev_state_level?: 1 | 2 | 3 | 4 | 5;
  state_changed: boolean;
  label?: string;
  prev_label?: string;
} | null {
  const raw = (msg ?? {}) as Record<string, unknown>;
  const confirmedPayload = asRecord(raw?.hopy_confirmed_payload);
  const confirmedState = asRecord(confirmedPayload?.state);
  if (!confirmedState) return null;

  const currentPhase =
    readLevelCandidate(confirmedState.current_phase) ??
    readLevelCandidate(confirmedState.state_level);
  const stateLevel =
    readLevelCandidate(confirmedState.state_level) ??
    readLevelCandidate(confirmedState.current_phase);
  const prevPhase = readLevelCandidate(confirmedState.prev_phase);
  const prevStateLevel = readLevelCandidate(confirmedState.prev_state_level);
  const stateChanged = readBool(confirmedState.state_changed);

  if (currentPhase == null || stateLevel == null || stateChanged == null) {
    return null;
  }

  const label =
    typeof confirmedState.label === "string" && confirmedState.label.trim()
      ? confirmedState.label.trim()
      : undefined;

  const prevLabel =
    typeof confirmedState.prev_label === "string" &&
    confirmedState.prev_label.trim()
      ? confirmedState.prev_label.trim()
      : undefined;

  return {
    current_phase: currentPhase,
    state_level: stateLevel,
    ...(prevPhase != null ? { prev_phase: prevPhase } : {}),
    ...(prevStateLevel != null ? { prev_state_level: prevStateLevel } : {}),
    state_changed: stateChanged,
    ...(label ? { label } : {}),
    ...(prevLabel ? { prev_label: prevLabel } : {}),
  };
}

export function resolveAssistantDotMeta(
  msg: ChatMsg,
  uiLang: Lang,
): AssistantDotMeta | null {
  const raw = (msg ?? {}) as Record<string, unknown>;
  const role = String(raw?.role ?? "");
  if (role !== "assistant") return null;

  const confirmedState = readConfirmedState(msg);
  if (!confirmedState) return null;

  const finalChanged = confirmedState.state_changed === true;
  const phase = confirmedState.current_phase;
  const dotToken = phaseToDotToken(phase);

  const visual = getHopyStateVisual({
    state: confirmedState as any,
    level: phase,
    uiLang,
  });

  const visualShortLabel =
    typeof (visual as any)?.shortLabel === "string" &&
    String((visual as any).shortLabel).trim()
      ? String((visual as any).shortLabel).trim()
      : "";

  const finalLabel = confirmedState.label ?? visualShortLabel;

  return {
    show: finalChanged,
    changed: finalChanged,
    phase,
    label: finalLabel,
    dotToken,
    dotColor: resolveVisualDotColor(visual, dotToken),
  };
}

export function AssistantStateDot(props: { meta: AssistantDotMeta }) {
  const { meta } = props;

  return (
    <span
      aria-label={`HOPY state: ${meta.label}`}
      title={meta.label}
      style={{
        width: 10,
        height: 10,
        minWidth: 10,
        minHeight: 10,
        borderRadius: "999px",
        display: "inline-block",
        backgroundColor: meta.dotColor,
        opacity: 1,
        flexShrink: 0,
      }}
    />
  );
}

/*
このファイルの正式役割
assistant message から HOPY○ 表示用の AssistantDotMeta を作るファイル。
唯一の正である hopy_confirmed_payload.state だけを受け取り、そのまま表示可否へ使う。
phase / label / dotColor は見た目用に整えるが、
changed 判定そのものは独自再計算しない。
*/

/*
【今回このファイルで修正したこと】
- readConfirmedState(...) で prev_phase / prev_state_level を必須扱いしないように修正しました。
- HOPY○ の表示可否は、current_phase / state_level / state_changed が取れている限り、唯一の正である confirmedState.state_changed をそのまま通す形に戻しました。
- current_phase / state_level は片方しか来ない回でも相互補完して読めるようにし、このファイル内で不要な欠落落ちを止めました。
- changed の再判定や本文からの推測は追加していません。
*/

/* /components/chat/view/chatStreamAssistantState.tsx */