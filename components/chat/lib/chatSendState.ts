// /components/chat/lib/chatSendState.ts
import type { ChatMsg } from "./chatTypes";

export type ApiThread = {
  id: string;
  title: string;
};

type ConfirmedStatePayload = {
  state_level?: unknown;
  current_phase?: unknown;
  prev_state_level?: unknown;
  prev_phase?: unknown;
  state_changed?: unknown;
};

type ConfirmedThreadSummaryPayload = {
  thread_id?: unknown;
  latest_reply_id?: unknown;
  latest_reply_at?: unknown;
  latest_confirmed_state?: ConfirmedStatePayload | null;
  title?: unknown;
  next_title?: unknown;
  title_updated?: unknown;
};

type ConfirmedMeaningPayload = {
  reply?: unknown;
  state?: ConfirmedStatePayload | null;
  thread_summary?: ConfirmedThreadSummaryPayload | null;
  memory_candidates?: unknown;
  dashboard_signals?: unknown;
  notification_signal?: unknown;
  ui_effects?: unknown;
};

function pickConfirmedPayload(payload: any): ConfirmedMeaningPayload | null {
  try {
    const confirmed = payload?.hopy_confirmed_payload;
    if (confirmed && typeof confirmed === "object") return confirmed as ConfirmedMeaningPayload;
  } catch {}
  return null;
}

function pickConfirmedState(payload: any): ConfirmedStatePayload | null {
  try {
    const confirmed = pickConfirmedPayload(payload);
    const state = confirmed?.state;
    if (state && typeof state === "object") return state;
  } catch {}
  return null;
}

function pickConfirmedThreadSummary(payload: any): ConfirmedThreadSummaryPayload | null {
  try {
    const confirmed = pickConfirmedPayload(payload);
    const summary = confirmed?.thread_summary;
    if (summary && typeof summary === "object") return summary;
  } catch {}
  return null;
}

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

export function clampPhase(v: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const n = readNumeric(v);
  if (n == null) return null;
  const r = Math.round(n);
  if (r <= 1) return 1;
  if (r === 2) return 2;
  if (r === 3) return 3;
  if (r === 4) return 4;
  return 5;
}

export function clampLevel(v: unknown): 1 | 2 | 3 | 4 | 5 | null {
  return clampPhase(v);
}

function isCanonicalPhaseLike(v: unknown): v is 1 | 2 | 3 | 4 | 5 | null {
  return v == null || v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
}

function isCanonicalStateChanged(v: unknown): v is boolean | null {
  return v == null || typeof v === "boolean";
}

function isAlreadyNormalizedAssistantState(src: any): boolean {
  if (!src || typeof src !== "object") return false;

  return (
    Object.prototype.hasOwnProperty.call(src, "current_phase") &&
    Object.prototype.hasOwnProperty.call(src, "state_level") &&
    Object.prototype.hasOwnProperty.call(src, "prev_phase") &&
    Object.prototype.hasOwnProperty.call(src, "prev_state_level") &&
    Object.prototype.hasOwnProperty.call(src, "state_changed") &&
    isCanonicalPhaseLike(src.current_phase) &&
    isCanonicalPhaseLike(src.state_level) &&
    isCanonicalPhaseLike(src.prev_phase) &&
    isCanonicalPhaseLike(src.prev_state_level) &&
    isCanonicalStateChanged(src.state_changed)
  );
}

export function pickAssistantStateSource(payload: any): any {
  try {
    const confirmedState = pickConfirmedState(payload);
    if (confirmedState && typeof confirmedState === "object") return confirmedState;

    if (payload && typeof payload === "object") {
      if (payload.assistant_state && typeof payload.assistant_state === "object") return payload.assistant_state;
      if (payload.assistantState && typeof payload.assistantState === "object") return payload.assistantState;
      if (payload.state && typeof payload.state === "object") return payload.state;
    }
  } catch {}
  return null;
}

export function normalizeAssistantStatePayload(payload: any): any {
  const src = pickAssistantStateSource(payload);
  if (!src || typeof src !== "object") return null;

  if (isAlreadyNormalizedAssistantState(src)) {
    return src;
  }

  const confirmedState = pickConfirmedState(payload);

  const currentPhase = clampPhase(
    src?.current_phase ??
      src?.currentPhase ??
      src?.phase ??
      confirmedState?.current_phase ??
      payload?.current_phase ??
      payload?.currentPhase
  );

  const stateLevel = clampLevel(
    src?.state_level ??
      src?.stateLevel ??
      src?.level ??
      confirmedState?.state_level ??
      payload?.state_level ??
      payload?.stateLevel ??
      currentPhase
  );

  const prevPhase = clampPhase(
    src?.prev_phase ??
      src?.prevPhase ??
      src?.previous_phase ??
      src?.previousPhase ??
      confirmedState?.prev_phase ??
      payload?.prev_phase ??
      payload?.prevPhase
  );

  const prevStateLevel = clampLevel(
    src?.prev_state_level ??
      src?.prevStateLevel ??
      src?.previous_state_level ??
      src?.previousStateLevel ??
      confirmedState?.prev_state_level ??
      payload?.prev_state_level ??
      payload?.prevStateLevel ??
      prevPhase
  );

  const stateChanged = readBool(
    src?.state_changed ??
      src?.stateChanged ??
      src?.changed ??
      confirmedState?.state_changed ??
      payload?.state_changed ??
      payload?.stateChanged ??
      payload?.changed
  );

  return {
    ...src,
    state_level: stateLevel,
    stateLevel: stateLevel,
    level: stateLevel,
    current_phase: currentPhase,
    currentPhase: currentPhase,
    phase: currentPhase,
    prev_phase: prevPhase,
    prevPhase: prevPhase,
    previous_phase: prevPhase,
    previousPhase: prevPhase,
    prev_state_level: prevStateLevel,
    prevStateLevel: prevStateLevel,
    previous_state_level: prevStateLevel,
    previousStateLevel: prevStateLevel,
    state_changed: stateChanged,
    stateChanged: stateChanged,
    changed: stateChanged,
  };
}

export function mergeAssistantStateFields<TState>(msg: ChatMsg, payload: any): ChatMsg {
  const next: any = { ...msg };
  const src = normalizeAssistantStatePayload(payload);

  if (src && typeof src === "object") {
    next.state = src;
    next.hopy_state = src;
    next.hopyState = src;
    next.assistant_state = src;
    next.assistantState = src;
    next.reply_state = src;
    next.replyState = src;

    if (Object.prototype.hasOwnProperty.call(src, "state_level")) {
      next.state_level = src.state_level;
      next.stateLevel = src.state_level;
    }
    if (Object.prototype.hasOwnProperty.call(src, "current_phase")) {
      next.current_phase = src.current_phase;
      next.currentPhase = src.current_phase;
    }
    if (Object.prototype.hasOwnProperty.call(src, "prev_phase")) {
      next.prev_phase = src.prev_phase;
      next.prevPhase = src.prev_phase;
    }
    if (Object.prototype.hasOwnProperty.call(src, "prev_state_level")) {
      next.prev_state_level = src.prev_state_level;
      next.prevStateLevel = src.prev_state_level;
    }
    if (Object.prototype.hasOwnProperty.call(src, "state_changed")) {
      next.state_changed = src.state_changed;
      next.stateChanged = src.state_changed;
      next.changed = src.state_changed;
    }
  }

  return next as ChatMsg;
}

export function pickThreadId(payload: any): string {
  try {
    const confirmedSummary = pickConfirmedThreadSummary(payload);

    const confirmedThreadId = String(confirmedSummary?.thread_id ?? "").trim();
    if (confirmedThreadId) return confirmedThreadId;

    const fromThread = String(payload?.thread?.id ?? "").trim();
    if (fromThread) return fromThread;

    const a = String(payload?.thread_id ?? "").trim();
    if (a) return a;

    const b = String(payload?.conversation_id ?? "").trim();
    if (b) return b;

    const c = String(payload?.conversationId ?? "").trim();
    if (c) return c;
  } catch {}
  return "";
}

export function pickThread(payload: any): ApiThread | null {
  try {
    const confirmedSummary = pickConfirmedThreadSummary(payload);

    const id = String(confirmedSummary?.thread_id ?? "").trim() || String(payload?.thread?.id ?? "").trim() || pickThreadId(payload);
    if (!id) return null;

    const title = String(
      confirmedSummary?.next_title ??
        confirmedSummary?.title ??
        payload?.thread?.title ??
        ""
    ).trim();

    return { id, title };
  } catch {
    return null;
  }
}

/*
このファイルの正式役割
/api/chat の返却 payload から assistant state と thread 情報を読み取り、
チャット画面側で使う正規化済み shape へ整える責務だけを持つ。

【今回このファイルで修正したこと】
state_changed の下流再計算を削除し、
hopy_confirmed_payload.state.state_changed を最優先でそのまま通す形に戻した。
*/