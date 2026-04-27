// /app/api/chat/_lib/hopy/future-chain/futureChainDisplayPayload.ts

import {
  readFutureChainPayloadContext,
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

export type HopyFutureChainRecipientSupportDisplaySource = {
  bridgeEventId?: string | null;
  deliveryEventId?: string | null;
  title?: string | null;
  handoffMessageSnapshot?: string | null;
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
      handoffMessageSnapshot: null;
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
      handoffMessageSnapshot: string | null;
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
      handoffMessageSnapshot: string;
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
    handoffMessageSnapshot: null,
    bridgeEventId: null,
    deliveryEventId: null,
  };
}

function resolveContextHandoffMessageSnapshot(
  context: HopyFutureChainPayloadContext,
): string | null {
  const record = context as unknown as {
    handoffMessageSnapshot?: unknown;
    handoff_message_snapshot?: unknown;
  };

  const camelCaseSnapshot = normalizeText(record.handoffMessageSnapshot);
  if (camelCaseSnapshot) return camelCaseSnapshot;

  const snakeCaseSnapshot = normalizeText(record.handoff_message_snapshot);
  if (snakeCaseSnapshot) return snakeCaseSnapshot;

  return null;
}

function resolveOwnerHandoffDescription(params: {
  transitionKind: HopyFutureChainTransitionKind | null;
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
  const handoffMessageSnapshot = resolveContextHandoffMessageSnapshot(
    params.context,
  );

  if (detailLevel === "full" && !handoffMessageSnapshot) {
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
    }),
    handoffMessageSnapshot:
      detailLevel === "full" ? handoffMessageSnapshot : null,
    bridgeEventId: null,
    deliveryEventId: null,
  };
}

function buildRecipientSupportDisplayPayload(params: {
  plan: "plus" | "pro";
  source: HopyFutureChainRecipientSupportDisplaySource;
}): HopyFutureChainDisplayPayload {
  const handoffMessageSnapshot = normalizeText(
    params.source.handoffMessageSnapshot,
  );

  if (!handoffMessageSnapshot) {
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
      "過去の本物の会話から生まれたHOPYの言葉が、今のあなたへ届いています。",
    handoffMessageSnapshot,
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
HOPY Future Chain v3.1 の表示payload作成だけを担当する。
hopy_confirmed_payload.future_chain_context と、
必要に応じて外部から渡された recipient_support 表示候補を受け取り、
Free / Plus / Pro の表示差に合わせて UI へ渡す payload に整える。

このファイルは HOPY回答再要約、Compass再要約、Future Chain意味生成、
state_changed再判定、state_level再判定、current_phase再判定、
Compass表示可否判定、HOPY回答○判定、DB保存、recipient_support検索、
delivery_event保存、Future Chainページ集計を担当しない。

【今回このファイルで修正したこと】
- 旧v3の4項目表示型 HopyFutureChainDisplayItem を削除した。
- 表示payloadから items を削除した。
- resolveOwnerHandoffItems(...) を削除した。
- ownerHandoff の insight / hint / flow / reason を読む処理を削除した。
- recipient_support 表示候補から insight / hint / flow を削除した。
- Future Chain 表示payloadの主役を handoffMessageSnapshot に一本化した。
- このファイルでは recipient_support検索、delivery_event保存、route接続、UI本体、state_changed再判定、Compass再判定、HOPY回答○再判定には触れていない。

/app/api/chat/_lib/hopy/future-chain/futureChainDisplayPayload.ts
*/