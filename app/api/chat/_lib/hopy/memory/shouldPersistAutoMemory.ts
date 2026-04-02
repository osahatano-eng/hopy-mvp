// /app/api/chat/_lib/hopy/memory/shouldPersistAutoMemory.ts

import type { AutoMemoryCandidate } from "./extractAutoMemoryCandidates";

export type ShouldPersistAutoMemoryArgs = {
  candidate: AutoMemoryCandidate;
  existingBodies?: string[] | null;
  existingCandidates?: Array<
    | {
        body?: string | null;
        memory_type?: string | null;
      }
    | null
  > | null;
};

const MIN_BODY_LENGTH = 6;
const MAX_BODY_LENGTH = 200;

const LOW_VALUE_EXACTS = new Set([
  "はい",
  "いいえ",
  "わかりました",
  "了解です",
  "ありがとう",
  "お願いします",
  "大丈夫",
  "特になし",
]);

const LOW_VALUE_PARTS = [
  "テスト",
  "debug",
  "デバッグ",
  "開発用",
  "確認用",
  "仮",
  "サンプル",
  "dummy",
  "undefined",
  "null",
];

function normalizeText(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function normalizeBody(input: unknown): string {
  const text = normalizeText(input);
  if (!text) return "";
  return text.length > MAX_BODY_LENGTH ? text.slice(0, MAX_BODY_LENGTH).trim() : text;
}

function normalizeMemoryType(input: unknown): AutoMemoryCandidate["memory_type"] | null {
  const v = normalizeText(input).toLowerCase();
  if (v === "trait") return "trait";
  if (v === "theme") return "theme";
  if (v === "support_context") return "support_context";
  if (v === "dashboard_signal") return "dashboard_signal";
  return null;
}

function isTooShort(body: string): boolean {
  return body.length < MIN_BODY_LENGTH;
}

function isLowValueExact(body: string): boolean {
  return LOW_VALUE_EXACTS.has(body);
}

function includesLowValuePart(body: string): boolean {
  const lowered = body.toLowerCase();
  return LOW_VALUE_PARTS.some((part) => lowered.includes(part.toLowerCase()));
}

function isDashboardSignalBodyAllowed(body: string): boolean {
  return /^state:[1-5]:/.test(body);
}

function buildDuplicateKey(memoryType: string, body: string): string {
  return `${memoryType}::${body}`.toLowerCase();
}

function collectExistingKeys(args: ShouldPersistAutoMemoryArgs): Set<string> {
  const keys = new Set<string>();

  for (const body of args.existingBodies ?? []) {
    const normalizedBody = normalizeBody(body);
    if (!normalizedBody) continue;
    keys.add(buildDuplicateKey(args.candidate.memory_type, normalizedBody));
  }

  for (const item of args.existingCandidates ?? []) {
    const memoryType = normalizeMemoryType(item?.memory_type);
    const body = normalizeBody(item?.body);
    if (!memoryType || !body) continue;
    keys.add(buildDuplicateKey(memoryType, body));
  }

  return keys;
}

function hasMeaningfulBody(candidate: AutoMemoryCandidate): boolean {
  const body = normalizeBody(candidate.body);

  if (!body) return false;
  if (isTooShort(body)) return false;
  if (isLowValueExact(body)) return false;
  if (includesLowValuePart(body)) return false;

  if (candidate.memory_type === "dashboard_signal") {
    return isDashboardSignalBodyAllowed(body);
  }

  return true;
}

export function shouldPersistAutoMemory(args: ShouldPersistAutoMemoryArgs): boolean {
  const memoryType = normalizeMemoryType(args.candidate.memory_type);
  const body = normalizeBody(args.candidate.body);

  if (!memoryType || !body) return false;
  if (args.candidate.source_type !== "auto") return false;
  if (!hasMeaningfulBody({ ...args.candidate, memory_type: memoryType, body })) return false;

  const existingKeys = collectExistingKeys(args);
  const candidateKey = buildDuplicateKey(memoryType, body);

  // Free β の安定性優先:
  // この層では「語の近さ」で重複とみなさない。
  // 意味・対象・意図が違う候補を落とさないため、完全一致のみを除外する。
  if (existingKeys.has(candidateKey)) return false;

  return true;
}