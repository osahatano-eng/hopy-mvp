// /app/api/chat/_lib/hopy/future-chain/futureChainDeliveryEvent.ts

import type { SupabaseClient } from "@supabase/supabase-js";

type ResolvedPlan = "free" | "plus" | "pro";

type PayloadRecord = Record<string, unknown>;

type FutureChainDisplayRecord = PayloadRecord & {
  kind?: unknown;
  shouldDisplay?: unknown;
  title?: unknown;
  description?: unknown;
  handoffMessageSnapshot?: unknown;
  handoff_message_snapshot?: unknown;
  bridgeEventId?: unknown;
  bridge_event_id?: unknown;
  deliveryEventId?: unknown;
  delivery_event_id?: unknown;
};

type HopyConfirmedPayloadRecord = PayloadRecord & {
  state?: unknown;
  future_chain_context?: unknown;
};

type HopyStateRecord = PayloadRecord & {
  state_level?: unknown;
  current_phase?: unknown;
};

type FutureChainBridgeEventRow = {
  id: string | null;
  pattern_id: string | null;
  major_category: string | null;
  minor_category: string | null;
  change_trigger_key: string | null;
  support_shape_key: string | null;
};

export type SaveFutureChainDeliveryEventParams = {
  supabase: SupabaseClient;
  payload: unknown;
  recipientUserId: string | null | undefined;
  recipientThreadId: string | null | undefined;
  recipientAssistantMessageId: string | null | undefined;
  recipientPlan: string | null | undefined;
};

export type SaveFutureChainDeliveryEventResult =
  | {
      ok: true;
      decision: "inserted" | "already_exists";
      deliveryEventId: string;
      reason: string;
    }
  | {
      ok: true;
      decision: "skip";
      deliveryEventId: null;
      reason: string;
    }
  | {
      ok: false;
      decision: "failed";
      deliveryEventId: null;
      reason: string;
      error: unknown;
    };

function asRecord(value: unknown): PayloadRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as PayloadRecord;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeResolvedPlan(value: unknown): ResolvedPlan | null {
  const normalized = normalizeText(value)?.toLowerCase();

  if (normalized === "free" || normalized === "plus" || normalized === "pro") {
    return normalized;
  }

  return null;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }

  return false;
}

function safeStateLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  const i = Math.trunc(n);
  if (i < 1 || i > 5) return null;

  return i as 1 | 2 | 3 | 4 | 5;
}

function resolveHopyConfirmedPayload(
  payloadRecord: PayloadRecord,
): HopyConfirmedPayloadRecord | null {
  const confirmedPayload = asRecord(payloadRecord.hopy_confirmed_payload);
  if (!confirmedPayload) return null;

  return confirmedPayload as HopyConfirmedPayloadRecord;
}

function resolveHopyState(
  confirmedPayload: HopyConfirmedPayloadRecord | null,
): HopyStateRecord | null {
  const state = asRecord(confirmedPayload?.state);
  if (!state) return null;

  return state as HopyStateRecord;
}

function resolveRecipientStateLevel(
  payloadRecord: PayloadRecord,
): 1 | 2 | 3 | 4 | 5 | null {
  const confirmedPayload = resolveHopyConfirmedPayload(payloadRecord);
  const state = resolveHopyState(confirmedPayload);

  return safeStateLevel(state?.state_level ?? state?.current_phase);
}

function resolveFutureChainDisplay(
  payloadRecord: PayloadRecord,
): FutureChainDisplayRecord | null {
  const display = asRecord(payloadRecord.future_chain_display);
  if (!display) return null;

  return display as FutureChainDisplayRecord;
}

function resolveBridgeEventId(display: FutureChainDisplayRecord): string | null {
  return normalizeText(display.bridgeEventId ?? display.bridge_event_id);
}

function resolveDeliveryEventId(
  display: FutureChainDisplayRecord,
): string | null {
  return normalizeText(display.deliveryEventId ?? display.delivery_event_id);
}

function resolveHandoffMessageSnapshot(
  display: FutureChainDisplayRecord,
): string | null {
  return normalizeText(
    display.handoffMessageSnapshot ?? display.handoff_message_snapshot,
  );
}

function shouldSaveRecipientSupportDeliveryEvent(
  display: FutureChainDisplayRecord | null,
): boolean {
  if (!display) return false;
  if (normalizeText(display.kind) !== "recipient_support") return false;
  if (!normalizeBoolean(display.shouldDisplay)) return false;
  if (!resolveBridgeEventId(display)) return false;
  if (!resolveHandoffMessageSnapshot(display)) return false;

  return true;
}

function attachDeliveryEventIdToPayload(params: {
  payloadRecord: PayloadRecord;
  deliveryEventId: string;
}) {
  const display = resolveFutureChainDisplay(params.payloadRecord);
  if (!display) return;

  display.deliveryEventId = params.deliveryEventId;
  display.delivery_event_id = params.deliveryEventId;

  params.payloadRecord.future_chain_display = display;
}

async function findExistingDeliveryEvent(params: {
  supabase: SupabaseClient;
  bridgeEventId: string;
  recipientAssistantMessageId: string;
}): Promise<string | null> {
  const { data, error } = await params.supabase
    .from("hopy_future_chain_delivery_events")
    .select("id")
    .eq("bridge_event_id", params.bridgeEventId)
    .eq("recipient_assistant_message_id", params.recipientAssistantMessageId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return normalizeText((data as { id?: unknown } | null)?.id);
}

async function loadBridgeEventRow(params: {
  supabase: SupabaseClient;
  bridgeEventId: string;
}): Promise<FutureChainBridgeEventRow | null> {
  const { data, error } = await params.supabase
    .from("hopy_future_chain_bridge_events")
    .select(
      [
        "id",
        "pattern_id",
        "major_category",
        "minor_category",
        "change_trigger_key",
        "support_shape_key",
      ].join(", "),
    )
    .eq("id", params.bridgeEventId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as unknown as FutureChainBridgeEventRow;
}

export async function saveFutureChainDeliveryEventForPayload(
  params: SaveFutureChainDeliveryEventParams,
): Promise<SaveFutureChainDeliveryEventResult> {
  const payloadRecord = asRecord(params.payload);
  if (!payloadRecord) {
    return {
      ok: true,
      decision: "skip",
      deliveryEventId: null,
      reason: "payload_not_record",
    };
  }

  const display = resolveFutureChainDisplay(payloadRecord);
  if (!shouldSaveRecipientSupportDeliveryEvent(display)) {
    return {
      ok: true,
      decision: "skip",
      deliveryEventId: null,
      reason: "recipient_support_display_not_found",
    };
  }

  const existingDeliveryEventId = resolveDeliveryEventId(
    display as FutureChainDisplayRecord,
  );
  if (existingDeliveryEventId) {
    return {
      ok: true,
      decision: "already_exists",
      deliveryEventId: existingDeliveryEventId,
      reason: "delivery_event_id_already_present",
    };
  }

  const recipientUserId = normalizeText(params.recipientUserId);
  if (!recipientUserId) {
    return {
      ok: true,
      decision: "skip",
      deliveryEventId: null,
      reason: "recipient_user_id_missing",
    };
  }

  const recipientAssistantMessageId = normalizeText(
    params.recipientAssistantMessageId,
  );
  if (!recipientAssistantMessageId) {
    return {
      ok: true,
      decision: "skip",
      deliveryEventId: null,
      reason: "recipient_assistant_message_id_missing",
    };
  }

  const recipientPlan = normalizeResolvedPlan(params.recipientPlan);
  if (!recipientPlan) {
    return {
      ok: true,
      decision: "skip",
      deliveryEventId: null,
      reason: "recipient_plan_invalid",
    };
  }

  const recipientStateLevel = resolveRecipientStateLevel(payloadRecord);
  if (!recipientStateLevel) {
    return {
      ok: true,
      decision: "skip",
      deliveryEventId: null,
      reason: "recipient_state_level_invalid",
    };
  }

  const bridgeEventId = resolveBridgeEventId(
    display as FutureChainDisplayRecord,
  );
  const handoffMessageSnapshot = resolveHandoffMessageSnapshot(
    display as FutureChainDisplayRecord,
  );

  if (!bridgeEventId || !handoffMessageSnapshot) {
    return {
      ok: true,
      decision: "skip",
      deliveryEventId: null,
      reason: "bridge_event_or_snapshot_missing",
    };
  }

  const alreadySavedDeliveryEventId = await findExistingDeliveryEvent({
    supabase: params.supabase,
    bridgeEventId,
    recipientAssistantMessageId,
  });

  if (alreadySavedDeliveryEventId) {
    attachDeliveryEventIdToPayload({
      payloadRecord,
      deliveryEventId: alreadySavedDeliveryEventId,
    });

    return {
      ok: true,
      decision: "already_exists",
      deliveryEventId: alreadySavedDeliveryEventId,
      reason: "delivery_event_already_exists",
    };
  }

  const bridgeEvent = await loadBridgeEventRow({
    supabase: params.supabase,
    bridgeEventId,
  });

  const majorCategory =
    normalizeText(bridgeEvent?.major_category) ?? "uncategorized";
  const minorCategory = normalizeText(bridgeEvent?.minor_category) ?? "general";
  const changeTriggerKey = normalizeText(bridgeEvent?.change_trigger_key);
  const patternId = normalizeText(bridgeEvent?.pattern_id);

  const displayTitle =
    normalizeText(display?.title) ??
    "過去のユーザーさんから Future Chain が届いています";

  const insertPayload = {
    recipient_user_id: recipientUserId,
    recipient_thread_id: normalizeText(params.recipientThreadId),
    recipient_assistant_message_id: recipientAssistantMessageId,
    bridge_event_id: bridgeEventId,
    pattern_id: patternId,
    recipient_plan: recipientPlan,
    display_mode: "recipient_support",
    recipient_state_level: recipientStateLevel,
    major_category: majorCategory,
    minor_category: minorCategory,
    change_trigger_key: changeTriggerKey,
    display_title: displayTitle,
    display_insight: "過去のHOPY回答由来の言葉を届けた",
    display_hint: handoffMessageSnapshot,
    display_flow: "recipient_supportとしてHOPY回答下に表示",
    delivery_reason: "state_changed=false かつ support_needed=true のため",
    status: "shown",
    metadata: {
      source: "future_chain_display",
      version: "future_chain_delivery_event_v1",
      support_shape_key:
        normalizeText(bridgeEvent?.support_shape_key) ??
        "handoff_message_snapshot",
    },
  };

  const { data, error } = await params.supabase
    .from("hopy_future_chain_delivery_events")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      decision: "failed",
      deliveryEventId: null,
      reason: "delivery_event_insert_failed",
      error,
    };
  }

  const deliveryEventId = normalizeText((data as { id?: unknown } | null)?.id);
  if (!deliveryEventId) {
    return {
      ok: false,
      decision: "failed",
      deliveryEventId: null,
      reason: "delivery_event_id_missing_after_insert",
      error: null,
    };
  }

  attachDeliveryEventIdToPayload({
    payloadRecord,
    deliveryEventId,
  });

  return {
    ok: true,
    decision: "inserted",
    deliveryEventId,
    reason: "delivery_event_inserted",
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain v3.1.1 の recipient_support 表示履歴保存だけを担当する。
payload.future_chain_display が recipient_support であり、
handoffMessageSnapshot と bridgeEventId がある場合に限り、
hopy_future_chain_delivery_events へ「過去から届いたFuture Chainを表示した事実」を保存する。

このファイルは HOPY回答再要約、Compass再要約、Future Chain意味生成、
state_changed再判定、state_level再判定、current_phase再判定、
Compass表示可否判定、HOPY回答○判定、owner_handoff保存、
recipient_support検索、UI表示、Future Chainページ集計を担当しない。

【今回このファイルで修正したこと】
- loadBridgeEventRow(...) の Supabase 戻り値を FutureChainBridgeEventRow へ直接castせず、unknown 経由で型変換するようにした。
- recipient_support delivery_event 保存専用ファイルの責務は維持した。
- payload.future_chain_display から bridgeEventId / handoffMessageSnapshot を読み取る処理は維持した。
- recipient_user_id / recipient_thread_id / recipient_assistant_message_id / recipient_plan / recipient_state_level が揃う場合だけ保存する方針は維持した。
- hopy_future_chain_bridge_events から pattern_id / major_category / minor_category / change_trigger_key / support_shape_key を補助取得する方針は維持した。
- hopy_future_chain_delivery_events の NOT NULL カラムへ安全な値を入れる方針は維持した。
- 同じ bridge_event_id と recipient_assistant_message_id の delivery_event が既にある場合は重複insertしない方針は維持した。
- 保存後、payload.future_chain_display.deliveryEventId / delivery_event_id に保存IDを反映する方針は維持した。

/app/api/chat/_lib/hopy/future-chain/futureChainDeliveryEvent.ts
*/