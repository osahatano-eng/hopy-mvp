// /app/api/chat/_lib/memory/governance.ts
import type { Lang } from "../text";
import { envInt } from "../env";
import type { MemoryItem } from "../db/memories";

export function normalizeMemoryText(s: string) {
  return String(s ?? "")
    .trim()
    .replace(/[　]/g, " ")
    .replace(/\s+/g, " ");
}

export function isHardRejectMemory(content: string, uiLang: Lang) {
  const s = normalizeMemoryText(content);
  if (!s) return true;

  const noSpace = s.replace(/\s/g, "");
  if (!noSpace) return true;

  // ---- Reject: pure symbols/punct only ----
  try {
    if (/^[\p{P}\p{S}]+$/u.test(noSpace)) return true;
  } catch {
    if (/^[\-\+\=\*\#\@\!\?\.\,\:\;\(\)\[\]\{\}\/\\]+$/.test(noSpace)) return true;
  }

  // ---- Reject: numbers only / too short ----
  if (/^[0-9]+$/.test(noSpace)) return true;
  if (noSpace.length <= 2) return true;

  // ---- Reject: internal tags / debug lines / extractor labels ----
  // UI tone tags
  if (/^\[(calm|stability|growth)\]$/i.test(s)) return true;
  if (/^\[(calm|stability|growth)\]/i.test(s)) return true;

  // angle tags / labels (never store)
  if (/^\(angle:[^)]+\)$/i.test(s)) return true;
  if (/^\(angle:[^)]+\)/i.test(s)) return true;
  if (/\bangle\s*:/i.test(s)) return true;

  // internal state line (never store)
  if (/^state:\s*phase=/i.test(s)) return true;
  if (/^状態:\s*phase=/i.test(s)) return true;

  // extractor conversation labels
  if (/^(conversation:|会話:)\s*/i.test(s)) return true;
  if (/^(user:|assistant:)\s*/i.test(s)) return true;

  // ---- Reject: code-like snippets (Phase1 stability: do not store code lines) ----
  // (Project rules/constraints should be stored as text rules, not code fragments.)
  if (
    /(^|\s)(import|export|const|let|var|function|class|type|interface)\b/.test(s) ||
    /=>/.test(s) ||
    /{.*}/.test(s) ||
    /<\/?[a-z][^>]*>/i.test(s)
  ) {
    // allow exceptions later via hard-allow keys (policy text), but code itself is not a memory
    // If it contains hard-allow keywords, it still shouldn't be code.
    // So reject here unconditionally.
    return true;
  }

  const jaAck = ["はい","了解","りょうかい","おけ","オケ","ありがとう","すごい","最高","いいね","うん","わかった","助かる"];
  const enAck = ["ok","okay","thanks","thank you","got it","cool","nice"];

  const lower = s.toLowerCase();
  if (uiLang === "ja") {
    if (jaAck.includes(s)) return true;
  } else {
    if (enAck.includes(lower)) return true;
  }

  const jaOps = ["次","続け","戻して","やって","入れて","消して","直して"];
  const enOps = ["next","continue","undo","fix","delete","add"];
  if (uiLang === "ja") {
    if (jaOps.includes(s)) return true;
  } else {
    if (enOps.includes(lower)) return true;
  }

  return false;
}

export function isHardAllowMemory(content: string, uiLang: Lang) {
  const s = normalizeMemoryText(content);
  const lower = s.toLowerCase();

  const jaKeys = [
    "今後","ルール","方針","固定","採用","禁止","必須","覚えて","記憶","全文","差分","末尾に追記","末尾","追記",
    "階層","パス","推測しない","デグレード","レスポンシブ","世界基準","安心感",
  ];

  const enKeys = [
    "from now on","rule","policy","always","never","must","do not","remember","full code","no diff",
    "append at end","path","responsive","world-class","safety",
  ];

  if (uiLang === "ja") return jaKeys.some((k) => s.includes(k));
  return enKeys.some((k) => lower.includes(k));
}

export function isGenericMemoryByLength(content: string, uiLang: Lang) {
  const s = normalizeMemoryText(content);
  const noSpace = s.replace(/\s/g, "");

  const minLenJa = envInt("MEMORY_MIN_LEN_JA", 12);
  const minLenEn = envInt("MEMORY_MIN_LEN_EN", 20);
  const minLen = uiLang === "ja" ? minLenJa : minLenEn;

  return noSpace.length < minLen;
}

export function postFilterMemories(items: MemoryItem[], uiLang: Lang) {
  const out: MemoryItem[] = [];
  const seen = new Set<string>();

  const minImportance = envInt("MEMORY_MIN_IMPORTANCE", 3);
  const maxPerTurn = envInt("MEMORY_MAX_PER_TURN", 4);

  for (const it of items) {
    const content = normalizeMemoryText(it.content);
    let importance = Math.max(1, Math.min(5, Number(it.importance || 1)));

    if (!content) continue;
    if (isHardRejectMemory(content, uiLang)) continue;

    const hardAllow = isHardAllowMemory(content, uiLang);
    if (hardAllow) {
      importance = Math.max(importance, minImportance);
    }

    if (!hardAllow && importance < minImportance) continue;
    if (!hardAllow && isGenericMemoryByLength(content, uiLang)) continue;

    const key = content.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ content, importance });
    if (out.length >= maxPerTurn) break;
  }

  return out;
}
