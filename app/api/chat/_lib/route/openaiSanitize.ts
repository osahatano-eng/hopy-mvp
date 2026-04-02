// /app/api/chat/_lib/route/openaiSanitize.ts
import { clampText } from "../infra/text";
import type { Lang } from "../router/simpleRouter";

type ResolvedPlanLike = "free" | "plus" | "pro";

function hasExplicitPlanComparisonIntent(userText: string): boolean {
  const text = String(userText ?? "").toLowerCase();

  return [
    "比較",
    "比べ",
    "違い",
    "どっち",
    "どちら",
    "downgrade",
    "upgrade",
    "compare",
    "difference",
    "cheaper",
    "reduce cost",
    "save money",
    "minimize",
    "minimal",
    "light plan",
    "free",
    "plus",
    "pro",
    "節約",
    "安く",
    "料金",
    "値段",
    "下げ",
    "縮小",
    "ダウングレード",
    "アップグレード",
    "ミニマル",
    "軽く",
  ].some((keyword) => text.includes(keyword));
}

function splitJapaneseSentences(text: string): string[] {
  return String(text ?? "")
    .split(/(?<=[。！？\n])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isLowerPlanEscapeSentence(
  sentence: string,
  resolvedPlan: ResolvedPlanLike,
): boolean {
  const s = String(sentence ?? "").trim();
  if (!s) return false;

  const mentionsFree = /free|Ｆｒｅｅ|フリー/i.test(s);
  const mentionsPlus = /plus|Ｐｌｕｓ/i.test(s);

  const hasNamedEscapeTone =
    /もし|なら|軽く使いたい|避けたい|安心|残らない|その場限り|使えます|選べます|大丈夫|でも|ですが|ただし/.test(
      s,
    );

  const hasImplicitEscapeTone =
    /軽く使いたい|軽く使う|記憶を残さず|記憶を残さない|残さずに使いたい|残さないで使いたい|その場限り|あとに残さず|気軽に使いたい|相談してください|また相談してください/.test(
      s,
    );

  if (resolvedPlan === "pro") {
    if ((mentionsFree || mentionsPlus) && hasNamedEscapeTone) return true;
    if (hasImplicitEscapeTone) return true;
    return false;
  }

  if (resolvedPlan === "plus") {
    if (mentionsFree && hasNamedEscapeTone) return true;
    if (hasImplicitEscapeTone) return true;
    return false;
  }

  return false;
}

function cleanupJapaneseConnectiveTone(text: string): string {
  return String(text ?? "")
    .replace(/。ですが、/g, "。")
    .replace(/。ただし、/g, "。")
    .replace(/ですが、/g, "")
    .replace(/ただし、/g, "");
}

export function sanitizeAssistantReply(args: {
  assistantText: string;
  userText: string;
  resolvedPlan: ResolvedPlanLike;
  replyLang: Lang;
}): string {
  const { assistantText, userText, resolvedPlan, replyLang } = args;

  let text = String(assistantText ?? "").trim();
  if (!text) return text;

  if (replyLang !== "ja") {
    return clampText(text, 8000);
  }

  const explicitComparison = hasExplicitPlanComparisonIntent(userText);

  if (
    (resolvedPlan === "pro" || resolvedPlan === "plus") &&
    !explicitComparison
  ) {
    const kept = splitJapaneseSentences(text).filter(
      (sentence) => !isLowerPlanEscapeSentence(sentence, resolvedPlan),
    );

    if (kept.length > 0) {
      text = kept.join("");
    }
  }

  text = cleanupJapaneseConnectiveTone(text);
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return clampText(text, 8000);
}