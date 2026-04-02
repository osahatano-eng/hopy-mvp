// /app/api/chat/_lib/hopy/result/parseModelAnswer.ts

export type ParsedModelAnswer = {
  reply: string;
  state: unknown;
  memoryCandidates: unknown[];
  dashboardSignals: unknown[];
  expressionCandidates: unknown[];
  titleCandidate?: string;
  notification?: {
    unread_count?: number;
    updated_at?: string | null;
  };
  debug?: unknown;
  raw: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeOptionalString(value: unknown): string | undefined {
  const s = normalizeString(value);
  return s ? s : undefined;
}

function normalizeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeUnreadCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) {
      return Math.max(0, Math.round(n));
    }
  }

  return undefined;
}

function normalizeIsoDatetime(value: unknown): string | null | undefined {
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

  return undefined;
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function pickReply(source: Record<string, unknown>, rawText: string): string {
  const direct = normalizeString(source.reply);
  if (direct) return direct;

  const message = normalizeString(source.message);
  if (message) return message;

  const answer = normalizeString(source.answer);
  if (answer) return answer;

  return rawText.trim();
}

function hasStateFields(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;

  return (
    typeof value.state !== "undefined" ||
    typeof value.state_level !== "undefined" ||
    typeof value.current_phase !== "undefined" ||
    typeof value.prev_state_level !== "undefined" ||
    typeof value.prev_phase !== "undefined" ||
    typeof value.state_changed !== "undefined" ||
    typeof value.phase !== "undefined" ||
    typeof value.level !== "undefined" ||
    typeof value.label !== "undefined" ||
    typeof value.name !== "undefined"
  );
}

function buildStateObject(source: Record<string, unknown>): Record<string, unknown> | undefined {
  const currentPhase =
    typeof source.current_phase !== "undefined"
      ? source.current_phase
      : source.phase;

  const stateLevel =
    typeof source.state_level !== "undefined"
      ? source.state_level
      : source.level;

  const prevPhase =
    typeof source.prev_phase !== "undefined"
      ? source.prev_phase
      : undefined;

  const prevStateLevel =
    typeof source.prev_state_level !== "undefined"
      ? source.prev_state_level
      : undefined;

  const stateChanged =
    typeof source.state_changed !== "undefined"
      ? source.state_changed
      : undefined;

  const label =
    typeof source.label !== "undefined"
      ? source.label
      : typeof source.state_name !== "undefined"
        ? source.state_name
        : typeof source.name !== "undefined"
          ? source.name
          : undefined;

  const prevLabel =
    typeof source.prev_label !== "undefined"
      ? source.prev_label
      : typeof source.prev_state_name !== "undefined"
        ? source.prev_state_name
        : undefined;

  const result: Record<string, unknown> = {};

  if (typeof currentPhase !== "undefined") {
    result.current_phase = currentPhase;
  }

  if (typeof stateLevel !== "undefined") {
    result.state_level = stateLevel;
  }

  if (typeof prevPhase !== "undefined") {
    result.prev_phase = prevPhase;
  }

  if (typeof prevStateLevel !== "undefined") {
    result.prev_state_level = prevStateLevel;
  }

  if (typeof stateChanged !== "undefined") {
    result.state_changed = stateChanged;
  }

  if (typeof label !== "undefined") {
    result.label = label;
  }

  if (typeof prevLabel !== "undefined") {
    result.prev_label = prevLabel;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function pickState(source: Record<string, unknown>): unknown {
  if (hasStateFields(source.state)) {
    const nested = source.state as Record<string, unknown>;
    return buildStateObject(nested) ?? nested;
  }

  if (typeof source.state !== "undefined") {
    return source.state;
  }

  const direct =
    buildStateObject(source) ??
    (hasStateFields(source.result) ? buildStateObject(source.result as Record<string, unknown>) : undefined) ??
    (hasStateFields(source.output) ? buildStateObject(source.output as Record<string, unknown>) : undefined) ??
    (hasStateFields(source.data) ? buildStateObject(source.data as Record<string, unknown>) : undefined);

  if (typeof direct !== "undefined") {
    return direct;
  }

  return undefined;
}

function pickNotification(
  source: Record<string, unknown>,
): ParsedModelAnswer["notification"] | undefined {
  const raw = source.notification;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const rec = raw as Record<string, unknown>;
  const unreadCount = normalizeUnreadCount(rec.unread_count);
  const updatedAt = normalizeIsoDatetime(rec.updated_at);

  if (typeof unreadCount === "undefined" && typeof updatedAt === "undefined") {
    return undefined;
  }

  return {
    ...(typeof unreadCount === "undefined" ? {} : { unread_count: unreadCount }),
    ...(typeof updatedAt === "undefined" ? {} : { updated_at: updatedAt }),
  };
}

function toObjectSource(modelOutput: unknown): {
  source: Record<string, unknown>;
  rawText: string;
} {
  if (modelOutput && typeof modelOutput === "object" && !Array.isArray(modelOutput)) {
    return {
      source: modelOutput as Record<string, unknown>,
      rawText: "",
    };
  }

  if (typeof modelOutput === "string") {
    const rawText = modelOutput;
    const parsed = tryParseJson(rawText);
    return {
      source: parsed ?? {},
      rawText,
    };
  }

  return {
    source: {},
    rawText: "",
  };
}

export function parseModelAnswer(modelOutput: unknown): ParsedModelAnswer {
  const { source, rawText } = toObjectSource(modelOutput);

  return {
    reply: pickReply(source, rawText),
    state: pickState(source),
    memoryCandidates: normalizeArray(
      source.memoryCandidates ?? source.memory_candidates ?? source.memories,
    ),
    dashboardSignals: normalizeArray(
      source.dashboardSignals ?? source.dashboard_signals,
    ),
    expressionCandidates: normalizeArray(
      source.expressionCandidates ?? source.expression_candidates,
    ),
    titleCandidate: normalizeOptionalString(
      source.titleCandidate ?? source.title_candidate,
    ),
    notification: pickNotification(source),
    ...(typeof source.debug === "undefined" ? {} : { debug: source.debug }),
    raw: modelOutput,
  };
}

export default parseModelAnswer;