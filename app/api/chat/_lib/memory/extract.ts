// /app/api/chat/_lib/memory/extract.ts
import type { Lang } from "../text";
import { getOpenAI, getModelName } from "../openai";
import type { MemoryItem } from "../db/memories";

// Phase1 stability: sanitize assistant/user text for memory extraction
function sanitizeForMemory(s: string): string {
  let t = String(s ?? "").trim();
  if (!t) return "";

  // remove tone tags that are UI-facing (avoid storing them as "memories")
  // NOTE: not only at the start; guard anywhere (model drift)
  t = t.replace(/\[(calm|stability|growth)\]\s*\n?/gi, "");

  // remove accidental angle tag (should not be present, but guard anyway)
  // NOTE: guard anywhere (not only at the start)
  t = t.replace(/\(angle:[^)]+\)\s*\n?/gi, "");

  // normalize excessive blank lines
  t = t.replace(/\n{3,}/g, "\n\n").trim();

  return t;
}

// Phase1 stability: small normalizer for dedupe key
function normalizeKey(s: string): string {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[　]/g, " ")
    .toLowerCase();
}

export async function extractMemoriesFromTurn(params: {
  uiLang: Lang;
  userText: string;
  assistantText: string;
}): Promise<{ ok: boolean; items: MemoryItem[]; error?: any }> {
  const { uiLang, userText, assistantText } = params;

  const sys =
    uiLang === "en"
      ? [
          "You are a memory extractor for a personal AI called HOPY.",
          "Extract long-term memories from the conversation.",
          "Return ONLY JSON with the following shape:",
          '{ "items": [ { "content": string, "importance": number } ] }',
          "Rules:",
          "- content must be one short sentence (max 120 chars).",
          "- importance is 1..5 (5 = extremely important for future).",
          "- Only store stable preferences, rules, goals, constraints, identity facts, and persistent projects.",
          "- Do NOT store temporary feelings, one-off chat instructions, or random details.",
          '- If nothing is worth storing, return {"items":[]}.',
        ].join("\n")
      : [
          "あなたはHOPYのための「長期記憶抽出器」です。",
          "会話から長期的に役立つ記憶だけを抽出してください。",
          "出力は必ず JSON のみ。形式は次の通り：",
          '{ "items": [ { "content": string, "importance": number } ] }',
          "ルール：",
          "- content は短い1文（120文字以内）。",
          "- importance は 1..5（5が最重要）。",
          "- 安定した嗜好・方針・ルール・目標・制約・恒常的プロジェクトだけを保存。",
          "- 一時的な感情、単発の指示、雑談の細部は保存しない。",
          '- 保存すべきものが無ければ必ず {"items":[]} を返す。',
        ].join("\n");

  const safeUser = sanitizeForMemory(userText);
  const safeAsst = sanitizeForMemory(assistantText);

  const user =
    uiLang === "en"
      ? `Conversation:\nUSER: ${safeUser}\nASSISTANT: ${safeAsst}`
      : `会話:\nUSER: ${safeUser}\nASSISTANT: ${safeAsst}`;

  try {
    const openai = getOpenAI();
    const r = await openai.chat.completions.create({
      model: getModelName(),
      temperature: 0,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" } as any,
    });

    const raw = r.choices?.[0]?.message?.content?.trim() ?? "";
    if (!raw) return { ok: true, items: [] };

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Phase1 stability: never fail the whole pipeline due to extractor format drift
      return { ok: true, items: [] };
    }

    const itemsRaw = Array.isArray(parsed?.items) ? parsed.items : [];

    const items: MemoryItem[] = itemsRaw
      .map((x: any) => {
        const content = String(x?.content ?? "").trim();
        let importance = Number(x?.importance ?? 0);
        if (!content) return null;
        if (!Number.isFinite(importance)) importance = 0;
        if (importance < 1) importance = 1;
        if (importance > 5) importance = 5;
        const c = content.length > 120 ? content.slice(0, 120) : content;
        return { content: c, importance };
      })
      .filter(Boolean);

    // Deduplicate by normalized content (keep the highest importance)
    const map = new Map<string, MemoryItem>();
    for (const it of items) {
      const key = normalizeKey(it.content);
      if (!key) continue;
      const prev = map.get(key);
      if (!prev || (it.importance ?? 0) > (prev.importance ?? 0)) {
        map.set(key, it);
      }
    }

    return { ok: true, items: Array.from(map.values()) };
  } catch (e: any) {
    // ✅ 観測できる失敗として返す（本体は route.ts が握りつぶして続行できる）
    return { ok: false, items: [], error: e };
  }
}
