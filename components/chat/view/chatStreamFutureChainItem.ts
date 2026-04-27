// /components/chat/view/chatStreamFutureChainItem.ts
"use client";

import type { ChatMsg } from "../lib/chatTypes";

export type ChatStreamFutureChainPlan = "free" | "plus" | "pro";

export type ChatStreamFutureChainMode = "owner_handoff" | "recipient_support";

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
  deliveryMode?: unknown;
  transition_kind?: unknown;
  transitionKind?: unknown;
  handoff_message_snapshot?: unknown;
  handoffMessageSnapshot?: unknown;
};

type FutureChainDisplayRecord = {
  kind?: unknown;
  shouldDisplay?: unknown;
  placement?: unknown;
  detailLevel?: unknown;
  title?: unknown;
  description?: unknown;
  handoffMessageSnapshot?: unknown;
  handoff_message_snapshot?: unknown;
  bridgeEventId?: unknown;
  deliveryEventId?: unknown;
};

export type BuildChatStreamFutureChainItemParams = {
  msg: ChatMsg;
  msgKey: string;
  key: string;
  plan: ChatStreamFutureChainPlan;
  futureChainDisplay?: unknown | null;
  allowRecipientSupport?: boolean;
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

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    return text === "true" || text === "1";
  }

  return false;
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

function readFutureChainDisplay(
  value: unknown,
): FutureChainDisplayRecord | null {
  return asRecord(value) as FutureChainDisplayRecord | null;
}

function readFutureChainDisplayFromMessage(
  msg: ChatMsg,
): FutureChainDisplayRecord | null {
  const source = msg as {
    future_chain_display?: unknown;
    futureChainDisplay?: unknown;
    hopy_confirmed_payload?: {
      future_chain_display?: unknown;
      futureChainDisplay?: unknown;
    } | null;
  };

  return readFutureChainDisplay(
    source.future_chain_display ??
      source.futureChainDisplay ??
      source.hopy_confirmed_payload?.future_chain_display ??
      source.hopy_confirmed_payload?.futureChainDisplay,
  );
}

function readContextDeliveryMode(context: FutureChainContextRecord): string {
  return normalizeText(context.delivery_mode ?? context.deliveryMode);
}

function readContextTransitionKind(context: FutureChainContextRecord): string {
  return normalizeText(context.transition_kind ?? context.transitionKind);
}

function readHandoffMessageSnapshotFromContext(
  context: FutureChainContextRecord,
): string {
  return normalizeText(
    context.handoff_message_snapshot ?? context.handoffMessageSnapshot,
  );
}

function readHandoffMessageSnapshotFromDisplay(
  display: FutureChainDisplayRecord,
): string {
  return normalizeText(
    display.handoffMessageSnapshot ?? display.handoff_message_snapshot,
  );
}

function resolveOwnerHandoffDescription(transitionKind: unknown): string {
  const kind = normalizeText(transitionKind);

  if (kind === "downward") {
    return "今回の再調整は、匿名化された形で未来の誰かの支えになる可能性があります。";
  }

  if (kind === "upward") {
    return "この前進は、匿名化された形で未来の誰かの支えになる可能性があります。";
  }

  return "今回の変化は、匿名化された形で未来の誰かの支えになる可能性があります。";
}

function buildOwnerHandoffItem(params: {
  msg: ChatMsg;
  msgKey: string;
  key: string;
  plan: ChatStreamFutureChainPlan;
  context: FutureChainContextRecord;
}): ChatStreamFutureChainViewItem | null {
  if (readContextDeliveryMode(params.context) !== "owner_handoff") {
    return null;
  }

  const handoffMessageSnapshot = readHandoffMessageSnapshotFromContext(
    params.context,
  );

  if (!handoffMessageSnapshot) return null;

  const detailLevel: ChatStreamFutureChainDetailLevel =
    params.plan === "free" ? "minimal" : "full";

  return {
    kind: "future_chain",
    key: `${params.key}::future-chain`,
    msgKey: params.msgKey,
    mode: "owner_handoff",
    placement: params.plan === "free" ? "below_reply" : "below_compass",
    detailLevel,
    title:
      params.plan === "free"
        ? "Future Chain"
        : "未来のユーザーさんへ Future Chain としてお渡しします",
    description: resolveOwnerHandoffDescription(
      readContextTransitionKind(params.context),
    ),
    handoffMessageSnapshot,
    items: [],
    msg: params.msg,
  };
}

function buildRecipientSupportItem(params: {
  msg: ChatMsg;
  msgKey: string;
  key: string;
  display: FutureChainDisplayRecord;
}): ChatStreamFutureChainViewItem | null {
  if (normalizeText(params.display.kind) !== "recipient_support") {
    return null;
  }

  if (!normalizeBoolean(params.display.shouldDisplay)) {
    return null;
  }

  const handoffMessageSnapshot = readHandoffMessageSnapshotFromDisplay(
    params.display,
  );

  if (!handoffMessageSnapshot) return null;

  return {
    kind: "future_chain",
    key: `${params.key}::future-chain-recipient-support`,
    msgKey: params.msgKey,
    mode: "recipient_support",
    placement: "below_reply",
    detailLevel: "full",
    title:
      normalizeText(params.display.title) ||
      "過去のユーザーさんから Future Chain が届いています",
    description:
      normalizeText(params.display.description) ||
      "過去の本物の会話から生まれたHOPYの言葉が、今のあなたへ届いています。",
    handoffMessageSnapshot,
    items: [],
    msg: params.msg,
  };
}

export function buildChatStreamFutureChainItem({
  msg,
  msgKey,
  key,
  plan,
}: BuildChatStreamFutureChainItemParams): ChatStreamFutureChainViewItem | null {
  const context = readFutureChainContextFromMessage(msg);

  if (context) {
    const ownerHandoffItem = buildOwnerHandoffItem({
      msg,
      msgKey,
      key,
      plan,
      context,
    });

    if (ownerHandoffItem) return ownerHandoffItem;
  }

  const messageOwnedDisplay = readFutureChainDisplayFromMessage(msg);
  if (!messageOwnedDisplay) return null;

  return buildRecipientSupportItem({
    msg,
    msgKey,
    key,
    display: messageOwnedDisplay,
  });
}

/*
【このファイルの正式役割】
HOPY Future Chain v3.1 のチャット表示用 item 生成だけを担当する。
assistant message の hopy_confirmed_payload.future_chain_context を読み取り、
delivery_mode が owner_handoff かつ handoff_message_snapshot がある場合は
kind: "future_chain" の owner_handoff ViewItem 候補を返す。
assistant message 自体に recipient_support 表示payload が紐づいている場合は、
その message-owned payload から handoffMessageSnapshot を読み取り、
kind: "future_chain" の recipient_support ViewItem 候補を返す。

このファイルは HOPY回答再要約、Compass再要約、Future Chain意味生成、
state_changed再判定、state_level再判定、current_phase再判定、
Compass表示可否判定、HOPY回答○判定、DB保存、recipient_support検索、
delivery_event保存、Future Chainページ集計、実際のUI描画を担当しない。

【今回このファイルで修正したこと】
- assistant message 本体の future_chain_display / futureChainDisplay を読む処理を追加した。
- hopy_confirmed_payload.future_chain_display / hopy_confirmed_payload.futureChainDisplay も読むようにした。
- recipient_support は、画面全体の一時 futureChainDisplay ではなく、message-owned display からだけ生成するようにした。
- 最新HOPY回答下へ recipient_support が移動する原因になる外部 futureChainDisplay fallback を使わないようにした。
- owner_handoff の hopy_confirmed_payload.future_chain_context 読み取りは維持した。
- HOPY回答全文、Compass全文、ユーザー発話生文を読む処理は入れていない。
- recipient_support検索、delivery_event保存、Future Chainページ、DB保存には触れていない。

/components/chat/view/chatStreamFutureChainItem.ts
*/