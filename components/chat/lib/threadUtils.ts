// /components/chat/lib/threadUtils.ts
"use client";

import type { Thread } from "./chatTypes";

function toFinitePhase(v: unknown): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.trunc(n);
  if (i < 1 || i > 5) return undefined;
  return i;
}

function toBooleanOrUndefined(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function pickFirstString(...values: unknown[]): string | undefined {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return undefined;
}

function pickFirstPhase(...values: unknown[]): number | undefined {
  for (const v of values) {
    const p = toFinitePhase(v);
    if (p !== undefined) return p;
  }
  return undefined;
}

function pickFirstBoolean(...values: unknown[]): boolean | undefined {
  for (const v of values) {
    const b = toBooleanOrUndefined(v);
    if (b !== undefined) return b;
  }
  return undefined;
}

export function sortThreadsPreferUpdatedAtDesc(list: Thread[]): Thread[] {
  const hasAny = list.some((t) => Boolean(String((t as any)?.updated_at ?? "").trim()));
  if (!hasAny) return list;

  const copy = [...list];
  copy.sort((a: any, b: any) => {
    const ax = String(a?.updated_at ?? "").trim();
    const bx = String(b?.updated_at ?? "").trim();
    const at = ax ? Date.parse(ax) : 0;
    const bt = bx ? Date.parse(bx) : 0;
    return bt - at;
  });
  return copy;
}

export function normalizeThreadCandidate(x: any, titleFallback: string): Thread | null {
  try {
    const id = String(x?.id ?? x?.threadId ?? "").trim();
    if (!id) return null;

    const titleRaw = String(x?.title ?? "").trim();
    const title = titleRaw || titleFallback;

    const updated_at = pickFirstString(x?.updated_at, x?.state_updated_at, x?.assistant_state?.updated_at, x?.state?.updated_at);

    const out: any = { id, title };

    if (updated_at) out.updated_at = updated_at;

    const currentPhase = pickFirstPhase(
      x?.current_phase,
      x?.currentPhase,
      x?.phase,
      x?.state_phase,
      x?.statePhase,
      x?.assistant_phase,
      x?.assistantPhase,
      x?.assistant_state?.current_phase,
      x?.assistantState?.current_phase,
      x?.state?.current_phase,
      x?.hopy_state?.current_phase,
      x?.hopyState?.current_phase,
      x?.memory_state?.current_phase,
      x?.memoryState?.current_phase,
      x?.state_level,
      x?.stateLevel,
      x?.level
    );
    if (currentPhase !== undefined) {
      out.current_phase = currentPhase;
      out.state_level = currentPhase;
    }

    const prevPhase = pickFirstPhase(
      x?.prev_phase,
      x?.prevPhase,
      x?.previous_phase,
      x?.previousPhase,
      x?.state_prev_phase,
      x?.statePrevPhase,
      x?.assistant_prev_phase,
      x?.assistantPrevPhase,
      x?.assistant_state?.prev_phase,
      x?.assistantState?.prev_phase,
      x?.state?.prev_phase,
      x?.hopy_state?.prev_phase,
      x?.hopyState?.prev_phase,
      x?.memory_state?.prev_phase,
      x?.memoryState?.prev_phase,
      x?.prev_state_level,
      x?.prevStateLevel
    );
    if (prevPhase !== undefined) {
      out.prev_phase = prevPhase;
      out.prev_state_level = prevPhase;
    }

    const stateChanged = pickFirstBoolean(
      x?.state_changed,
      x?.stateChanged,
      x?.phase_changed,
      x?.phaseChanged,
      x?.changed,
      x?.assistant_state_changed,
      x?.assistantStateChanged,
      x?.assistant_state?.state_changed,
      x?.assistantState?.state_changed,
      x?.state?.state_changed,
      x?.hopy_state?.state_changed,
      x?.hopyState?.state_changed,
      x?.memory_state?.state_changed,
      x?.memoryState?.state_changed
    );
    if (stateChanged !== undefined) out.state_changed = stateChanged;

    const stabilityScore = Number(
      x?.stability_score ??
        x?.stabilityScore ??
        x?.assistant_state?.stability_score ??
        x?.assistantState?.stability_score ??
        x?.state?.stability_score ??
        x?.hopy_state?.stability_score ??
        x?.hopyState?.stability_score
    );
    if (Number.isFinite(stabilityScore)) out.stability_score = stabilityScore;

    const lastTrigger = pickFirstString(
      x?.last_trigger,
      x?.assistant_state?.last_trigger,
      x?.assistantState?.last_trigger,
      x?.state?.last_trigger,
      x?.hopy_state?.last_trigger,
      x?.hopyState?.last_trigger
    );
    if (lastTrigger) out.last_trigger = lastTrigger;

    if (x?.state != null) out.state = x.state;
    if (x?.assistant_state != null) out.assistant_state = x.assistant_state;
    if (x?.assistantState != null) out.assistantState = x.assistantState;
    if (x?.reply_state != null) out.reply_state = x.reply_state;
    if (x?.replyState != null) out.replyState = x.replyState;
    if (x?.hopy_state != null) out.hopy_state = x.hopy_state;
    if (x?.hopyState != null) out.hopyState = x.hopyState;
    if (x?.memory_state != null) out.memory_state = x.memory_state;
    if (x?.memoryState != null) out.memoryState = x.memoryState;

    return out as Thread;
  } catch {
    return null;
  }
}

export function dedupeThreadsById(list: Thread[]): Thread[] {
  const seen = new Set<string>();
  const out: Thread[] = [];

  for (const t of Array.isArray(list) ? list : []) {
    const id = String((t as any)?.id ?? "").trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(t);
  }
  return out;
}