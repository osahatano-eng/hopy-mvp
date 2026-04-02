// /app/api/chat/_lib/state/notificationPolicy.ts

/**
 * バッジ = 未処理“アクション”数（ノイズにしない）
 * いまは DB/Push/UI に接続しない。判定のみ。
 */

export type BadgeDecision =
  | { inc: false }
  | { inc: true; amount: number; reason: string };

/**
 * 返信テキストから「ユーザーにやることが増えた」と判断できる時だけ増やす。
 * - “次の一手” / “やること” / “TODO” など、アクション提示の明示がある場合
 * - 10年後は、LLMの構造化出力（action_items配列）に置き換える前提でここを差し替える
 */
export function decideBadgeFromAssistantReply(text: string): BadgeDecision {
  const s = String(text ?? "").trim();
  if (!s) return { inc: false };

  // 強いトリガー（明示）
  const strong = [
    "次の一手",
    "やること",
    "TODO",
    "ToDo",
    "タスク",
    "手順",
    "チェック",
    "確認",
  ];

  const hitStrong = strong.some((k) => s.includes(k));
  if (!hitStrong) return { inc: false };

  // “やること”が複数ある気配があれば amount を 2 にする（最大でも2。ノイズ化防止）
  const listy =
    s.includes("\n- ") ||
    s.includes("\n・") ||
    s.includes("\n1") ||
    s.includes("\n２") ||
    s.includes("\n2") ||
    s.includes("①") ||
    s.includes("1️⃣");

  return {
    inc: true,
    amount: listy ? 2 : 1,
    reason: listy ? "assistant_action_list" : "assistant_action_hint",
  };
}
