// /app/api/chat/_lib/hopy/prompt/buildHopyPromptInput.ts

export type HopyPromptRecentMessage = {
  role: "user" | "assistant";
  content: string;
  created_at?: string | null;
};

export type HopyPromptMemory = {
  id?: string | null;
  body: string;
  source_type?: string | null;
  memory_type?: string | null;
  updated_at?: string | null;
};

export type HopyPromptThread = {
  id?: string | null;
  title?: string | null;
  current_phase?: unknown;
  state_level?: unknown;
  prev_phase?: unknown;
  prev_state_level?: unknown;
};

export type BuildHopyPromptInputArgs = {
  latestUserInput?: unknown;
  recentMessages?: unknown;
  activeMemories?: unknown;
  thread?: unknown;
  prevStateLevel?: unknown;
  userContext?: unknown;
  uiLang?: unknown;
};

export type HopyPromptInput = {
  latestUserInput: string;
  recentMessages: HopyPromptRecentMessage[];
  activeMemories: HopyPromptMemory[];
  thread: {
    id: string | null;
    title: string | null;
    current_phase: 1 | 2 | 3 | 4 | 5 | null;
    state_level: 1 | 2 | 3 | 4 | 5 | null;
    prev_phase: 1 | 2 | 3 | 4 | 5 | null;
    prev_state_level: 1 | 2 | 3 | 4 | 5 | null;
  };
  prevStateLevel: 1 | 2 | 3 | 4 | 5 | null;
  userContext: Record<string, unknown> | null;
  uiLang: "ja" | "en";
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeNullableString(value: unknown): string | null {
  const s = normalizeString(value);
  return s || null;
}

function normalizeRole(value: unknown): "system" | "user" | "assistant" | null {
  if (typeof value !== "string") return null;
  const s = value.trim().toLowerCase();
  if (s === "system" || s === "user" || s === "assistant") return s;
  return null;
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

function normalizeStateLevelOrNull(
  value: unknown,
): 1 | 2 | 3 | 4 | 5 | null {
  if (isFiniteNumber(value)) {
    const rounded = Math.round(value);
    if (rounded === 1) return 1;
    if (rounded === 2) return 2;
    if (rounded === 3) return 3;
    if (rounded === 4) return 4;
    if (rounded === 5) return 5;
    return null;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    const numeric = Number(s);
    if (Number.isFinite(numeric)) {
      return normalizeStateLevelOrNull(numeric);
    }

    const lower = s.toLowerCase();

    if (s === "混線" || lower === "mixed") return 1;
    if (s === "模索" || lower === "seeking") return 2;
    if (s === "整理" || lower === "organizing") return 3;
    if (s === "収束" || lower === "converging") return 4;
    if (s === "決定" || lower === "deciding") return 5;
  }

  return null;
}

function normalizeUiLang(value: unknown): "ja" | "en" {
  if (typeof value !== "string") return "ja";
  const s = value.trim().toLowerCase();
  return s === "en" ? "en" : "ja";
}

function normalizeRecentMessages(value: unknown): HopyPromptRecentMessage[] {
  if (!Array.isArray(value)) return [];

  const normalized: Array<HopyPromptRecentMessage & { _index: number }> = [];

  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const rec = item as Record<string, unknown>;
    const role = normalizeRole(rec.role);
    const content = normalizeString(rec.content ?? rec.text ?? rec.body);

    if (!role || role === "system" || !content) continue;

    normalized.push({
      role,
      content,
      created_at: normalizeIsoDatetime(rec.created_at ?? rec.createdAt),
      _index: i,
    });
  }

  normalized.sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) : Number.NaN;
    const bTime = b.created_at ? Date.parse(b.created_at) : Number.NaN;

    const aValid = Number.isFinite(aTime);
    const bValid = Number.isFinite(bTime);

    if (aValid && bValid && aTime !== bTime) {
      return aTime - bTime;
    }

    if (aValid && !bValid) return -1;
    if (!aValid && bValid) return 1;

    return a._index - b._index;
  });

  return normalized.map(({ role, content, created_at }) => ({
    role,
    content,
    created_at,
  }));
}

function normalizeActiveMemories(value: unknown): HopyPromptMemory[] {
  if (!Array.isArray(value)) return [];

  const normalized: HopyPromptMemory[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const rec = item as Record<string, unknown>;
    const body = normalizeString(rec.body);

    if (!body) continue;

    normalized.push({
      id: normalizeNullableString(rec.id),
      body,
      source_type: normalizeNullableString(rec.source_type),
      memory_type: normalizeNullableString(rec.memory_type),
      updated_at: normalizeIsoDatetime(rec.updated_at),
    });
  }

  return normalized;
}

function normalizeThread(value: unknown): HopyPromptInput["thread"] {
  const rec =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const current =
    normalizeStateLevelOrNull(rec.state_level) ??
    normalizeStateLevelOrNull(rec.current_phase);

  const prev =
    normalizeStateLevelOrNull(rec.prev_state_level) ??
    normalizeStateLevelOrNull(rec.prev_phase);

  return {
    id: normalizeNullableString(rec.id),
    title: normalizeNullableString(rec.title),
    current_phase: current,
    state_level: current,
    prev_phase: prev,
    prev_state_level: prev,
  };
}

function normalizeUserContext(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function buildHopyPromptInput(
  args: BuildHopyPromptInputArgs = {},
): HopyPromptInput {
  const userContext = normalizeUserContext(args.userContext);
  const prevStateLevel = normalizeStateLevelOrNull(args.prevStateLevel);
  const thread = normalizeThread(args.thread);

  return {
    latestUserInput: normalizeString(args.latestUserInput),
    recentMessages: normalizeRecentMessages(args.recentMessages),
    activeMemories: normalizeActiveMemories(args.activeMemories),
    thread,
    prevStateLevel,
    userContext,
    uiLang: normalizeUiLang(args.uiLang),
  };
}

export default buildHopyPromptInput;