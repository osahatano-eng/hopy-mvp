// /app/api/chat/_lib/hopy/dashboard/extractDashboardSignals.ts

export type DashboardSignalType =
  | "theme_continuity"
  | "support_need"
  | "forward_motion"
  | "stagnation"
  | "instability_sign"
  | "continuation_intent"
  | "state_snapshot";

export type DashboardSignalCandidate = {
  signal_type: DashboardSignalType;
  signal_value: number;
  body: string;
};

export type ExtractDashboardSignalsArgs = {
  userMessage?: string | null;
  reply?: string | null;
  state?:
    | {
        current_phase?: number | null;
        state_level?: number | null;
        prev_phase?: number | null;
        prev_state_level?: number | null;
        state_changed?: boolean | null;
        label?: string | null;
      }
    | null;
  parsed?:
    | {
        dashboardSignalRaw?: unknown;
        dashboardSignals?: unknown;
      }
    | null;
};

type RawSignal = {
  signal_type?: unknown;
  type?: unknown;
  signal_value?: unknown;
  value?: unknown;
  body?: unknown;
  summary?: unknown;
  text?: unknown;
};

const MAX_BODY_LENGTH = 200;

function normalizeText(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function normalizeBody(input: unknown): string {
  const text = normalizeText(input);
  if (!text) return "";
  return text.length > MAX_BODY_LENGTH ? text.slice(0, MAX_BODY_LENGTH).trim() : text;
}

function normalizeSignalType(input: unknown): DashboardSignalType | null {
  const v = normalizeText(input).toLowerCase();
  if (v === "theme_continuity") return "theme_continuity";
  if (v === "support_need") return "support_need";
  if (v === "forward_motion") return "forward_motion";
  if (v === "stagnation") return "stagnation";
  if (v === "instability_sign") return "instability_sign";
  if (v === "continuation_intent") return "continuation_intent";
  if (v === "state_snapshot") return "state_snapshot";
  return null;
}

function normalizeSignalValue(input: unknown): number | null {
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  const v = Math.trunc(n);
  if (v < 1) return 1;
  if (v > 5) return 5;
  return v;
}

function normalizeStateLevel(state: ExtractDashboardSignalsArgs["state"]): number | null {
  const a = Number(state?.state_level);
  if (Number.isFinite(a) && a >= 1 && a <= 5) return Math.trunc(a);
  const b = Number(state?.current_phase);
  if (Number.isFinite(b) && b >= 1 && b <= 5) return Math.trunc(b);
  return null;
}

function normalizePrevStateLevel(state: ExtractDashboardSignalsArgs["state"]): number | null {
  const a = Number(state?.prev_state_level);
  if (Number.isFinite(a) && a >= 1 && a <= 5) return Math.trunc(a);
  const b = Number(state?.prev_phase);
  if (Number.isFinite(b) && b >= 1 && b <= 5) return Math.trunc(b);
  return null;
}

function toRawSignalArray(input: unknown): RawSignal[] {
  if (Array.isArray(input)) {
    return input.filter((item): item is RawSignal => typeof item === "object" && item !== null);
  }
  if (typeof input === "object" && input !== null) {
    return [input as RawSignal];
  }
  return [];
}

function toSignal(input: RawSignal): DashboardSignalCandidate | null {
  const signalType = normalizeSignalType(input.signal_type ?? input.type);
  const signalValue = normalizeSignalValue(input.signal_value ?? input.value);
  const body = normalizeBody(input.body ?? input.summary ?? input.text);

  if (!signalType || signalValue === null || !body) return null;

  return {
    signal_type: signalType,
    signal_value: signalValue,
    body,
  };
}

function dedupeSignals(items: DashboardSignalCandidate[]): DashboardSignalCandidate[] {
  const seen = new Set<string>();
  const result: DashboardSignalCandidate[] = [];

  for (const item of items) {
    const key = `${item.signal_type}::${item.signal_value}::${item.body}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function buildStateSnapshot(args: ExtractDashboardSignalsArgs): DashboardSignalCandidate | null {
  const level = normalizeStateLevel(args.state);
  if (!level) return null;

  const label = normalizeText(args.state?.label) || `phase_${level}`;

  return {
    signal_type: "state_snapshot",
    signal_value: level,
    body: `state:${level}:${label}`,
  };
}

function buildForwardOrStagnation(args: ExtractDashboardSignalsArgs): DashboardSignalCandidate | null {
  const level = normalizeStateLevel(args.state);
  const prev = normalizePrevStateLevel(args.state);
  const changed = args.state?.state_changed === true;

  if (!level) return null;

  if (changed && prev && level > prev) {
    return {
      signal_type: "forward_motion",
      signal_value: Math.min(5, level),
      body: `state moved from ${prev} to ${level}`,
    };
  }

  if (changed && prev && level < prev) {
    return {
      signal_type: "instability_sign",
      signal_value: Math.min(5, prev - level + 1),
      body: `state moved down from ${prev} to ${level}`,
    };
  }

  return {
    signal_type: "stagnation",
    signal_value: Math.max(1, 6 - level),
    body: `state remains at ${level}`,
  };
}

function buildContinuationIntent(args: ExtractDashboardSignalsArgs): DashboardSignalCandidate | null {
  const userMessage = normalizeText(args.userMessage);
  if (!userMessage) return null;

  const patterns = [
    "がんばる",
    "頑張る",
    "続ける",
    "進める",
    "やる",
    "やります",
    "続けます",
    "進みます",
  ];

  const matched = patterns.some((part) => userMessage.includes(part));
  if (!matched) return null;

  return {
    signal_type: "continuation_intent",
    signal_value: 4,
    body: normalizeBody(userMessage),
  };
}

function buildThemeContinuity(args: ExtractDashboardSignalsArgs): DashboardSignalCandidate | null {
  const userMessage = normalizeBody(args.userMessage);
  if (!userMessage) return null;

  return {
    signal_type: "theme_continuity",
    signal_value: 3,
    body: userMessage,
  };
}

function buildSupportNeed(args: ExtractDashboardSignalsArgs): DashboardSignalCandidate | null {
  const reply = normalizeBody(args.reply);
  const level = normalizeStateLevel(args.state);

  if (!reply || !level) return null;

  const signalValue = level <= 2 ? 4 : level === 3 ? 3 : 2;

  return {
    signal_type: "support_need",
    signal_value: signalValue,
    body: reply,
  };
}

export function extractDashboardSignals(
  args: ExtractDashboardSignalsArgs,
): DashboardSignalCandidate[] {
  const rawParsedItems = [
    ...toRawSignalArray(args.parsed?.dashboardSignals),
    ...toRawSignalArray(args.parsed?.dashboardSignalRaw),
  ];

  const parsedSignals = rawParsedItems
    .map(toSignal)
    .filter((item): item is DashboardSignalCandidate => item !== null);

  if (parsedSignals.length > 0) {
    return dedupeSignals(parsedSignals);
  }

  const fallbackSignals: DashboardSignalCandidate[] = [];

  const stateSnapshot = buildStateSnapshot(args);
  if (stateSnapshot) fallbackSignals.push(stateSnapshot);

  const forwardOrStagnation = buildForwardOrStagnation(args);
  if (forwardOrStagnation) fallbackSignals.push(forwardOrStagnation);

  const continuationIntent = buildContinuationIntent(args);
  if (continuationIntent) fallbackSignals.push(continuationIntent);

  const themeContinuity = buildThemeContinuity(args);
  if (themeContinuity) fallbackSignals.push(themeContinuity);

  const supportNeed = buildSupportNeed(args);
  if (supportNeed) fallbackSignals.push(supportNeed);

  return dedupeSignals(fallbackSignals);
}

/*
このファイルの正式役割:
HOPY回答の確定意味から dashboard signal 候補を抽出し、正規化・重複除去して返す抽出層。
*/

/*
【今回このファイルで修正したこと】
buildSupportNeed の return で未定義の signal_value を参照していたため、同関数内で計算済みの signalValue を返すよう修正した。
*/