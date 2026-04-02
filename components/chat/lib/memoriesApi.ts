// /components/chat/lib/memoriesApi.ts
import { supabase } from "@/lib/supabaseClient";

type MemoryStateShape = {
  current_phase?: 1 | 2 | 3 | 4 | 5;
  currentPhase?: 1 | 2 | 3 | 4 | 5;
  phase?: 1 | 2 | 3 | 4 | 5;
  state_phase?: 1 | 2 | 3 | 4 | 5;
  statePhase?: 1 | 2 | 3 | 4 | 5;
  memory_phase?: 1 | 2 | 3 | 4 | 5;
  memoryPhase?: 1 | 2 | 3 | 4 | 5;
  assistant_phase?: 1 | 2 | 3 | 4 | 5;
  assistantPhase?: 1 | 2 | 3 | 4 | 5;
  reply_phase?: 1 | 2 | 3 | 4 | 5;
  replyPhase?: 1 | 2 | 3 | 4 | 5;

  prev_phase?: 1 | 2 | 3 | 4 | 5;
  prevPhase?: 1 | 2 | 3 | 4 | 5;
  previous_phase?: 1 | 2 | 3 | 4 | 5;
  previousPhase?: 1 | 2 | 3 | 4 | 5;
  memory_prev_phase?: 1 | 2 | 3 | 4 | 5;
  memoryPrevPhase?: 1 | 2 | 3 | 4 | 5;
  assistant_prev_phase?: 1 | 2 | 3 | 4 | 5;
  assistantPrevPhase?: 1 | 2 | 3 | 4 | 5;
  reply_prev_phase?: 1 | 2 | 3 | 4 | 5;
  replyPrevPhase?: 1 | 2 | 3 | 4 | 5;

  state_level?: 1 | 2 | 3 | 4 | 5;
  stateLevel?: 1 | 2 | 3 | 4 | 5;
  memory_state_level?: 1 | 2 | 3 | 4 | 5;
  memoryStateLevel?: 1 | 2 | 3 | 4 | 5;
  assistant_state_level?: 1 | 2 | 3 | 4 | 5;
  assistantStateLevel?: 1 | 2 | 3 | 4 | 5;
  reply_state_level?: 1 | 2 | 3 | 4 | 5;
  replyStateLevel?: 1 | 2 | 3 | 4 | 5;
  level?: 1 | 2 | 3 | 4 | 5;

  prev_state_level?: 1 | 2 | 3 | 4 | 5;
  prevStateLevel?: 1 | 2 | 3 | 4 | 5;
  previous_state_level?: 1 | 2 | 3 | 4 | 5;
  previousStateLevel?: 1 | 2 | 3 | 4 | 5;
  memory_prev_state_level?: 1 | 2 | 3 | 4 | 5;
  memoryPrevStateLevel?: 1 | 2 | 3 | 4 | 5;
  assistant_prev_state_level?: 1 | 2 | 3 | 4 | 5;
  assistantPrevStateLevel?: 1 | 2 | 3 | 4 | 5;
  reply_prev_state_level?: 1 | 2 | 3 | 4 | 5;
  replyPrevStateLevel?: 1 | 2 | 3 | 4 | 5;

  state_changed?: boolean;
  stateChanged?: boolean;
  memory_state_changed?: boolean;
  memoryStateChanged?: boolean;
  assistant_state_changed?: boolean;
  assistantStateChanged?: boolean;
  reply_state_changed?: boolean;
  replyStateChanged?: boolean;
  phase_changed?: boolean;
  phaseChanged?: boolean;
  changed?: boolean;
};

export type MemoryItem = {
  id: string;
  text: string;
  importance?: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;

  state_level?: 1 | 2 | 3 | 4 | 5;
  stateLevel?: 1 | 2 | 3 | 4 | 5;
  memory_state_level?: 1 | 2 | 3 | 4 | 5;
  memoryStateLevel?: 1 | 2 | 3 | 4 | 5;
  assistant_state_level?: 1 | 2 | 3 | 4 | 5;
  assistantStateLevel?: 1 | 2 | 3 | 4 | 5;
  reply_state_level?: 1 | 2 | 3 | 4 | 5;
  replyStateLevel?: 1 | 2 | 3 | 4 | 5;
  level?: 1 | 2 | 3 | 4 | 5;

  prev_state_level?: 1 | 2 | 3 | 4 | 5;
  prevStateLevel?: 1 | 2 | 3 | 4 | 5;
  previous_state_level?: 1 | 2 | 3 | 4 | 5;
  previousStateLevel?: 1 | 2 | 3 | 4 | 5;
  memory_prev_state_level?: 1 | 2 | 3 | 4 | 5;
  memoryPrevStateLevel?: 1 | 2 | 3 | 4 | 5;
  assistant_prev_state_level?: 1 | 2 | 3 | 4 | 5;
  assistantPrevStateLevel?: 1 | 2 | 3 | 4 | 5;
  reply_prev_state_level?: 1 | 2 | 3 | 4 | 5;
  replyPrevStateLevel?: 1 | 2 | 3 | 4 | 5;

  current_phase?: 1 | 2 | 3 | 4 | 5;
  currentPhase?: 1 | 2 | 3 | 4 | 5;
  phase?: 1 | 2 | 3 | 4 | 5;
  state_phase?: 1 | 2 | 3 | 4 | 5;
  statePhase?: 1 | 2 | 3 | 4 | 5;
  memory_phase?: 1 | 2 | 3 | 4 | 5;
  memoryPhase?: 1 | 2 | 3 | 4 | 5;
  assistant_phase?: 1 | 2 | 3 | 4 | 5;
  assistantPhase?: 1 | 2 | 3 | 4 | 5;
  reply_phase?: 1 | 2 | 3 | 4 | 5;
  replyPhase?: 1 | 2 | 3 | 4 | 5;

  prev_phase?: 1 | 2 | 3 | 4 | 5;
  prevPhase?: 1 | 2 | 3 | 4 | 5;
  previous_phase?: 1 | 2 | 3 | 4 | 5;
  previousPhase?: 1 | 2 | 3 | 4 | 5;
  memory_prev_phase?: 1 | 2 | 3 | 4 | 5;
  memoryPrevPhase?: 1 | 2 | 3 | 4 | 5;
  assistant_prev_phase?: 1 | 2 | 3 | 4 | 5;
  assistantPrevPhase?: 1 | 2 | 3 | 4 | 5;
  reply_prev_phase?: 1 | 2 | 3 | 4 | 5;
  replyPrevPhase?: 1 | 2 | 3 | 4 | 5;

  state_changed?: boolean;
  stateChanged?: boolean;
  memory_state_changed?: boolean;
  memoryStateChanged?: boolean;
  assistant_state_changed?: boolean;
  assistantStateChanged?: boolean;
  reply_state_changed?: boolean;
  replyStateChanged?: boolean;
  phase_changed?: boolean;
  phaseChanged?: boolean;
  changed?: boolean;

  state?: MemoryStateShape | null;
  memory_state?: MemoryStateShape | null;
  memoryState?: MemoryStateShape | null;
  assistant_state?: MemoryStateShape | null;
  assistantState?: MemoryStateShape | null;
  reply_state?: MemoryStateShape | null;
  replyState?: MemoryStateShape | null;
  hopy_state?: MemoryStateShape | null;
  hopyState?: MemoryStateShape | null;
};

export type MemoryScope = "active" | "trash";

export type MemoriesListResult = {
  items: MemoryItem[];
  total: number;
};

function toQS(params: Record<string, string | number | boolean | undefined | null>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function json<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    try {
      const txt = await res.text();
      const t = String(txt ?? "").trim();
      if (!t) return null;
      return JSON.parse(t) as T;
    } catch {
      return null;
    }
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clampText(s: any, max = 800) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) : t;
}

function clampCount(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

function normalizeImportance(v: any): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const x = Math.round(n);
  if (x < 0 || x > 100) return undefined;
  return x;
}

function normalizeStateLevel(v: any): 1 | 2 | 3 | 4 | 5 | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const x = Math.round(n);
  if (x < 1 || x > 5) return undefined;
  return x as 1 | 2 | 3 | 4 | 5;
}

function normalizeCurrentPhase(v: any): 1 | 2 | 3 | 4 | 5 | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const x = Math.round(n);
  if (x < 1 || x > 5) return undefined;
  return x as 1 | 2 | 3 | 4 | 5;
}

function normalizeBool(v: any): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
    return undefined;
  }
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return undefined;
}

function pickFirst<T>(...values: T[]): T | undefined {
  for (const v of values) {
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function normalizeStateShape(x: any): MemoryStateShape | null {
  if (!x || typeof x !== "object") return null;

  const current_phase = normalizeCurrentPhase(x.current_phase);
  const currentPhase = normalizeCurrentPhase(x.currentPhase);
  const phase = normalizeCurrentPhase(x.phase);
  const state_phase = normalizeCurrentPhase(x.state_phase);
  const statePhase = normalizeCurrentPhase(x.statePhase);
  const memory_phase = normalizeCurrentPhase(x.memory_phase);
  const memoryPhase = normalizeCurrentPhase(x.memoryPhase);
  const assistant_phase = normalizeCurrentPhase(x.assistant_phase);
  const assistantPhase = normalizeCurrentPhase(x.assistantPhase);
  const reply_phase = normalizeCurrentPhase(x.reply_phase);
  const replyPhase = normalizeCurrentPhase(x.replyPhase);

  const prev_phase = normalizeCurrentPhase(x.prev_phase);
  const prevPhase = normalizeCurrentPhase(x.prevPhase);
  const previous_phase = normalizeCurrentPhase(x.previous_phase);
  const previousPhase = normalizeCurrentPhase(x.previousPhase);
  const memory_prev_phase = normalizeCurrentPhase(x.memory_prev_phase);
  const memoryPrevPhase = normalizeCurrentPhase(x.memoryPrevPhase);
  const assistant_prev_phase = normalizeCurrentPhase(x.assistant_prev_phase);
  const assistantPrevPhase = normalizeCurrentPhase(x.assistantPrevPhase);
  const reply_prev_phase = normalizeCurrentPhase(x.reply_prev_phase);
  const replyPrevPhase = normalizeCurrentPhase(x.replyPrevPhase);

  const state_level = normalizeStateLevel(x.state_level);
  const stateLevel = normalizeStateLevel(x.stateLevel);
  const memory_state_level = normalizeStateLevel(x.memory_state_level);
  const memoryStateLevel = normalizeStateLevel(x.memoryStateLevel);
  const assistant_state_level = normalizeStateLevel(x.assistant_state_level);
  const assistantStateLevel = normalizeStateLevel(x.assistantStateLevel);
  const reply_state_level = normalizeStateLevel(x.reply_state_level);
  const replyStateLevel = normalizeStateLevel(x.replyStateLevel);
  const level = normalizeStateLevel(x.level);

  const prev_state_level = normalizeStateLevel(x.prev_state_level);
  const prevStateLevel = normalizeStateLevel(x.prevStateLevel);
  const previous_state_level = normalizeStateLevel(x.previous_state_level);
  const previousStateLevel = normalizeStateLevel(x.previousStateLevel);
  const memory_prev_state_level = normalizeStateLevel(x.memory_prev_state_level);
  const memoryPrevStateLevel = normalizeStateLevel(x.memoryPrevStateLevel);
  const assistant_prev_state_level = normalizeStateLevel(x.assistant_prev_state_level);
  const assistantPrevStateLevel = normalizeStateLevel(x.assistantPrevStateLevel);
  const reply_prev_state_level = normalizeStateLevel(x.reply_prev_state_level);
  const replyPrevStateLevel = normalizeStateLevel(x.replyPrevStateLevel);

  const state_changed = normalizeBool(x.state_changed);
  const stateChanged = normalizeBool(x.stateChanged);
  const memory_state_changed = normalizeBool(x.memory_state_changed);
  const memoryStateChanged = normalizeBool(x.memoryStateChanged);
  const assistant_state_changed = normalizeBool(x.assistant_state_changed);
  const assistantStateChanged = normalizeBool(x.assistantStateChanged);
  const reply_state_changed = normalizeBool(x.reply_state_changed);
  const replyStateChanged = normalizeBool(x.replyStateChanged);
  const phase_changed = normalizeBool(x.phase_changed);
  const phaseChanged = normalizeBool(x.phaseChanged);
  const changed = normalizeBool(x.changed);

  const hasAny =
    current_phase !== undefined ||
    currentPhase !== undefined ||
    phase !== undefined ||
    state_phase !== undefined ||
    statePhase !== undefined ||
    memory_phase !== undefined ||
    memoryPhase !== undefined ||
    assistant_phase !== undefined ||
    assistantPhase !== undefined ||
    reply_phase !== undefined ||
    replyPhase !== undefined ||
    prev_phase !== undefined ||
    prevPhase !== undefined ||
    previous_phase !== undefined ||
    previousPhase !== undefined ||
    memory_prev_phase !== undefined ||
    memoryPrevPhase !== undefined ||
    assistant_prev_phase !== undefined ||
    assistantPrevPhase !== undefined ||
    reply_prev_phase !== undefined ||
    replyPrevPhase !== undefined ||
    state_level !== undefined ||
    stateLevel !== undefined ||
    memory_state_level !== undefined ||
    memoryStateLevel !== undefined ||
    assistant_state_level !== undefined ||
    assistantStateLevel !== undefined ||
    reply_state_level !== undefined ||
    replyStateLevel !== undefined ||
    level !== undefined ||
    prev_state_level !== undefined ||
    prevStateLevel !== undefined ||
    previous_state_level !== undefined ||
    previousStateLevel !== undefined ||
    memory_prev_state_level !== undefined ||
    memoryPrevStateLevel !== undefined ||
    assistant_prev_state_level !== undefined ||
    assistantPrevStateLevel !== undefined ||
    reply_prev_state_level !== undefined ||
    replyPrevStateLevel !== undefined ||
    state_changed !== undefined ||
    stateChanged !== undefined ||
    memory_state_changed !== undefined ||
    memoryStateChanged !== undefined ||
    assistant_state_changed !== undefined ||
    assistantStateChanged !== undefined ||
    reply_state_changed !== undefined ||
    replyStateChanged !== undefined ||
    phase_changed !== undefined ||
    phaseChanged !== undefined ||
    changed !== undefined;

  if (!hasAny) return null;

  return {
    current_phase,
    currentPhase,
    phase,
    state_phase,
    statePhase,
    memory_phase,
    memoryPhase,
    assistant_phase,
    assistantPhase,
    reply_phase,
    replyPhase,

    prev_phase,
    prevPhase,
    previous_phase,
    previousPhase,
    memory_prev_phase,
    memoryPrevPhase,
    assistant_prev_phase,
    assistantPrevPhase,
    reply_prev_phase,
    replyPrevPhase,

    state_level,
    stateLevel,
    memory_state_level,
    memoryStateLevel,
    assistant_state_level,
    assistantStateLevel,
    reply_state_level,
    replyStateLevel,
    level,

    prev_state_level,
    prevStateLevel,
    previous_state_level,
    previousStateLevel,
    memory_prev_state_level,
    memoryPrevStateLevel,
    assistant_prev_state_level,
    assistantPrevStateLevel,
    reply_prev_state_level,
    replyPrevStateLevel,

    state_changed,
    stateChanged,
    memory_state_changed,
    memoryStateChanged,
    assistant_state_changed,
    assistantStateChanged,
    reply_state_changed,
    replyStateChanged,
    phase_changed,
    phaseChanged,
    changed,
  };
}

function normalizeItem(x: any): MemoryItem | null {
  if (!x) return null;

  const id = String(x.id ?? "").trim();
  const text = String(x.text ?? x.body ?? x.content ?? "").trim();
  if (!id || !text) return null;

  const deletedAt = Object.prototype.hasOwnProperty.call(x ?? {}, "deleted_at")
    ? x.deleted_at
    : x.deletedAt;

  const importance = normalizeImportance(x.importance);

  const nestedState = normalizeStateShape(x.state);
  const nestedMemoryState = normalizeStateShape(x.memory_state);
  const nestedMemoryStateCamel = normalizeStateShape(x.memoryState);
  const nestedAssistantState = normalizeStateShape(x.assistant_state);
  const nestedAssistantStateCamel = normalizeStateShape(x.assistantState);
  const nestedReplyState = normalizeStateShape(x.reply_state);
  const nestedReplyStateCamel = normalizeStateShape(x.replyState);
  const nestedHopyState = normalizeStateShape(x.hopy_state);
  const nestedHopyStateCamel = normalizeStateShape(x.hopyState);

  const mergedNestedState =
    nestedState ??
    nestedMemoryState ??
    nestedMemoryStateCamel ??
    nestedAssistantState ??
    nestedAssistantStateCamel ??
    nestedReplyState ??
    nestedReplyStateCamel ??
    nestedHopyState ??
    nestedHopyStateCamel ??
    null;

  const stateLevel = normalizeStateLevel(
    pickFirst(
      x.state_level,
      x.stateLevel,
      x.memory_state_level,
      x.memoryStateLevel,
      x.assistant_state_level,
      x.assistantStateLevel,
      x.reply_state_level,
      x.replyStateLevel,
      x.level,
      mergedNestedState?.state_level,
      mergedNestedState?.stateLevel,
      mergedNestedState?.memory_state_level,
      mergedNestedState?.memoryStateLevel,
      mergedNestedState?.assistant_state_level,
      mergedNestedState?.assistantStateLevel,
      mergedNestedState?.reply_state_level,
      mergedNestedState?.replyStateLevel,
      mergedNestedState?.level,
    ),
  );

  const prevStateLevel = normalizeStateLevel(
    pickFirst(
      x.prev_state_level,
      x.prevStateLevel,
      x.previous_state_level,
      x.previousStateLevel,
      x.memory_prev_state_level,
      x.memoryPrevStateLevel,
      x.assistant_prev_state_level,
      x.assistantPrevStateLevel,
      x.reply_prev_state_level,
      x.replyPrevStateLevel,
      mergedNestedState?.prev_state_level,
      mergedNestedState?.prevStateLevel,
      mergedNestedState?.previous_state_level,
      mergedNestedState?.previousStateLevel,
      mergedNestedState?.memory_prev_state_level,
      mergedNestedState?.memoryPrevStateLevel,
      mergedNestedState?.assistant_prev_state_level,
      mergedNestedState?.assistantPrevStateLevel,
      mergedNestedState?.reply_prev_state_level,
      mergedNestedState?.replyPrevStateLevel,
    ),
  );

  const currentPhase = normalizeCurrentPhase(
    pickFirst(
      x.current_phase,
      x.currentPhase,
      x.phase,
      x.state_phase,
      x.statePhase,
      x.memory_phase,
      x.memoryPhase,
      x.assistant_phase,
      x.assistantPhase,
      x.reply_phase,
      x.replyPhase,
      mergedNestedState?.current_phase,
      mergedNestedState?.currentPhase,
      mergedNestedState?.phase,
      mergedNestedState?.state_phase,
      mergedNestedState?.statePhase,
      mergedNestedState?.memory_phase,
      mergedNestedState?.memoryPhase,
      mergedNestedState?.assistant_phase,
      mergedNestedState?.assistantPhase,
      mergedNestedState?.reply_phase,
      mergedNestedState?.replyPhase,
    ),
  );

  const prevPhase = normalizeCurrentPhase(
    pickFirst(
      x.prev_phase,
      x.prevPhase,
      x.previous_phase,
      x.previousPhase,
      x.memory_prev_phase,
      x.memoryPrevPhase,
      x.assistant_prev_phase,
      x.assistantPrevPhase,
      x.reply_prev_phase,
      x.replyPrevPhase,
      mergedNestedState?.prev_phase,
      mergedNestedState?.prevPhase,
      mergedNestedState?.previous_phase,
      mergedNestedState?.previousPhase,
      mergedNestedState?.memory_prev_phase,
      mergedNestedState?.memoryPrevPhase,
      mergedNestedState?.assistant_prev_phase,
      mergedNestedState?.assistantPrevPhase,
      mergedNestedState?.reply_prev_phase,
      mergedNestedState?.replyPrevPhase,
    ),
  );

  const stateChanged = normalizeBool(
    pickFirst(
      x.state_changed,
      x.stateChanged,
      x.memory_state_changed,
      x.memoryStateChanged,
      x.assistant_state_changed,
      x.assistantStateChanged,
      x.reply_state_changed,
      x.replyStateChanged,
      x.phase_changed,
      x.phaseChanged,
      x.changed,
      mergedNestedState?.state_changed,
      mergedNestedState?.stateChanged,
      mergedNestedState?.memory_state_changed,
      mergedNestedState?.memoryStateChanged,
      mergedNestedState?.assistant_state_changed,
      mergedNestedState?.assistantStateChanged,
      mergedNestedState?.reply_state_changed,
      mergedNestedState?.replyStateChanged,
      mergedNestedState?.phase_changed,
      mergedNestedState?.phaseChanged,
      mergedNestedState?.changed,
    ),
  );

  return {
    id,
    text,
    importance,
    created_at: x.created_at ?? x.createdAt,
    updated_at: x.updated_at ?? x.updatedAt,
    deleted_at: deletedAt ?? null,

    state_level: stateLevel,
    stateLevel,
    memory_state_level: stateLevel,
    memoryStateLevel: stateLevel,
    assistant_state_level: stateLevel,
    assistantStateLevel: stateLevel,
    reply_state_level: stateLevel,
    replyStateLevel: stateLevel,
    level: stateLevel,

    prev_state_level: prevStateLevel,
    prevStateLevel: prevStateLevel,
    previous_state_level: prevStateLevel,
    previousStateLevel: prevStateLevel,
    memory_prev_state_level: prevStateLevel,
    memoryPrevStateLevel: prevStateLevel,
    assistant_prev_state_level: prevStateLevel,
    assistantPrevStateLevel: prevStateLevel,
    reply_prev_state_level: prevStateLevel,
    replyPrevStateLevel: prevStateLevel,

    current_phase: currentPhase,
    currentPhase,
    phase: currentPhase,
    state_phase: currentPhase,
    statePhase: currentPhase,
    memory_phase: currentPhase,
    memoryPhase: currentPhase,
    assistant_phase: currentPhase,
    assistantPhase: currentPhase,
    reply_phase: currentPhase,
    replyPhase: currentPhase,

    prev_phase: prevPhase,
    prevPhase: prevPhase,
    previous_phase: prevPhase,
    previousPhase: prevPhase,
    memory_prev_phase: prevPhase,
    memoryPrevPhase: prevPhase,
    assistant_prev_phase: prevPhase,
    assistantPrevPhase: prevPhase,
    reply_prev_phase: prevPhase,
    replyPrevPhase: prevPhase,

    state_changed: stateChanged,
    stateChanged,
    memory_state_changed: stateChanged,
    memoryStateChanged: stateChanged,
    assistant_state_changed: stateChanged,
    assistantStateChanged: stateChanged,
    reply_state_changed: stateChanged,
    replyStateChanged: stateChanged,
    phase_changed: stateChanged,
    phaseChanged: stateChanged,
    changed: stateChanged,

    state: nestedState ?? mergedNestedState,
    memory_state: nestedMemoryState ?? mergedNestedState,
    memoryState: nestedMemoryStateCamel ?? mergedNestedState,
    assistant_state: nestedAssistantState ?? mergedNestedState,
    assistantState: nestedAssistantStateCamel ?? mergedNestedState,
    reply_state: nestedReplyState ?? mergedNestedState,
    replyState: nestedReplyStateCamel ?? mergedNestedState,
    hopy_state: nestedHopyState ?? mergedNestedState,
    hopyState: nestedHopyStateCamel ?? mergedNestedState,
  };
}

function normalizeList(payload: any): MemoryItem[] {
  const arr = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.memories)
        ? payload.memories
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

  const out: MemoryItem[] = [];
  for (const x of arr) {
    const it = normalizeItem(x);
    if (it) out.push(it);
  }
  return out;
}

function filterByScope(items: MemoryItem[], scope: MemoryScope): MemoryItem[] {
  if (scope === "trash") {
    return items.filter((item) => !!item.deleted_at);
  }
  return items.filter((item) => !item.deleted_at);
}

function normalizeTotal(payload: any, fallbackItemsLength: number) {
  return clampCount(payload?.total ?? payload?.count ?? fallbackItemsLength);
}

export function formatMemoryMeta(iso?: string, uiLang: "ja" | "en" = "ja") {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString(uiLang === "en" ? "en-US" : "ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export async function listMemoriesWithTotal(
  scope: MemoryScope = "active",
): Promise<MemoriesListResult> {
  const ah = await authHeaders();

  const res = await fetch(`/api/memories${toQS({ scope })}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...ah,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return { items: [], total: 0 };
  }

  const data = await json<any>(res);
  const list = filterByScope(normalizeList(data), scope);
  const total = normalizeTotal(data, list.length);

  return { items: list, total };
}

export async function listMemories(scope: MemoryScope = "active"): Promise<MemoryItem[]> {
  const result = await listMemoriesWithTotal(scope);
  return result.items;
}

export async function createMemory(text: string, importance?: number): Promise<MemoryItem | null> {
  const ah = await authHeaders();

  const t = clampText(text);
  if (!t) return null;

  const body: any = { body: t, text: t };
  const imp = normalizeImportance(importance);
  if (imp !== undefined) body.importance = imp;

  const res = await fetch(`/api/memories`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...ah,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;

  const data = await json<any>(res);
  return normalizeItem(data?.item ?? data);
}

export async function updateMemory(id: string, text: string): Promise<boolean> {
  const ah = await authHeaders();

  const mid = String(id ?? "").trim();
  const t = clampText(text);
  if (!mid || !t) return false;

  const res = await fetch(`/api/memories`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...ah,
    },
    body: JSON.stringify({ id: mid, text: t }),
  });

  return res.ok;
}

export async function deleteMemory(id: string): Promise<boolean> {
  const ah = await authHeaders();

  const mid = String(id ?? "").trim();
  if (!mid) return false;

  const res = await fetch(`/api/memories${toQS({ id: mid })}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...ah,
    },
  });

  return res.ok;
}

export async function restoreMemory(id: string): Promise<boolean> {
  const ah = await authHeaders();

  const mid = String(id ?? "").trim();
  if (!mid) return false;

  const res = await fetch(`/api/memories`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...ah,
    },
    body: JSON.stringify({ id: mid, restore: true }),
  });

  return res.ok;
}

export async function hardDeleteMemory(id: string): Promise<boolean> {
  const ah = await authHeaders();

  const mid = String(id ?? "").trim();
  if (!mid) return false;

  const res = await fetch(`/api/memories${toQS({ id: mid, hard: 1 })}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...ah,
    },
  });

  return res.ok;
}