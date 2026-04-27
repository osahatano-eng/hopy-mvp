// /app/api/chat/_lib/hopy/future-chain/futureChainDisplayPayload.ts

import {
  readFutureChainPayloadContext,
  type HopyFutureChainOwnerHandoff,
  type HopyFutureChainPayloadContext,
  type HopyFutureChainTransitionKind,
} from "./futureChainPayloadContext";
import type { HopyFutureChainConfirmedPayload } from "./futureChainTypes";

export type HopyFutureChainDisplayPlan = "free" | "plus" | "pro";

export type HopyFutureChainDisplayPlacement =
  | "below_reply"
  | "below_compass"
  | "none";

export type HopyFutureChainDisplayKind =
  | "owner_handoff"
  | "recipient_support"
  | "none";

export type HopyFutureChainDisplayDetailLevel = "minimal" | "full" | "none";

export type HopyFutureChainDisplayItem = {
  label: "気づき" | "ヒント" | "流れ" | "理由";
  text: string;
};

export type HopyFutureChainRecipientSupportDisplaySource = {
  bridgeEventId?: string | null;
  deliveryEventId?: string | null;
  title?: string | null;
  insight?: string | null;
  hint?: string | null;
  flow?: string | null;
};

export type HopyFutureChainDisplayPayload =
  | {
      kind: "none";
      shouldDisplay: false;
      plan: HopyFutureChainDisplayPlan;
      placement: "none";
      detailLevel: "none";
      title: null;
      description: null;
      items: [];
      bridgeEventId: null;
      deliveryEventId: null;
    }
  | {
      kind: "owner_handoff";
      shouldDisplay: true;
      plan: HopyFutureChainDisplayPlan;
      placement: HopyFutureChainDisplayPlacement;
      detailLevel: "minimal" | "full";
      title: string;
      description: string;
      items: HopyFutureChainDisplayItem[];
      bridgeEventId: null;
      deliveryEventId: null;
    }
  | {
      kind: "recipient_support";
      shouldDisplay: true;
      plan: "plus" | "pro";
      placement: "below_reply";
      detailLevel: "full";
      title: string;
      description: string;
      items: HopyFutureChainDisplayItem[];
      bridgeEventId: string | null;
      deliveryEventId: string | null;
    };

export type BuildFutureChainDisplayPayloadParams = {
  plan: HopyFutureChainDisplayPlan;
  hopyConfirmedPayload?: HopyFutureChainConfirmedPayload | null;
  recipientSupport?: HopyFutureChainRecipientSupportDisplaySource | null;
};

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildNoneDisplayPayload(
  plan: HopyFutureChainDisplayPlan,
): HopyFutureChainDisplayPayload {
  return {
    kind: "none",
    shouldDisplay: false,
    plan,
    placement: "none",
    detailLevel: "none",
    title: null,
    description: null,
    items: [],
    bridgeEventId: null,
    deliveryEventId: null,
  };
}

function resolveOwnerHandoffItems(
  ownerHandoff: HopyFutureChainOwnerHandoff | null,
): HopyFutureChainDisplayItem[] {
  const insight = normalizeText(ownerHandoff?.insight);
  const hint = normalizeText(ownerHandoff?.hint);
  const flow = normalizeText(ownerHandoff?.flow);
  const reason = normalizeText(ownerHandoff?.reason);

  if (!insight || !hint || !flow || !reason) {
    return [];
  }

  return [
    {
      label: "気づき",
      text: insight,
    },
    {
      label: "ヒント",
      text: hint,
    },
    {
      label: "流れ",
      text: flow,
    },
    {
      label: "理由",
      text: reason,
    },
  ];
}

function resolveOwnerHandoffDescription(params: {
  transitionKind: HopyFutureChainTransitionKind | null;
  detailLevel: "minimal" | "full";
}): string {
  if (params.transitionKind === "downward") {
    return "今回の再調整は、匿名化された形で未来の誰かの支えになる可能性があります。";
  }

  if (params.transitionKind === "upward") {
    return "この前進は、匿名化された形で未来の誰かの支えになる可能性があります。";
  }

  return "今回の変化は、匿名化された形で未来の誰かの支えになる可能性があります。";
}

function buildOwnerHandoffDisplayPayload(params: {
  plan: HopyFutureChainDisplayPlan;
  context: HopyFutureChainPayloadContext;
}): HopyFutureChainDisplayPayload {
  const detailLevel = params.plan === "free" ? "minimal" : "full";
  const items =
    detailLevel === "full"
      ? resolveOwnerHandoffItems(params.context.ownerHandoff)
      : [];

  if (detailLevel === "full" && items.length <= 0) {
    return buildNoneDisplayPayload(params.plan);
  }

  return {
    kind: "owner_handoff",
    shouldDisplay: true,
    plan: params.plan,
    placement: params.plan === "free" ? "below_reply" : "below_compass",
    detailLevel,
    title:
      params.plan === "free"
        ? "Future Chain"
        : "未来のユーザーさんへ Future Chain としてお渡しします",
    description: resolveOwnerHandoffDescription({
      transitionKind: params.context.transitionKind,
      detailLevel,
    }),
    items,
    bridgeEventId: null,
    deliveryEventId: null,
  };
}

function resolveRecipientSupportItems(
  source: HopyFutureChainRecipientSupportDisplaySource | null | undefined,
): HopyFutureChainDisplayItem[] {
  const insight = normalizeText(source?.insight);
  const hint = normalizeText(source?.hint);
  const flow = normalizeText(source?.flow);

  if (!insight || !hint || !flow) {
    return [];
  }

  return [
    {
      label: "気づき",
      text: insight,
    },
    {
      label: "ヒント",
      text: hint,
    },
    {
      label: "流れ",
      text: flow,
    },
  ];
}

function buildRecipientSupportDisplayPayload(params: {
  plan: "plus" | "pro";
  source: HopyFutureChainRecipientSupportDisplaySource;
}): HopyFutureChainDisplayPayload {
  const items = resolveRecipientSupportItems(params.source);

  if (items.length <= 0) {
    return buildNoneDisplayPayload(params.plan);
  }

  return {
    kind: "recipient_support",
    shouldDisplay: true,
    plan: params.plan,
    placement: "below_reply",
    detailLevel: "full",
    title:
      normalizeText(params.source.title) ||
      "過去のユーザーさんから Future Chain が届いています",
    description:
      "似た場面で生まれた前進から、今のあなたへ届いた支えです。",
    items,
    bridgeEventId: normalizeText(params.source.bridgeEventId) || null,
    deliveryEventId: normalizeText(params.source.deliveryEventId) || null,
  };
}

export function buildFutureChainDisplayPayload({
  plan,
  hopyConfirmedPayload,
  recipientSupport,
}: BuildFutureChainDisplayPayloadParams): HopyFutureChainDisplayPayload {
  if (!hopyConfirmedPayload) {
    return buildNoneDisplayPayload(plan);
  }

  const context = readFutureChainPayloadContext(hopyConfirmedPayload);

  if (context.deliveryMode === "owner_handoff") {
    return buildOwnerHandoffDisplayPayload({
      plan,
      context,
    });
  }

  if (
    plan !== "free" &&
    context.deliveryMode === "recipient_support" &&
    context.supportNeeded === true &&
    recipientSupport
  ) {
    return buildRecipientSupportDisplayPayload({
      plan,
      source: recipientSupport,
    });
  }

  return buildNoneDisplayPayload(plan);
}

export default buildFutureChainDisplayPayload;

/*
【このファイルの正式役割】
HOPY Future Chain v3 の表示payload作成だけを担当する。
hopy_confirmed_payload.future_chain_context と、
必要に応じて外部から渡された recipient_support 表示候補を受け取り、
Free / Plus / Pro の表示差に合わせて UI へ渡す payload に整える。

このファイルは HOPY回答再要約、Compass再要約、Future Chain意味生成、
state_changed再判定、state_level再判定、current_phase再判定、
Compass表示可否判定、HOPY回答○判定、DB保存、recipient_support検索、
delivery_event保存、Future Chainページ集計を担当しない。

【今回このファイルで修正したこと】
- shouldUseRecipientSupport(...) を削除しました。
- buildFutureChainDisplayPayload(...) 内で plan !== "free" を直接判定し、TypeScript が plan を "plus" | "pro" に絞れる形へ修正しました。
- recipient_support は Plus / Pro のみ、外部から表示候補が渡された場合だけ表示payload化する方針を維持しました。
- owner_handoff と recipient_support を同時表示しないように owner_handoff 優先の流れは維持しました。
- HOPY回答全文、Compass全文、ユーザー発話生文を読む処理は入れていません。

/app/api/chat/_lib/hopy/future-chain/futureChainDisplayPayload.ts
*/