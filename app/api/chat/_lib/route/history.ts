// /app/api/chat/_lib/route/history.ts
import type { DbChatRow } from "../context/loadRecentConversationMessages";

type HistoryRow = {
  role: "user" | "assistant";
  content: string;
};

type ResolvedPlanLike = "free" | "plus" | "pro";

const FREE_HISTORY_MAX_ITEMS = 6;
const PLUS_HISTORY_MAX_ITEMS = 14;
const PRO_HISTORY_MAX_ITEMS = 24;

function normalizeHistoryRows(history: DbChatRow[]): HistoryRow[] {
  return history
    .map((row) => {
      const role =
        row?.role === "assistant"
          ? "assistant"
          : row?.role === "user"
            ? "user"
            : null;
      const content = typeof row?.content === "string" ? row.content : "";

      if (!role) return null;
      if (!content) return null;

      return {
        role,
        content,
      };
    })
    .filter((row): row is HistoryRow => row !== null);
}

function shouldAppendLatestUserMessage(args: {
  history: HistoryRow[];
  userText: string;
}): boolean {
  const { history, userText } = args;

  if (!userText) return false;
  if (history.length === 0) return true;

  const last = history[history.length - 1];
  return !(last.role === "user" && last.content === userText);
}

function normalizeResolvedPlan(
  resolvedPlan?: ResolvedPlanLike | null,
): ResolvedPlanLike | null {
  if (resolvedPlan === "free") return "free";
  if (resolvedPlan === "plus") return "plus";
  if (resolvedPlan === "pro") return "pro";
  return null;
}

function getHistoryMaxItemsByPlan(
  resolvedPlan?: ResolvedPlanLike | null,
): number | null {
  const normalizedPlan = normalizeResolvedPlan(resolvedPlan);

  if (normalizedPlan === "free") return FREE_HISTORY_MAX_ITEMS;
  if (normalizedPlan === "plus") return PLUS_HISTORY_MAX_ITEMS;
  if (normalizedPlan === "pro") return PRO_HISTORY_MAX_ITEMS;

  return null;
}

function trimHistoryByPlan(args: {
  history: HistoryRow[];
  resolvedPlan?: ResolvedPlanLike | null;
}): HistoryRow[] {
  const maxItems = getHistoryMaxItemsByPlan(args.resolvedPlan);
  if (!(typeof maxItems === "number" && maxItems > 0)) {
    return args.history;
  }

  if (args.history.length <= maxItems) {
    return args.history;
  }

  return args.history.slice(-maxItems);
}

function hasPlanQuestionIntent(userText: string): boolean {
  const text = String(userText ?? "").toLowerCase();

  return [
    "プラン",
    "plan",
    "free",
    "plus",
    "pro",
    "比較",
    "比べ",
    "違い",
    "どっち",
    "どちら",
    "合う",
    "向い",
    "向いて",
    "おすすめ",
    "オススメ",
    "recommend",
    "best for me",
    "which plan",
    "what plan",
    "downgrade",
    "upgrade",
    "ダウングレード",
    "アップグレード",
    "料金",
    "値段",
    "節約",
    "安く",
  ].some((keyword) => text.includes(keyword));
}

function isPlanSteeringAssistantRow(content: string): boolean {
  const text = String(content ?? "");

  if (!text) return false;

  const mentionsPlan = /free|plus|pro|フリー|プラス|プロ/i.test(text);
  const hasRecommendationTone =
    /一番合って|合っています|向いています|おすすめ|主力|最適|自然な次の一歩|軽い代替|長期的に深く寄り添|継続理解|記憶反映/i.test(
      text,
    );

  return mentionsPlan && hasRecommendationTone;
}

function sanitizeHistoryForPlanQuestion(args: {
  history: HistoryRow[];
  userText: string;
}): HistoryRow[] {
  if (!hasPlanQuestionIntent(args.userText)) {
    return args.history;
  }

  return args.history.filter((row) => {
    if (row.role !== "assistant") return true;
    return !isPlanSteeringAssistantRow(row.content);
  });
}

export function buildFinalHistory(args: {
  history: DbChatRow[];
  userText: string;
  resolvedPlan?: ResolvedPlanLike | null;
}): HistoryRow[] {
  const rawHistory = Array.isArray(args.history) ? args.history : [];
  const history = normalizeHistoryRows(rawHistory);
  const userText = typeof args.userText === "string" ? args.userText : "";

  const sanitizedHistory = sanitizeHistoryForPlanQuestion({
    history,
    userText,
  });

  const appendedUserRow: HistoryRow = {
    role: "user",
    content: userText,
  };

  const mergedHistory: HistoryRow[] = shouldAppendLatestUserMessage({
    history: sanitizedHistory,
    userText,
  })
    ? [...sanitizedHistory, appendedUserRow]
    : sanitizedHistory;

  return trimHistoryByPlan({
    history: mergedHistory,
    resolvedPlan: args.resolvedPlan,
  });
}

/*
このファイルの正式役割
会話履歴を最終的に prompt 投入用の履歴へ整える専用ファイル。
DB履歴の正規化、plan質問時の履歴除外、最新user行の追加、plan別件数制限を担当する。
*/

/*
【今回このファイルで修正したこと】
- 最新 user 行を appendedUserRow: HistoryRow として明示した。
- mergedHistory を HistoryRow[] として明示した。
- 配列結合時に role が string へ広がる型推論ずれを止めた。
- 履歴の内容や件数制御ロジック自体は変えていない。
*/
// このファイルの正式役割: 会話履歴を最終的に prompt 投入用の履歴へ整える専用ファイル