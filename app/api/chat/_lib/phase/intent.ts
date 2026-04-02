// /app/api/chat/_lib/phase/intent.ts
import type { Lang } from "../text";

/**
 * ConversationKind
 * - build: 制作/構築/実装/不具合対応（= 手を動かすモード。開発者専門の意味ではない）
 * - planning: 設計/優先/手順/次の進め方
 * - emotion: 感情（怒り/不安/落ち込み）
 * - casual: 雑談（食べ物/動物/日常）
 * - meta: HOPYそのもの/方針/人格/品質/つまらない等のメタ
 *
 * NOTE:
 * angle（角度）ロジックは system.ts に統合済み。
 * このファイルは「分類」専用にする（責務分離 / Phase1安定）。
 */
export type ConversationKind = "build" | "planning" | "emotion" | "casual" | "meta";

function hasAny(s: string, keys: string[]) {
  return keys.some((k) => s.includes(k));
}

export function detectConversationKind(text: string, uiLang: Lang): ConversationKind {
  const raw = String(text ?? "");
  const s = raw.toLowerCase();

  // --- meta (品質・単調・人格・方針など) ---
  // ✅ Phase1 stability: meta を最優先（"全文" 等の運用語で build に吸われない）
  const metaJa = [
    "つまらない",
    "同じ",
    "同じ回答",
    "繰り返",
    "単調",
    "似た",
    "飽き",
    "品質",
    "人格",
    "思考",
    "方針",
    "ルール",
    "hopy",
    "あなたは",
  ];
  const metaEn = [
    "boring",
    "same",
    "repeating",
    "repetitive",
    "monotone",
    "quality",
    "persona",
    "style",
    "policy",
    "rules",
    "hopy",
    "you are",
  ];
  if (uiLang === "ja" ? hasAny(s, metaJa) : hasAny(s, metaEn)) return "meta";

  // --- emotion ---
  const emoJa = [
    "ふざけ",
    "むかつ",
    "最悪",
    "不安",
    "こわ",
    "怖",
    "つら",
    "辛",
    "しんど",
    "無理",
    "悲",
    "泣",
  ];
  const emoEn = [
    "angry",
    "pissed",
    "mad",
    "worried",
    "anxious",
    "panic",
    "sad",
    "hopeless",
    "stressed",
  ];
  if (uiLang === "ja" ? hasAny(s, emoJa) : hasAny(s, emoEn)) return "emotion";

  // --- planning ---
  // ✅ "全文/修正/追加" は build ではなく planning（進め方の合図）として扱う
  const planJa = [
    "次",
    "手順",
    "設計",
    "工数",
    "やること",
    "優先",
    "計画",
    "todo",
    "ロードマップ",
    "全文",
    "修正",
    "追加",
    "差分",
    "分割",
  ];
  const planEn = [
    "next",
    "steps",
    "design",
    "plan",
    "priority",
    "roadmap",
    "todo",
    "estimate",
    "full",
    "diff",
    "split",
  ];
  if (uiLang === "ja" ? hasAny(s, planJa) : hasAny(s, planEn)) return "planning";

  // --- build (hands-on / making / fixing) ---
  // ※「開発者向け」ではなく、制作・構築・実装・修正を検知して返し方を変えるため
  // ✅ Phase1 stability: 曖昧語 "api"/"db" 単体は弱いので、より明確な手掛かりに寄せる
  const buildHints = [
    // code-ish
    "import ",
    "export ",
    "function ",
    "const ",
    "let ",
    "var ",
    "return ",
    "=>",

    // file-ish
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    "route.ts",
    "route.js",
    "package.json",
    ".env",

    // framework/service
    "next.js",
    "supabase",

    // errors/build/deploy
    "error",
    "stack",
    "build",
    "compile",
    "deploy",
    "エラー",
    "不具合",
    "バグ",

    // api/db more specific
    "/api/",
    " api ",
    " db ",
  ];
  if (hasAny(s, buildHints)) return "build";

  // --- default ---
  return "casual";
}
