// /components/chat/view/chatStreamFutureChainItem.ts
"use client";

import type { ChatMsg } from "../lib/chatTypes";

export type ChatStreamFutureChainPlan = "free" | "plus" | "pro";

export type ChatStreamFutureChainMode = "owner_handoff";

export type ChatStreamFutureChainPlacement = "below_reply" | "below_compass";

export type ChatStreamFutureChainDetailLevel = "minimal" | "full";

export type ChatStreamFutureChainDisplayItem = {
  label: string;
  text: string;
};

export type ChatStreamFutureChainViewItem = {
  kind: "future_chain";
  key: string;
  msgKey: string;
  mode: ChatStreamFutureChainMode;
  placement: ChatStreamFutureChainPlacement;
  detailLevel: ChatStreamFutureChainDetailLevel;
  title: string;
  description: string;
  handoffMessageSnapshot: string;
  items: ChatStreamFutureChainDisplayItem[];
  msg: ChatMsg;
};

type FutureChainContextRecord = {
  delivery_mode?: unknown;
  transition_kind?: unknown;
  handoff_message_snapshot?: unknown;
  handoffMessageSnapshot?: unknown;
};

export type BuildChatStreamFutureChainItemParams = {
  msg: ChatMsg;
  msgKey: string;
  key: string;
  plan: ChatStreamFutureChainPlan;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readFutureChainContextFromMessage(
  msg: ChatMsg,
): FutureChainContextRecord | null {
  const source = msg as {
    hopy_confirmed_payload?: {
      future_chain_context?: unknown;
    } | null;
  };

  return asRecord(
    source.hopy_confirmed_payload?.future_chain_context,
  ) as FutureChainContextRecord | null;
}

function readHandoffMessageSnapshot(
  context: FutureChainContextRecord,
): string {
  return normalizeText(
    context.handoff_message_snapshot ?? context.handoffMessageSnapshot,
  );
}

function resolveOwnerHandoffDescription(transitionKind: unknown): string {
  const kind = normalizeText(transitionKind);

  if (kind === "downward") {
    return "今回の再調整から生まれたHOPYの言葉を、未来の誰かの支えとして待機します。";
  }

  if (kind === "upward") {
    return "今回の前進から生まれたHOPYの言葉を、未来の誰かの支えとして待機します。";
  }

  return "今回の変化から生まれたHOPYの言葉を、未来の誰かの支えとして待機します。";
}

export function buildChatStreamFutureChainItem({
  msg,
  msgKey,
  key,
  plan,
}: BuildChatStreamFutureChainItemParams): ChatStreamFutureChainViewItem | null {
  const context = readFutureChainContextFromMessage(msg);
  if (!context) return null;

  if (normalizeText(context.delivery_mode) !== "owner_handoff") {
    return null;
  }

  const handoffMessageSnapshot = readHandoffMessageSnapshot(context);
  if (!handoffMessageSnapshot) return null;

  const detailLevel: ChatStreamFutureChainDetailLevel =
    plan === "free" ? "minimal" : "full";

  return {
    kind: "future_chain",
    key: `${key}::future-chain`,
    msgKey,
    mode: "owner_handoff",
    placement: plan === "free" ? "below_reply" : "below_compass",
    detailLevel,
    title:
      plan === "free"
        ? "Future Chain"
        : "未来のユーザーさんへ Future Chain としてお渡しします",
    description: resolveOwnerHandoffDescription(context.transition_kind),
    handoffMessageSnapshot,
    items: [],
    msg,
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain v3.1 のチャット表示用 item 生成だけを担当する。
assistant message の hopy_confirmed_payload.future_chain_context を読み取り、
delivery_mode が owner_handoff かつ handoff_message_snapshot がある場合だけ
kind: "future_chain" の ViewItem 候補を返す。

このファイルは HOPY回答再要約、Compass再要約、Future Chain意味生成、
state_changed再判定、state_level再判定、current_phase再判定、
Compass表示可否判定、HOPY回答○判定、DB保存、recipient_support検索、
delivery_event保存、Future Chainページ集計、実際のUI描画を担当しない。

【今回このファイルで修正したこと】
- v3の owner_handoff 4項目読み取りを削除しました。
- hopy_confirmed_payload.future_chain_context.handoff_message_snapshot を読み取る形に変更しました。
- handoff_message_snapshot が存在する場合だけ future_chain item を返す形にしました。
- ChatStreamFutureChain.tsx の既存接続を壊さないため、items は空配列として残しています。
- HOPY回答全文、Compass全文、ユーザー発話生文を読む処理は入れていません。
- recipient_support は検索・delivery_event保存が未実装のため、このファイルではまだ表示対象にしていません。

/components/chat/view/chatStreamFutureChainItem.ts
*/