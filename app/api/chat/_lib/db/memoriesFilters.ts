// /app/api/chat/_lib/db/memoriesFilters.ts
import type {
  MemorySourceType,
  MemoryStatus,
  MemoryType,
  SavedMemory,
} from "../memories/types";
import {
  isMemorySourceType,
  isMemoryStatus,
  isMemoryType,
} from "../memories/types";

export type MemoryItem = {
  content?: string;
  body?: string;
  importance: number; // 1..5
  memory_type?:
    | "trait"
    | "theme"
    | "support_context"
    | "dashboard_signal"
    | "manual_note"
    | null;
};

export type PromptMemoryRow = {
  content: string;
  importance: number;
  source_type: MemorySourceType;
  memory_type: MemoryType;
};

export type RawMemoryRow = Record<string, unknown>;

const JA_GENERIC_NOISE_RULE_1 =
  /目標|ステップ|次に何|やるべき|再確認|大切である|重要である|必要である|考えることが/;
const JA_GENERIC_NOISE_RULE_2 =
  /思考の成長|自己反省|批判的思考|創造(性|力)|成長(とは|は)|人生|成功|習慣|モチベーション/;
const JA_GENERIC_NOISE_RULE_3 = /今日は晴れ|天気が良い|外に出て|散歩して/;
const JA_GENERIC_NOISE_RULE_4 =
  /オープンな対話|対話の場|意見交換|フィードバック機能|グループチャット|ワークショップ|ブレインストーミング|モデレーション|ガイドライン/;

const EN_GENERIC_NOISE_RULE_1 =
  /goal|goals|step|steps|what should i do|important to|need to|must do/;
const EN_GENERIC_NOISE_RULE_2 =
  /personal growth|thinking growth|critical thinking|creativity|motivation|success|habit/;
const EN_GENERIC_NOISE_RULE_3 =
  /weather is nice|today is sunny|go outside|take a walk/;
const EN_GENERIC_NOISE_RULE_4 =
  /open dialogue|community|workshop|brainstorm|moderation|guideline/;

const JA_FORMAT_STYLE_RULE =
  /箇条書き|見出し|markdown|マークダウン|トーン|口調|文体|改行|句読点|絵文字|emoji/;
const EN_FORMAT_STYLE_RULE =
  /bullet|bullets|numbered list|markdown|heading|headings|tone|style|voice|emoji|emojis/;

const JA_FORMAT_LOCKING_RULE =
  /必ず.{0,16}(箇条書き|見出し|markdown|マークダウン|絵文字)/;
const EN_FORMAT_LOCKING_RULE =
  /(always|must).{0,24}(bullet|bullets|markdown|heading|headings|emoji)/;

const JA_WORKFLOW_INSTRUCTION_RULE_1 =
  /してほしい|してください|して下さい|すること|しなさい|貼って|貼るまで|明記して|返して|回答して|確認して|修正して|実行して|進めて/;
const JA_WORKFLOW_INSTRUCTION_RULE_2 = /絶対|必ず|禁止|NG|ルール/;

const EN_WORKFLOW_INSTRUCTION_RULE_1 =
  /(please|must|always|never|do not|don’t|don't|should|need to|required to)/;
const EN_WORKFLOW_INSTRUCTION_RULE_2 =
  /(reply|return|paste|confirm|fix|update|check|run|follow the rule)/;

const JA_WORKFLOW_OPS_WORD_RULE =
  /このチャット|このスレッド|引き継ぎ|新規チャット|ルール違反|差分|diff|フルパス|全文|貼り付け|コピペ|コマンド|cmd|powershell|ターミナル|terminal|エクスプローラー|Dev tool|デブツール|ログ|キャッシュ|再読み込み|F5|next dev|npm|yarn|pnpm/;
const EN_WORKFLOW_OPS_WORD_RULE =
  /in this chat|in this thread|handoff|carry over|new chat|rule violation|diff|full path|paste the full|paste full|copy[- ]?paste|command|cmd|powershell|terminal|devtools|developer tools|log|cache|reload|f5|next dev|npm|yarn|pnpm/;

const SYSTEM_CORE_LIKE_RULE =
  /HOPYは思考のインフラ|思考のインフラ|煽らない|支配しない|決定は委ねる|断定しない|構造を示す|非機能原則|回答定義|存在定義|世界向け|憲法|SYSTEM_CORE/;
const PROJECT_POLICY_LIKE_RULE =
  /差分NG|全文回答|全文貼り付け|フルパス|このチャットを新規チャットに引き継ぎます|現在のフェーズ|やること|何％\/100%中|修正不要/;
const PREFERENCE_LIKE_RULE = /呼び方|呼称|表記|～で呼ばない|おまえ/;
const JA_MEMORY_NARRATION_PREFIX_RULE = /^(?:ユーザーは[、,\s]*)+/;
const EN_MEMORY_NARRATION_PREFIX_RULE =
  /^(?:(?:the )?user(?: is)?[,:]?\s*)+/i;

export function norm(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeMemoryContent(value: unknown): string {
  let text = norm(value);
  if (!text) return "";

  text = text.replace(JA_MEMORY_NARRATION_PREFIX_RULE, "");
  text = text.replace(EN_MEMORY_NARRATION_PREFIX_RULE, "");

  return norm(text);
}

export function clampText(value: unknown, max = 180): string {
  const text = normalizeMemoryContent(value);
  if (!text) return "";
  return text.length > max ? text.slice(0, max) : text;
}

export function clampImportance(value: unknown): number {
  let n = Number(value ?? 0);
  if (!Number.isFinite(n)) n = 1;
  n = Math.trunc(n);
  if (n < 1) n = 1;
  if (n > 5) n = 5;
  return n;
}

export function clampPhaseValue(value: unknown): number | null {
  if (value == null) return null;
  let n = Number(value);
  if (!Number.isFinite(n)) return null;
  n = Math.trunc(n);
  if (n < 1) n = 1;
  if (n > 5) n = 5;
  return n;
}

export function normalizeNullableBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

export function normalizeMemoryType(value: unknown): MemoryType {
  if (isMemoryType(value)) return value;
  return "support_context";
}

export function normalizeSourceType(value: unknown): MemorySourceType {
  if (isMemorySourceType(value)) return value;
  return "auto";
}

export function normalizeStatus(value: unknown): MemoryStatus {
  if (isMemoryStatus(value)) return value;
  return "active";
}

export function mapRowToSavedMemory(row: RawMemoryRow): SavedMemory | null {
  const id = norm(row.id);
  const userId = norm(row.user_id);
  const body = normalizeMemoryContent(row.body ?? row.content);
  const sourceType = normalizeSourceType(row.source_type);
  const memoryType = normalizeMemoryType(row.memory_type);
  const status = normalizeStatus(row.status);
  const createdAt = norm(row.created_at);
  const updatedAt = norm(row.updated_at);

  if (!id || !userId || !body || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    user_id: userId,
    body,
    source_type: sourceType,
    memory_type: memoryType,
    status,
    created_at: createdAt,
    updated_at: updatedAt,
    deleted_at: row.deleted_at == null ? null : norm(row.deleted_at),
    source_message_id:
      row.source_message_id == null ? null : norm(row.source_message_id),
    source_thread_id:
      row.source_thread_id == null ? null : norm(row.source_thread_id),
  };
}

export function dedupeCandidatesKeepMaxImportance(items: MemoryItem[]) {
  const map = new Map<
    string,
    {
      importance: number;
      memory_type: MemoryType;
    }
  >();

  for (const item of items) {
    const content = normalizeMemoryContent(item.content ?? item.body);
    if (!content) continue;

    const importance = clampImportance(item.importance);
    const memoryType = normalizeMemoryType(item.memory_type);
    const prev = map.get(content);

    if (prev == null || importance > prev.importance) {
      map.set(content, {
        importance,
        memory_type: memoryType,
      });
    }
  }

  return Array.from(map.entries()).map(([content, value]) => ({
    content,
    importance: value.importance,
    memory_type: value.memory_type,
  }));
}

export function dedupeByMeaning(
  list: { content: string; importance: number }[],
) {
  const seen = new Set<string>();
  const out: { content: string; importance: number }[] = [];

  for (const item of list) {
    const content = normalizeMemoryContent(item.content);
    if (!content) continue;

    const key = content
      .replace(/常に/g, "")
      .replace(/必ず/g, "")
      .replace(/今後/g, "")
      .replace(/以後/g, "")
      .replace(/\s/g, "");

    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ content, importance: item.importance });
  }

  return out;
}

export function renderSection(
  titleJa: string,
  titleEn: string,
  uiLang: "ja" | "en",
  items: string[],
) {
  if (!items.length) return "";
  const title = uiLang === "en" ? titleEn : titleJa;
  return [title, ...items.map((x) => `- ${x}`)].join("\n");
}

export function dedupePromptRowsKeepMaxImportance(items: PromptMemoryRow[]) {
  const map = new Map<string, PromptMemoryRow>();

  for (const item of items) {
    const content = normalizeMemoryContent(item.content);
    if (!content) continue;

    const prev = map.get(content);
    if (!prev || item.importance > prev.importance) {
      map.set(content, {
        content,
        importance: clampImportance(item.importance),
        source_type: normalizeSourceType(item.source_type),
        memory_type: normalizeMemoryType(item.memory_type),
      });
    }
  }

  return Array.from(map.values());
}

export function buildPromptMemoryRows(rows: RawMemoryRow[]): PromptMemoryRow[] {
  return rows
    .map((row) => {
      const content = normalizeMemoryContent(row.body ?? row.content);
      if (!content) return null;

      return {
        content,
        importance: clampImportance(row.importance ?? 1),
        source_type: normalizeSourceType(row.source_type),
        memory_type: normalizeMemoryType(row.memory_type),
      };
    })
    .filter(Boolean) as PromptMemoryRow[];
}

export function isGenericNoise(
  content: string,
  uiLang: "ja" | "en" = "ja",
) {
  const s = normalizeMemoryContent(content);
  if (!s) return true;

  if (uiLang === "ja") {
    if (JA_GENERIC_NOISE_RULE_1.test(s)) {
      return true;
    }
    if (JA_GENERIC_NOISE_RULE_2.test(s)) {
      return true;
    }
    if (JA_GENERIC_NOISE_RULE_3.test(s)) {
      return true;
    }
    if (JA_GENERIC_NOISE_RULE_4.test(s)) {
      return true;
    }
    return false;
  }

  const sl = s.toLowerCase();
  return (
    EN_GENERIC_NOISE_RULE_1.test(sl) ||
    EN_GENERIC_NOISE_RULE_2.test(sl) ||
    EN_GENERIC_NOISE_RULE_3.test(sl) ||
    EN_GENERIC_NOISE_RULE_4.test(sl)
  );
}

export function isFormatStyleRule(
  content: string,
  uiLang: "ja" | "en",
) {
  const s = normalizeMemoryContent(content);
  if (!s) return true;

  if (uiLang === "ja") {
    return JA_FORMAT_STYLE_RULE.test(s);
  }

  const sl = s.toLowerCase();
  return EN_FORMAT_STYLE_RULE.test(sl);
}

export function isFormatLockingRule(
  content: string,
  uiLang: "ja" | "en",
) {
  const s = normalizeMemoryContent(content);
  if (!s) return false;

  if (uiLang === "ja") {
    return JA_FORMAT_LOCKING_RULE.test(s);
  }

  const sl = s.toLowerCase();
  return EN_FORMAT_LOCKING_RULE.test(sl);
}

export function hasWorkflowInstructionToneJa(s: string) {
  return (
    JA_WORKFLOW_INSTRUCTION_RULE_1.test(s) ||
    JA_WORKFLOW_INSTRUCTION_RULE_2.test(s)
  );
}

export function hasWorkflowInstructionToneEn(s: string) {
  const sl = s.toLowerCase();
  return (
    EN_WORKFLOW_INSTRUCTION_RULE_1.test(sl) ||
    EN_WORKFLOW_INSTRUCTION_RULE_2.test(sl)
  );
}

export function isWorkflowOrDevOpsRule(
  content: string,
  uiLang: "ja" | "en",
) {
  const s = normalizeMemoryContent(content);
  if (!s) return true;

  if (uiLang === "ja") {
    const hasOpsWord = JA_WORKFLOW_OPS_WORD_RULE.test(s);
    if (!hasOpsWord) return false;
    return hasWorkflowInstructionToneJa(s);
  }

  const sl = s.toLowerCase();
  const hasOpsWord = EN_WORKFLOW_OPS_WORD_RULE.test(sl);

  if (!hasOpsWord) return false;
  return hasWorkflowInstructionToneEn(sl);
}

export function isSystemCoreLike(content: string) {
  const s = normalizeMemoryContent(content);
  if (!s) return true;

  return SYSTEM_CORE_LIKE_RULE.test(s);
}

export function isProjectPolicyLike(content: string) {
  const s = normalizeMemoryContent(content);
  if (!s) return true;

  return PROJECT_POLICY_LIKE_RULE.test(s);
}

export function isPreferenceLike(content: string) {
  const s = normalizeMemoryContent(content);
  if (!s) return false;

  return PREFERENCE_LIKE_RULE.test(s);
}

export function isPolluted(
  content: string,
  uiLang: "ja" | "en",
) {
  const s = normalizeMemoryContent(content);
  if (!s) return true;

  if (isGenericNoise(s, uiLang)) return true;
  if (isFormatStyleRule(s, uiLang)) return true;
  if (isFormatLockingRule(s, uiLang)) return true;
  if (isWorkflowOrDevOpsRule(s, uiLang)) return true;
  if (isSystemCoreLike(s)) return true;
  if (isProjectPolicyLike(s)) return true;

  return false;
}

export function buildPromptText(params: {
  rows: PromptMemoryRow[];
  uiLang: "ja" | "en";
  limit: number;
}) {
  const { rows, uiLang, limit } = params;

  const cleaned = rows.filter((row) => !isPolluted(row.content, uiLang));

  const pref = cleaned.filter((row) => isPreferenceLike(row.content));

  const other = cleaned
    .filter((row) => !isPreferenceLike(row.content))
    .filter((row) => row.importance >= 3);

  const pref2 = dedupeByMeaning(pref).slice(0, 10);
  const other2 = dedupeByMeaning(other).slice(
    0,
    Math.max(4, Math.min(10, limit)),
  );

  let fallback: { content: string; importance: number }[] = [];
  if (!pref2.length && !other2.length) {
    fallback = dedupeByMeaning(cleaned).slice(
      0,
      Math.max(2, Math.min(6, limit)),
    );
  }

  const blocks: string[] = [];

  const prefLines = pref2.map((x) => x.content);
  const otherLines = other2.map((x) => x.content);

  const block1 = renderSection("嗜好（固定）", "PREFERENCES", uiLang, prefLines);
  const block2 = renderSection(
    "ユーザー情報（恒久）",
    "USER CONTEXT",
    uiLang,
    otherLines,
  );

  if (block1) blocks.push(block1);
  if (block2) blocks.push(block2);

  if (!blocks.length && fallback.length) {
    blocks.push(
      renderSection(
        "記憶（抽出）",
        "MEMORIES",
        uiLang,
        fallback.map((x) => x.content),
      ),
    );
  }

  return blocks.filter(Boolean).join("\n\n");
}

/*
このファイルの正式役割
MEMORIES本文の正規化・汚染判定・重複除去・プロンプト用整形を担うフィルタ層。
*/

/*
【今回このファイルで修正したこと】
MEMORY本文先頭の「ユーザーは / The user is」を落とす normalizeMemoryContent を追加し、
保存表示・重複除去・prompt行生成・汚染判定の入口でこの正規化を通すように修正。
*/

// /app/api/chat/_lib/db/memoriesFilters.ts