// /app/api/chat/_lib/hopy/memory/extractAutoMemoryCandidates.ts

export type AutoMemoryCandidateType =
  | "trait"
  | "theme"
  | "support_context"
  | "dashboard_signal";

export type AutoMemoryCandidate = {
  body: string;
  memory_type: AutoMemoryCandidateType;
  source_type: "auto";
};

export type ExtractAutoMemoryCandidatesArgs = {
  userMessage?: string | null;
  reply?: string | null;
  state?:
    | {
        current_phase?: number | null;
        state_level?: number | null;
        label?: string | null;
      }
    | null;
  parsed?:
    | {
        memoryCandidateRaw?: unknown;
        memoryCandidates?: unknown;
      }
    | null;
};

type RawCandidate = {
  body?: unknown;
  summary?: unknown;
  text?: unknown;
  memory_type?: unknown;
  type?: unknown;
};

const MAX_BODY_LENGTH = 200;

function normalizeText(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function normalizeMemoryType(input: unknown): AutoMemoryCandidateType | null {
  const v = normalizeText(input).toLowerCase();
  if (v === "trait") return "trait";
  if (v === "theme") return "theme";
  if (v === "support_context") return "support_context";
  if (v === "dashboard_signal") return "dashboard_signal";
  return null;
}

function stripLeadingUserPrefix(input: string): string {
  return input
    .replace(/^ユーザーは\s*/u, "")
    .replace(/^ユーザーが\s*/u, "")
    .replace(/^利用者は\s*/u, "")
    .trim();
}

function normalizeBody(input: unknown): string {
  const text = stripLeadingUserPrefix(normalizeText(input));
  if (!text) return "";
  return text.length > MAX_BODY_LENGTH ? text.slice(0, MAX_BODY_LENGTH).trim() : text;
}

function toRawCandidateArray(input: unknown): RawCandidate[] {
  if (Array.isArray(input)) {
    return input.filter((item): item is RawCandidate => typeof item === "object" && item !== null);
  }
  if (typeof input === "object" && input !== null) {
    return [input as RawCandidate];
  }
  return [];
}

function buildFallbackSupportContext(userMessage: string, reply: string): AutoMemoryCandidate | null {
  const safeUserMessage = normalizeBody(userMessage);
  const safeReply = normalizeBody(reply);

  if (!safeUserMessage || !safeReply) return null;

  return {
    source_type: "auto",
    memory_type: "support_context",
    body: `User context: ${safeUserMessage} / HOPY support: ${safeReply}`,
  };
}

function buildFallbackTheme(userMessage: string): AutoMemoryCandidate | null {
  const safeUserMessage = normalizeBody(userMessage);
  if (!safeUserMessage) return null;

  return {
    source_type: "auto",
    memory_type: "theme",
    body: safeUserMessage,
  };
}

function buildFallbackDashboardSignal(args: ExtractAutoMemoryCandidatesArgs): AutoMemoryCandidate | null {
  const stateLevel =
    typeof args.state?.state_level === "number"
      ? args.state.state_level
      : typeof args.state?.current_phase === "number"
        ? args.state.current_phase
        : null;

  if (!stateLevel || stateLevel < 1 || stateLevel > 5) return null;

  const label = normalizeText(args.state?.label) || `phase_${stateLevel}`;

  return {
    source_type: "auto",
    memory_type: "dashboard_signal",
    body: `state:${stateLevel}:${label}`,
  };
}

function normalizeForAbstractCheck(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[。、，．.!！?？"'`´‘’“”（）()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMeaningfulSegments(body: string): number {
  const normalized = normalizeForAbstractCheck(body);
  if (!normalized) return 0;

  const parts = normalized
    .split(/[\/｜|,:：;；]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length;
}

function hasConcreteRelationalStructure(body: string): boolean {
  const text = normalizeBody(body);
  if (!text) return false;

  const relationalPatterns = [
    "ために",
    "ように",
    "ことで",
    "ような",
    "に対して",
    "について",
    "を避ける",
    "を防ぐ",
    "を減らす",
    "を高める",
    "を整理する",
    "を重視している",
    "が重要",
    "ことが重要",
  ];

  return relationalPatterns.some((pattern) => text.includes(pattern));
}

function isTooAbstractTrait(body: string): boolean {
  const text = normalizeBody(body);
  if (!text) return true;

  const abstractPatterns = [
    "重視している",
    "重視する傾向がある",
    "大切にしている",
    "意識している",
    "配慮している",
    "丁寧に考えている",
  ];

  const matchedAbstractPattern = abstractPatterns.some((pattern) => text.includes(pattern));
  if (!matchedAbstractPattern) return false;

  if (hasConcreteRelationalStructure(text)) return false;
  if (countMeaningfulSegments(text) >= 2) return false;

  return true;
}

function toCandidate(input: RawCandidate): AutoMemoryCandidate | null {
  const memoryType = normalizeMemoryType(input.memory_type ?? input.type);
  const body = normalizeBody(input.body ?? input.summary ?? input.text);

  if (!memoryType || !body) return null;

  if (memoryType === "trait" && isTooAbstractTrait(body)) {
    return null;
  }

  return {
    source_type: "auto",
    memory_type: memoryType,
    body,
  };
}

function dedupeCandidates(items: AutoMemoryCandidate[]): AutoMemoryCandidate[] {
  const seen = new Set<string>();
  const result: AutoMemoryCandidate[] = [];

  for (const item of items) {
    const key = `${item.memory_type}::${item.body}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

export function extractAutoMemoryCandidates(
  args: ExtractAutoMemoryCandidatesArgs,
): AutoMemoryCandidate[] {
  const rawParsedItems = [
    ...toRawCandidateArray(args.parsed?.memoryCandidates),
    ...toRawCandidateArray(args.parsed?.memoryCandidateRaw),
  ];

  const parsedCandidates = rawParsedItems
    .map(toCandidate)
    .filter((item): item is AutoMemoryCandidate => item !== null);

  if (parsedCandidates.length > 0) {
    return dedupeCandidates(parsedCandidates);
  }

  const fallbackCandidates: AutoMemoryCandidate[] = [];

  const fallbackSupport = buildFallbackSupportContext(
    normalizeText(args.userMessage),
    normalizeText(args.reply),
  );
  if (fallbackSupport) fallbackCandidates.push(fallbackSupport);

  const fallbackTheme = buildFallbackTheme(normalizeText(args.userMessage));
  if (fallbackTheme) fallbackCandidates.push(fallbackTheme);

  const fallbackSignal = buildFallbackDashboardSignal(args);
  if (fallbackSignal) fallbackCandidates.push(fallbackSignal);

  return dedupeCandidates(fallbackCandidates);
}

/*
このファイルの正式役割
AutoMemoryCandidate を抽出する責務。
parsed.memoryCandidates / memoryCandidateRaw を正規化し、
必要時のみ fallback の support_context / theme / dashboard_signal を作って、
MEMORIES保存前の候補配列へ整える。
*/

/*
【今回このファイルで修正したこと】
- Auto memory candidate の body 正規化時に、先頭の「ユーザーは」「ユーザーが」「利用者は」を取り除く処理を追加しました。
- これにより、MEMORIES本文の先頭に「ユーザーは ...」がそのまま保存される症状を止めます。
- HOPY回答本文、learning、Compass、state の意味生成には触っていません。
*/