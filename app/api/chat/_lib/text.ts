// /app/api/chat/_lib/text.ts
export type Lang = "ja" | "en";

export function normalizeLang(x: any): Lang {
  const s = String(x ?? "").toLowerCase().trim();
  return s === "en" ? "en" : "ja";
}

export function clampText(s: string, max = 8000) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) : t;
}

/**
 * ✅ Ensure at most ONE question mark in the entire reply.
 * - keeps the first "?" or "？"
 * - removes any further question marks (even if they are on the same line)
 * - additionally drops any later lines that still contain question marks
 */
export function enforceMaxOneQuestion(reply: string) {
  const s = String(reply ?? "").trim();
  if (!s) return s;

  const firstIdx = s.search(/[？\?]/);
  if (firstIdx < 0) return s;

  // keep up to and including the first question mark
  const head = s.slice(0, firstIdx + 1);
  let tail = s.slice(firstIdx + 1);

  // drop later lines that contain question marks (avoid question-bombing)
  tail = tail
    .split("\n")
    .filter((line) => !/[？\?]/.test(line))
    .join("\n");

  // just in case, remove any remaining question marks in tail
  tail = tail.replace(/[？\?]/g, "");

  const out = `${head}${tail}`.trim();
  return out || s;
}

export function capReplyLen(reply: string, uiLang: Lang) {
  const s = String(reply ?? "").trim();
  if (!s) return s;

  const maxCharsJa = envIntCompat("HOPY_MAX_CHARS_JA", 1200);
  const maxCharsEn = envIntCompat("HOPY_MAX_CHARS_EN", 1600);
  const max = uiLang === "ja" ? maxCharsJa : maxCharsEn;

  if (s.length <= max) return s;

  // ✅ Phase1: safe truncation
  // - avoid breaking markdown/code blocks
  // - keep output readable & stable
  let cut = s.slice(0, max).trimEnd();

  // If we cut inside a fenced code block, close it.
  // Count occurrences of ``` (including ```ts, ```js, etc.)
  const fenceCount = (cut.match(/```/g) ?? []).length;
  if (fenceCount % 2 === 1) {
    cut = `${cut}\n\`\`\``;
  }

  // Avoid ending with a dangling single backtick
  // (rare, but can happen if user/assistant uses inline code)
  if (/`$/.test(cut) && !/``$/.test(cut)) {
    cut = cut.replace(/`+$/, "").trimEnd();
  }

  // Ensure clean ending
  cut = cut.replace(/\s+$/g, "").trimEnd();

  return `${cut}\n…`.trim();
}

// envInt をここで使いたいが循環importを避けるため軽量実装
function envIntCompat(name: string, fallback: number) {
  const raw = String(process.env[name] ?? "").trim();
  if (!raw) return fallback;

  const v = Number(raw);
  if (!Number.isFinite(v)) return fallback;

  const n = Math.trunc(v);

  // ✅ 0 も有効値として扱う（OFF/無効化に使える）
  return n >= 0 ? n : fallback;
}