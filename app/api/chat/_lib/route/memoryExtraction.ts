// /app/api/chat/_lib/route/memoryExtraction.ts
import { extractFirstJsonObject } from "../infra/text";
import type { Lang } from "../router/simpleRouter";

type MemoryItem = {
  content: string;
  importance: number;
  memory_type: "trait" | "theme" | "support_context" | "dashboard_signal";
};

export function memoryExtractionSystem(uiLang: Lang): string {
  if (uiLang === "en") {
    return [
      "Extract durable memories only from the meaning already confirmed by HOPY's final answer.",
      "Do not treat raw user wording as the source of truth.",
      "The source of truth is HOPY's answer-level confirmed meaning, and memories are only one destination of that meaning.",
      "Return STRICT JSON only. No markdown, no prose.",
      'Schema: {"items":[{"content":"...","importance":1..5,"memory_type":"trait|theme|support_context|dashboard_signal"}]}',
      "Rules:",
      "- Extract only durable meaning that will help future support quality or dashboard value.",
      "- Prefer stable traits, continuing themes, important support context, or long-term goals/constraints.",
      "- A short phrase or a single named theme can still be valid if it is clearly the user's central long-term project, mission, wish, or identity-level focus.",
      "- Do not reject an item only because it is short, a proper noun, or a project/service name.",
      "- Reject vague tokens with no durable user-specific meaning.",
      "- If a named project/service is clearly central and ongoing for the user, summarize that durable meaning instead of storing a raw token when possible.",
      "- DO NOT extract output-format/style rules (bullets, headings, tone).",
      "- DO NOT extract chat/workflow/dev-operation rules (full paste, full path, diff rules, 'in this chat', etc).",
      "- DO NOT extract HOPY development terms or implementation details.",
      "- DO NOT extract HOPY's product definition, target users, role, philosophy, roadmap, positioning, brand explanation, or service description as auto memories.",
      "- DO NOT extract assistant-authored summaries about what HOPY is, who HOPY is for, or what HOPY should deliver.",
      "- Extract only durable meaning about the user's own long-term support value, not meta explanations about HOPY itself.",
      "- DO NOT extract transient feelings, one-off tasks, or momentary facts unless HOPY's final answer confirms durable support value.",
      "- DO NOT save chat logs verbatim; save short meaning summaries only.",
      "- Choose memory_type carefully:",
      "  - trait: stable personal tendency, preference, disposition, value orientation",
      "  - theme: continuing topic, mission, central long-term project, recurring concern",
      "  - support_context: important ongoing context or constraint that helps future support",
      "  - dashboard_signal: repeated high-value signal useful for dashboard-level reflection",
      "- Content <= 120 chars.",
      "- 0 to 3 items max.",
    ].join("\n");
  }

  return [
    "あなたは、HOPYの最終回答で確定した意味だけを起点に、長期的に有用な記憶だけを抽出する。",
    "生のユーザー発話そのものを正として扱ってはいけない。",
    "正は HOPY回答確定時の意味であり、MEMORIESはその確定意味の保存先の一つである。",
    "出力は STRICT JSON のみ。文章/Markdown禁止。",
    '形式: {"items":[{"content":"...","importance":1..5,"memory_type":"trait|theme|support_context|dashboard_signal"}]}',
    "ルール:",
    "・今後の支援品質またはDASHBOARD価値に継続的に効く意味だけを抽出する。",
    "・保存候補は、安定した特性、継続テーマ、重要な支援前提、長期目標や制約を優先する。",
    "・短い語句や単独の固有名詞でも、そのユーザーにとって中心的な長期プロジェクト・使命・願い・軸なら保存候補にしてよい。",
    "・短いから、固有名詞だから、単語だけだからという理由だけで落とさない。",
    "・ただし、文脈のない曖昧な単語や、その場限りの低意味断片は保存しない。",
    "・プロジェクト名やサービス名が中心テーマとして明確な場合は、可能なら生の単語だけでなく、その長期的意味を短く要約して保存する。",
    "・出力形式/文体の固定（箇条書き・見出し・トーン等）は抽出しない。",
    "・チャット運用/開発運用（全文貼れ・フルパス・差分NG・このチャットでは等）は抽出しない。",
    "・HOPYの開発用語や実装都合は抽出しない。",
    "・HOPYそのものの定義、対象ユーザー、役割、思想、ロードマップ、立ち位置、ブランド説明、サービス説明は Auto MEMORIES に抽出しない。",
    "・HOPYとは何か、誰のためのものか、何を届けるか、のような助手側の整理文は抽出しない。",
    "・抽出対象は、HOPY自体の説明ではなく、そのユーザー本人の今後の支援価値に継続して効く意味だけに限定する。",
    "・一時的な感情断片、単発タスク、その場限りの事実は、HOPY最終回答で継続価値が確定していない限り抽出しない。",
    "・会話ログをそのまま保存せず、短い意味要約だけを保存する。",
    "・memory_type は慎重に選ぶ。",
    "  - trait: 安定した傾向・嗜好・価値観・性質",
    "  - theme: 継続テーマ・中心プロジェクト・長期的な願い・繰り返し出る関心",
    "  - support_context: 今後の支援に必要な継続前提・制約・背景",
    "  - dashboard_signal: DASHBOARD反映価値の高い継続シグナル",
    "・contentは短く（120字以内）。",
    "・最大3件、0件も可。",
  ].join("\n");
}

function normalizeMemoryType(
  v: any
): "trait" | "theme" | "support_context" | "dashboard_signal" {
  const s = String(v ?? "").trim();
  if (
    s === "trait" ||
    s === "theme" ||
    s === "support_context" ||
    s === "dashboard_signal"
  ) {
    return s;
  }
  return "support_context";
}

function toMemoryItem(it: any): MemoryItem | null {
  const content = String(it?.content ?? it?.body ?? "").trim();
  let importance = Number(it?.importance ?? 0);
  const memory_type = normalizeMemoryType(it?.memory_type);

  if (!content) return null;
  if (!Number.isFinite(importance)) importance = 1;

  importance = Math.max(1, Math.min(5, Math.trunc(importance)));
  return { content, importance, memory_type };
}

export function safeParseMemoryItems(raw: string): { items: MemoryItem[]; parse_ok: boolean } {
  const s = String(raw ?? "").trim();
  if (!s) return { items: [], parse_ok: true };

  try {
    const obj: any = JSON.parse(s);
    const arr = Array.isArray(obj?.items) ? obj.items : [];
    const out: MemoryItem[] = [];

    for (const it of arr) {
      const item = toMemoryItem(it);
      if (!item) continue;

      out.push(item);
      if (out.length >= 3) break;
    }

    return { items: out, parse_ok: true };
  } catch {
    const clipped = extractFirstJsonObject(s);
    if (!clipped) return { items: [], parse_ok: false };

    try {
      const obj: any = JSON.parse(clipped);
      const arr = Array.isArray(obj?.items) ? obj.items : [];
      const out: MemoryItem[] = [];

      for (const it of arr) {
        const item = toMemoryItem(it);
        if (!item) continue;

        out.push(item);
        if (out.length >= 3) break;
      }

      return { items: out, parse_ok: false };
    } catch {
      return { items: [], parse_ok: false };
    }
  }
}

/*
このファイルの正式役割:
memory 抽出結果の system prompt 生成と、抽出JSONの安全パースを行う専用ファイル

【今回このファイルで修正したこと】
../db/memories から export されていない MemoryItem の import を削除しました。
このファイル内で safeParseMemoryItems に必要な最小限の MemoryItem 型を定義しました。
memory 抽出文面と JSON パースの実行ロジック自体は変更していません。
*/