// /app/api/chat/_lib/route/authenticatedPostTurnFutureChainDisplay.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildFutureChainDisplayPayload,
  selectFutureChainRecipientSupport,
} from "../hopy/future-chain";

type ResolvedPlan = "free" | "plus" | "pro";

type PayloadRecord = Record<string, unknown>;

type HopyConfirmedPayloadRecord = PayloadRecord & {
  state?: unknown;
  future_chain_context?: unknown;
};

type HopyStateRecord = PayloadRecord & {
  state_level?: unknown;
  current_phase?: unknown;
};

type FutureChainContextRecord = PayloadRecord & {
  delivery_mode?: unknown;
  support_needed?: unknown;
  major_category?: unknown;
  minor_category?: unknown;
  change_trigger_key?: unknown;
};

type FutureChainPersistRecord = PayloadRecord & {
  bridgeEventId?: unknown;
};

const PLUS_RECIPIENT_SUPPORT_BUCKET_COUNT = 4;

function asRecord(value: unknown): PayloadRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as PayloadRecord;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function safeStateLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  const rounded = Math.trunc(n);
  if (rounded < 1 || rounded > 5) return null;

  return rounded as 1 | 2 | 3 | 4 | 5;
}

function normalizeResolvedPlan(value: unknown): ResolvedPlan {
  const normalized = normalizeText(value)?.toLowerCase();

  if (normalized === "plus" || normalized === "pro") {
    return normalized;
  }

  return "free";
}

function resolveHopyConfirmedPayload(
  payloadRecord: PayloadRecord,
): HopyConfirmedPayloadRecord | null {
  const hopyConfirmedPayload = asRecord(payloadRecord.hopy_confirmed_payload);
  if (!hopyConfirmedPayload) return null;

  return hopyConfirmedPayload as HopyConfirmedPayloadRecord;
}

function resolveHopyState(
  hopyConfirmedPayload: HopyConfirmedPayloadRecord,
): HopyStateRecord | null {
  const state = asRecord(hopyConfirmedPayload.state);
  if (!state) return null;

  return state as HopyStateRecord;
}

function resolveRecipientStateLevel(
  hopyConfirmedPayload: HopyConfirmedPayloadRecord,
): 1 | 2 | 3 | 4 | 5 | null {
  const state = resolveHopyState(hopyConfirmedPayload);

  return safeStateLevel(state?.state_level ?? state?.current_phase);
}

function resolveFutureChainContext(
  hopyConfirmedPayload: HopyConfirmedPayloadRecord,
): FutureChainContextRecord | null {
  const context = asRecord(hopyConfirmedPayload.future_chain_context);
  if (!context) return null;

  return context as FutureChainContextRecord;
}

function resolveFutureChainPersist(
  payloadRecord: PayloadRecord,
): FutureChainPersistRecord | null {
  const persist = asRecord(payloadRecord.future_chain_persist);
  if (!persist) return null;

  return persist as FutureChainPersistRecord;
}

function resolvePersistBridgeEventId(
  payloadRecord: PayloadRecord,
): string | null {
  const persist = resolveFutureChainPersist(payloadRecord);
  if (!persist) return null;

  return normalizeText(persist.bridgeEventId);
}

function shouldTryRecipientSupport(
  context: FutureChainContextRecord | null,
): boolean {
  if (!context) return false;

  return (
    context.delivery_mode === "recipient_support" &&
    context.support_needed === true
  );
}

function resolvePayloadLanguage(payloadRecord: PayloadRecord): string | null {
  return (
    normalizeText(payloadRecord.assistant_reply_lang) ??
    normalizeText(payloadRecord.reply_lang) ??
    normalizeText(payloadRecord.ui_lang) ??
    normalizeText(payloadRecord.routed_lang)
  );
}

function resolvePayloadAssistantMessageId(
  payloadRecord: PayloadRecord,
): string | null {
  const topLevelAssistantMessageId = normalizeText(
    payloadRecord.assistant_message_id,
  );

  if (topLevelAssistantMessageId) {
    return topLevelAssistantMessageId;
  }

  const hopyConfirmedPayload = resolveHopyConfirmedPayload(payloadRecord);
  const threadSummary = asRecord(hopyConfirmedPayload?.thread_summary);

  return normalizeText(threadSummary?.latest_reply_id);
}

function hashTextToPositiveInteger(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function shouldShowOccasionalPlusRecipientSupport(
  assistantMessageId: string | null,
): boolean {
  if (!assistantMessageId) return false;

  return (
    hashTextToPositiveInteger(assistantMessageId) %
      PLUS_RECIPIENT_SUPPORT_BUCKET_COUNT ===
    0
  );
}

function shouldAllowRecipientSupportByPlan(params: {
  plan: ResolvedPlan;
  assistantMessageId: string | null;
}): boolean {
  if (params.plan === "free") {
    return false;
  }

  if (params.plan === "pro") {
    return true;
  }

  return shouldShowOccasionalPlusRecipientSupport(params.assistantMessageId);
}

function attachOwnerHandoffPersistBridgeEventId(params: {
  displayPayload: unknown;
  payloadRecord: PayloadRecord;
}): unknown {
  const displayPayloadRecord = asRecord(params.displayPayload);
  if (!displayPayloadRecord) {
    return params.displayPayload;
  }

  if (displayPayloadRecord.kind !== "owner_handoff") {
    return params.displayPayload;
  }

  const bridgeEventId = resolvePersistBridgeEventId(params.payloadRecord);
  if (!bridgeEventId) {
    return params.displayPayload;
  }

  return {
    ...displayPayloadRecord,
    bridgeEventId,
  };
}

export async function attachFutureChainDisplayToPayload(params: {
  payload: unknown;
  supabase: SupabaseClient;
  resolvedPlan: ResolvedPlan | string | null | undefined;
  recipientThreadId?: string | null | undefined;
}): Promise<unknown> {
  const payloadRecord = asRecord(params.payload);
  if (!payloadRecord) {
    return params.payload;
  }

  const plan = normalizeResolvedPlan(params.resolvedPlan);
  const hopyConfirmedPayload = resolveHopyConfirmedPayload(payloadRecord);

  if (!hopyConfirmedPayload) {
    return params.payload;
  }

  const context = resolveFutureChainContext(hopyConfirmedPayload);

  if (!context || !shouldTryRecipientSupport(context)) {
    const displayPayload = buildFutureChainDisplayPayload({
      plan,
      hopyConfirmedPayload: hopyConfirmedPayload as Parameters<
        typeof buildFutureChainDisplayPayload
      >[0]["hopyConfirmedPayload"],
      recipientSupport: null,
    });

    const displayPayloadWithBridgeEventId =
      attachOwnerHandoffPersistBridgeEventId({
        displayPayload,
        payloadRecord,
      });

    const displayPayloadRecord = asRecord(displayPayloadWithBridgeEventId);

    if (displayPayloadRecord?.shouldDisplay === true) {
      payloadRecord.future_chain_display = displayPayloadWithBridgeEventId;
    }

    return params.payload;
  }

  const assistantMessageId = resolvePayloadAssistantMessageId(payloadRecord);

  if (
    !shouldAllowRecipientSupportByPlan({
      plan,
      assistantMessageId,
    })
  ) {
    return params.payload;
  }

  const recipientMajorCategory = normalizeText(context.major_category);
  const recipientMinorCategory = normalizeText(context.minor_category);

  if (!recipientMajorCategory || !recipientMinorCategory) {
    return params.payload;
  }

  const selectedRecipientSupport = await selectFutureChainRecipientSupport({
    supabase: params.supabase,
    language: resolvePayloadLanguage(payloadRecord),
    excludeSourceAssistantMessageId: assistantMessageId,
    recipientThreadId: params.recipientThreadId,
    recipientStateLevel: resolveRecipientStateLevel(hopyConfirmedPayload),
    recipientMajorCategory,
    recipientMinorCategory,
    recipientChangeTriggerKey: normalizeText(context.change_trigger_key),
    limit: 20,
  });

  if (!selectedRecipientSupport.ok || !selectedRecipientSupport.selected) {
    return params.payload;
  }

  const displayPayload = buildFutureChainDisplayPayload({
    plan,
    hopyConfirmedPayload: hopyConfirmedPayload as Parameters<
      typeof buildFutureChainDisplayPayload
    >[0]["hopyConfirmedPayload"],
    recipientSupport: {
      bridgeEventId: selectedRecipientSupport.selected.bridgeEventId,
      title: "過去のユーザーさんから Future Chain が届いています",
      handoffMessageSnapshot:
        selectedRecipientSupport.selected.handoffMessageSnapshot,
    },
  });

  if (!displayPayload.shouldDisplay) {
    return params.payload;
  }

  payloadRecord.future_chain_display = displayPayload;
  return params.payload;
}

/*
【このファイルの正式役割】
authenticated postTurn の最終 payload に、Future Chain v3.1 の表示payloadだけを安全に付与する。
payload.hopy_confirmed_payload.future_chain_context を読み、owner_handoff または recipient_support の表示payloadを作れる場合だけ payload.future_chain_display に載せる。
recipient_support の場合は、delivery_mode="recipient_support"、support_needed=true、plan gate、検索に必要なカテゴリ値がそろっている場合だけ候補選択へ進む。
候補選択では、保存済み hopy_future_chain_bridge_events から handoff_message_snapshot を1件だけ選び、buildFutureChainDisplayPayload(...) に渡す。

このファイルは HOPY回答再要約、Compass再要約、Future Chain意味生成、state_changed再判定、state_level再判定、current_phase再判定、Compass表示可否判定、HOPY回答○判定、owner_handoff保存、delivery_event保存、UI本体表示、Future Chainページ集計を担当しない。

【今回このファイルで修正したこと】
- owner_handoff 表示payloadに、直前の保存結果 payload.future_chain_persist.bridgeEventId を反映する処理を追加した。
- buildFutureChainDisplayPayload(...) 本体は変更せず、このファイルの表示payload付与責務の範囲で bridgeEventId を補完した。
- recipient_support 側の bridgeEventId は、従来通り selectFutureChainRecipientSupport(...) の選択結果を使う形を維持した。
- Future Chain の意味生成、保存判定、DB保存、候補選択、delivery_event保存、UI本体表示には触れていない。
- hopy_confirmed_payload / state_changed / state_level / current_phase / Compass / HOPY回答○ は再判定していない。

/app/api/chat/_lib/route/authenticatedPostTurnFutureChainDisplay.ts
*/