// /app/api/chat/_lib/memory/heuristic.ts
import type { Lang } from "../text";
import type { MemoryItem } from "../db/memories";

/**
 * Deterministic heuristic extractor for durable memories.
 *
 * Source-of-truth policy:
 * - Prefer HOPY's final answer confirmed meaning when available.
 * - Do NOT treat raw user wording as the source of truth.
 * - Memories are only one destination of HOPY-confirmed meaning.
 *
 * Goal:
 * - capture ONLY user-specific, durable memories
 * - never save chat logs verbatim
 * - keep extraction conservative for beta stability
 *
 * Hard exclusions (never store):
 * - Output format/style rules
 * - Chat/workflow/dev-operation rules
 * - Generic self-help / non-user-specific statements
 * - Product/system architecture / HOPY dev definitions
 * - One-off feelings / transient facts / temporary tasks
 *
 * Constraints:
 * - 0..3 items
 * - content <= 120 chars (trimmed)
 * - importance: 3 (preference) / 4 (rule) / 5 (hard constraint)
 */

function trimTo(s: string, max = 120) {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : t.slice(0, max).trimEnd();
}

function splitSentencesJa(s: string): string[] {
  return String(s ?? "")
    .split(/[\n。！？!?]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function splitSentencesEn(s: string): string[] {
  return String(s ?? "")
    .split(/[\n.!?]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function uniqPush(out: MemoryItem[], item: MemoryItem) {
  const key = item.content;
  if (!key) return;
  if (out.some((x) => x.content === key)) return;
  out.push(item);
}

/**
 * Output-format/style rules are NOT durable user memories.
 */
function isFormatStyleRule(line: string, uiLang: Lang): boolean {
  const s = String(line ?? "").trim();
  if (!s) return false;

  if (uiLang === "ja") {
    return /箇条書き|見出し|markdown|マークダウン|トーン|口調|敬語|タメ口|ですます|だ・である|文体|改行|句読点|絵文字|emoji/.test(
      s
    );
  }

  const sl = s.toLowerCase();
  return /bullet|bullets|numbered list|markdown|heading|headings|tone|style|voice|polite|casual|emoji|emojis/.test(
    sl
  );
}

/**
 * If the line tries to "lock" output format ("always bullets"), skip it.
 */
function isFormatLockingRule(line: string, uiLang: Lang): boolean {
  const s = String(line ?? "").trim();
  if (!s) return false;

  if (uiLang === "ja") {
    return /必ず.{0,16}(箇条書き|見出し|markdown|マークダウン|絵文字)/.test(s);
  }

  const sl = s.toLowerCase();
  return /(always|must).{0,24}(bullet|bullets|markdown|heading|headings|emoji)/.test(
    sl
  );
}

/**
 * Chat/workflow/dev-operation rules are NOT durable user memories.
 */
function isWorkflowOrDevOpsRule(line: string, uiLang: Lang): boolean {
  const s = String(line ?? "").trim();
  if (!s) return false;

  if (uiLang === "ja") {
    return /このチャットでは|このスレッドでは|本チャット|引き継ぎ|新規チャット|ルール違反|手順|差分|diff|フルパス|全文|貼(って|り付け)|コピペ|コマンド|cmd|PowerShell|ターミナル|terminal|エクスプローラー|Dev tool|デブツール|ログ|キャッシュ|再読み込み|F5|ビルド/.test(
      s
    );
  }

  const sl = s.toLowerCase();
  return /in this chat|in this thread|handoff|carry over|new chat|rule violation|steps|no diff|diff|full path|paste (the )?full|copy[- ]?paste|command|cmd|powershell|terminal|devtools|developer tools|log|cache|reload|f5|build/.test(
    sl
  );
}

/**
 * Generic self-help / non-user-specific statements are NOT durable user memories.
 */
function isGenericNonUserSpecific(line: string, uiLang: Lang): boolean {
  const s = String(line ?? "").trim();
  if (!s) return true;

  if (uiLang === "ja") {
    if (
      /必要である|大切である|重要である|不可欠である|望ましい|べきである|すべき/.test(s)
    )
      return true;

    if (
      /思考の成長|自己反省|批判的思考|創造(性|力)|成長(とは|は)|人生|成功|習慣|モチベーション|目標|ステップ|やるべき|次に何/.test(
        s
      )
    )
      return true;

    if (/今日は晴れ|天気が良い|今日は(良い|悪い)日|外に出て/.test(s)) return true;

    return false;
  }

  const sl = s.toLowerCase();

  if (/need to|must|should|it is important|it is necessary/.test(sl)) return true;

  if (
    /personal growth|success|life|motivation|habit|goals|critical thinking|creativity|thinking growth/.test(
      sl
    )
  )
    return true;

  if (/weather is nice|today is sunny|go outside/.test(sl)) return true;

  return false;
}

/**
 * System/core/product definitions are NOT USER_MEMORY.
 */
function isSystemOrProductCoreLike(line: string, uiLang: Lang): boolean {
  const s = String(line ?? "").trim();
  if (!s) return true;

  if (uiLang === "ja") {
    return /SYSTEM_CORE|世界向け|憲法|存在定義|回答定義|非機能原則|HOPYは思考のインフラ|思考のインフラ|開発用語|実装都合|MEMORIES仕様|DB最小定義/.test(
      s
    );
  }

  const sl = s.toLowerCase();
  return /system_core|constitution|world[- ]?ready|core definition|you are hopy|thinking infrastructure|development term|implementation detail|memories spec|db definition/.test(
    sl
  );
}

/**
 * Temporary feelings / one-off status are NOT durable memories.
 */
function isTransientStateLike(line: string, uiLang: Lang): boolean {
  const s = String(line ?? "").trim();
  if (!s) return true;

  if (uiLang === "ja") {
    return /今日|今|さっき|今回|この瞬間|一時的|少し|ちょっと|疲れた|眠い|つらい|しんどい|落ち込んでいる|不安だ|うれしい|悲しい|むかつく/.test(
      s
    );
  }

  const sl = s.toLowerCase();
  return /today|right now|just now|this time|temporary|a bit|tired|sleepy|sad|upset|anxious|happy|angry|stressed/.test(
    sl
  );
}

/**
 * Durable hints
 */
function looksDurableJa(line: string) {
  return /今後|以後|固定|禁止|必ず|使わない|使用しない|表記|不変|絶対|二度と|長期|継続/.test(
    line
  );
}

function looksDurableEn(line: string) {
  return /from now on|going forward|always|never|prefer|must|fixed|do not|don't call me|long-term|ongoing/.test(
    line.toLowerCase()
  );
}

function importanceJa(line: string): number {
  if (/禁止|使わない|使用しない|必ず|不変|絶対|二度と/.test(line)) return 5;
  if (/固定|今後|以後|長期|継続/.test(line)) return 4;
  if (/希望|好み|呼んで|呼称|表記/.test(line)) return 3;
  return 3;
}

function importanceEn(line: string): number {
  const s = line.toLowerCase();
  if (/never|must|do not|don't|absolute/.test(s)) return 5;
  if (/fixed|always|going forward|from now on|long-term|ongoing/.test(s)) return 4;
  if (/prefer|call me|naming|spelling/.test(s)) return 3;
  return 3;
}

function extractFromRaw(params: {
  uiLang: Lang;
  raw: string;
  maxItems: number;
}): MemoryItem[] {
  const { uiLang, raw, maxItems } = params;
  const lines = uiLang === "en" ? splitSentencesEn(raw) : splitSentencesJa(raw);

  const out: MemoryItem[] = [];

  for (const line of lines) {
    if (out.length >= maxItems) break;

    if (isFormatStyleRule(line, uiLang)) continue;
    if (isFormatLockingRule(line, uiLang)) continue;
    if (isWorkflowOrDevOpsRule(line, uiLang)) continue;
    if (isSystemOrProductCoreLike(line, uiLang)) continue;
    if (isGenericNonUserSpecific(line, uiLang)) continue;
    if (isTransientStateLike(line, uiLang)) continue;

    if (uiLang === "ja") {
      if (!looksDurableJa(line)) continue;
      const content = trimTo(line, 120);
      if (!content) continue;
      uniqPush(out, { content, importance: importanceJa(line) });
    } else {
      if (!looksDurableEn(line)) continue;
      const content = trimTo(line, 120);
      if (!content) continue;
      uniqPush(out, { content, importance: importanceEn(line) });
    }
  }

  return out.slice(0, Math.max(0, Math.min(3, maxItems)));
}

export function extractHeuristicMemories(params: {
  uiLang: Lang;
  userText: string;
  assistantText?: string | null;
  maxItems?: number;
}): MemoryItem[] {
  const { uiLang, userText, assistantText, maxItems = 2 } = params;

  const normalizedMaxItems = Math.max(0, Math.min(3, maxItems));

  const assistantRaw = String(assistantText ?? "").trim();
  if (assistantRaw) {
    const assistantOnly = extractFromRaw({
      uiLang,
      raw: assistantRaw,
      maxItems: normalizedMaxItems,
    });
    if (assistantOnly.length > 0) return assistantOnly;
  }

  const userRaw = String(userText ?? "").trim();
  if (!userRaw) return [];

  return extractFromRaw({
    uiLang,
    raw: userRaw,
    maxItems: normalizedMaxItems,
  });
}