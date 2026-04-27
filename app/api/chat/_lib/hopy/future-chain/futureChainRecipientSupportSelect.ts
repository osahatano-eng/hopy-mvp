// /app/api/chat/_lib/hopy/future-chain/futureChainRecipientSupportSelect.ts

import type { SupabaseClient } from "@supabase/supabase-js";

export type HopyFutureChainRecipientSupportSelectParams = {
  supabase: SupabaseClient;
  language?: string | null;
  excludeSourceAssistantMessageId?: string | null;
  recipientThreadId?: string | null;
  recipientStateLevel?: number | null;
  recipientMajorCategory?: string | null;
  recipientMinorCategory?: string | null;
  recipientChangeTriggerKey?: string | null;
  limit?: number | null;
};

export type HopyFutureChainRecipientSupportSelection = {
  bridgeEventId: string;
  patternId: string | null;
  language: string;
  fromStateLevel: number;
  toStateLevel: number;
  deliveryTargetStateLevel: number | null;
  transitionKind: string;
  transitionMeaning: string;
  majorCategory: string | null;
  minorCategory: string | null;
  changeTriggerKey: string | null;
  supportShapeKey: string | null;
  sourceAssistantMessageId: string;
  handoffMessageSnapshot: string;
  futureSupportHint: string | null;
  futureVisibleSummary: string | null;
  createdAt: string | null;
};

export type HopyFutureChainRecipientSupportSelectResult =
  | {
      ok: true;
      selected: HopyFutureChainRecipientSupportSelection | null;
      reason: string;
    }
  | {
      ok: false;
      selected: null;
      reason: string;
      error: unknown;
    };

type FutureChainRecipientSupportBridgeEventRow = {
  id: string | null;
  pattern_id: string | null;
  language: string | null;
  from_state_level: number | null;
  to_state_level: number | null;
  delivery_target_state_level: number | null;
  transition_kind: string | null;
  transition_meaning: string | null;
  major_category: string | null;
  minor_category: string | null;
  change_trigger_key: string | null;
  support_shape_key: string | null;
  future_support_hint: string | null;
  future_visible_summary: string | null;
  source_assistant_message_id: string | null;
  handoff_message_snapshot: string | null;
  created_at: string | null;
};

type FutureChainRecipientSupportDeliveryEventRow = {
  bridge_event_id: string | null;
};

type RecipientSupportSelectionCriteria = {
  recipientStateLevel: 1 | 2 | 3 | 4 | 5 | null;
  recipientMajorCategory: string | null;
  recipientMinorCategory: string | null;
  recipientChangeTriggerKey: string | null;
};

const DEFAULT_SELECT_LIMIT = 20;
const MAX_SELECT_LIMIT = 50;
const MIN_HANDOFF_SNAPSHOT_CHARS = 12;
const MAX_HANDOFF_SNAPSHOT_CHARS = 480;
const MAX_DELIVERED_BRIDGE_EVENT_LOOKUP = 120;

const BRIDGE_EVENT_SELECT_COLUMNS = [
  "id",
  "pattern_id",
  "language",
  "from_state_level",
  "to_state_level",
  "delivery_target_state_level",
  "transition_kind",
  "transition_meaning",
  "major_category",
  "minor_category",
  "change_trigger_key",
  "support_shape_key",
  "future_support_hint",
  "future_visible_summary",
  "source_assistant_message_id",
  "handoff_message_snapshot",
  "created_at",
].join(", ");

function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeLooseText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function clampSelectLimit(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_SELECT_LIMIT;

  const rounded = Math.floor(Number(value));
  if (rounded <= 0) return DEFAULT_SELECT_LIMIT;

  return Math.min(rounded, MAX_SELECT_LIMIT);
}

function safeStateLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  const rounded = Math.trunc(n);
  if (rounded < 1 || rounded > 5) return null;

  return rounded as 1 | 2 | 3 | 4 | 5;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function buildUuidInFilter(values: Iterable<string>): string | null {
  const ids = Array.from(values)
    .map((value) => normalizeNullableText(value))
    .filter((value): value is string => Boolean(value))
    .filter(isUuidLike);

  if (ids.length === 0) return null;

  return `(${ids.join(",")})`;
}

function includesBlockedHandoffText(value: string): boolean {
  if (/https?:\/\//i.test(value)) return true;
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)) {
    return true;
  }
  if (/(?:\d[\s-]?){10,}/.test(value)) return true;

  return false;
}

function normalizeHandoffMessageSnapshot(
  value: string | null | undefined,
): string | null {
  const trimmed = normalizeNullableText(value);
  if (!trimmed) return null;

  if (trimmed.length < MIN_HANDOFF_SNAPSHOT_CHARS) return null;
  if (trimmed.length > MAX_HANDOFF_SNAPSHOT_CHARS) return null;
  if (includesBlockedHandoffText(trimmed)) return null;

  return trimmed;
}

async function loadDeliveredBridgeEventIdsForThread(params: {
  supabase: SupabaseClient;
  recipientThreadId: string | null;
}): Promise<Set<string>> {
  const recipientThreadId = normalizeNullableText(params.recipientThreadId);
  const out = new Set<string>();

  if (!recipientThreadId) {
    return out;
  }

  const { data, error } = await params.supabase
    .from("hopy_future_chain_delivery_events")
    .select("bridge_event_id")
    .eq("recipient_thread_id", recipientThreadId)
    .eq("display_mode", "recipient_support")
    .eq("status", "shown")
    .is("deleted_at", null)
    .not("bridge_event_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(MAX_DELIVERED_BRIDGE_EVENT_LOOKUP);

  if (error) {
    return out;
  }

  const rows = Array.isArray(data)
    ? (data as unknown as FutureChainRecipientSupportDeliveryEventRow[])
    : [];

  for (const row of rows) {
    const bridgeEventId = normalizeNullableText(row.bridge_event_id);
    if (bridgeEventId) {
      out.add(bridgeEventId);
    }
  }

  return out;
}

function resolveStateMatchScore(params: {
  row: FutureChainRecipientSupportBridgeEventRow;
  recipientStateLevel: 1 | 2 | 3 | 4 | 5 | null;
}): number {
  const recipientStateLevel = params.recipientStateLevel;
  if (!recipientStateLevel) return 0;

  const deliveryTargetStateLevel = safeStateLevel(
    params.row.delivery_target_state_level,
  );
  const toStateLevel = safeStateLevel(params.row.to_state_level);
  const fromStateLevel = safeStateLevel(params.row.from_state_level);

  if (deliveryTargetStateLevel === recipientStateLevel) return 80;
  if (toStateLevel === recipientStateLevel) return 60;
  if (fromStateLevel === recipientStateLevel) return 20;

  const nearestStateLevel =
    deliveryTargetStateLevel ?? toStateLevel ?? fromStateLevel;

  if (!nearestStateLevel) return 0;

  const distance = Math.abs(nearestStateLevel - recipientStateLevel);

  if (distance === 1) return 10;
  return 0;
}

function resolveCategoryMatchScore(params: {
  row: FutureChainRecipientSupportBridgeEventRow;
  criteria: RecipientSupportSelectionCriteria;
}): number {
  let score = 0;

  const rowMajorCategory = normalizeNullableText(params.row.major_category);
  const rowMinorCategory = normalizeNullableText(params.row.minor_category);
  const rowChangeTriggerKey = normalizeNullableText(
    params.row.change_trigger_key,
  );

  if (
    params.criteria.recipientMajorCategory &&
    rowMajorCategory === params.criteria.recipientMajorCategory
  ) {
    score += 40;
  }

  if (
    params.criteria.recipientMinorCategory &&
    rowMinorCategory === params.criteria.recipientMinorCategory
  ) {
    score += 25;
  }

  if (
    params.criteria.recipientChangeTriggerKey &&
    rowChangeTriggerKey === params.criteria.recipientChangeTriggerKey
  ) {
    score += 20;
  }

  return score;
}

function scoreRecipientSupportRow(params: {
  row: FutureChainRecipientSupportBridgeEventRow;
  criteria: RecipientSupportSelectionCriteria;
}): number {
  return (
    resolveStateMatchScore({
      row: params.row,
      recipientStateLevel: params.criteria.recipientStateLevel,
    }) +
    resolveCategoryMatchScore({
      row: params.row,
      criteria: params.criteria,
    })
  );
}

function sortRowsByRecipientFit(params: {
  rows: FutureChainRecipientSupportBridgeEventRow[];
  criteria: RecipientSupportSelectionCriteria;
}): FutureChainRecipientSupportBridgeEventRow[] {
  return params.rows
    .map((row, index) => ({
      row,
      index,
      score: scoreRecipientSupportRow({
        row,
        criteria: params.criteria,
      }),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}

function buildRecipientSupportSelection(
  row: FutureChainRecipientSupportBridgeEventRow,
): HopyFutureChainRecipientSupportSelection | null {
  const bridgeEventId = normalizeNullableText(row.id);
  const language = normalizeNullableText(row.language);
  const transitionKind = normalizeNullableText(row.transition_kind);
  const transitionMeaning = normalizeNullableText(row.transition_meaning);
  const sourceAssistantMessageId = normalizeNullableText(
    row.source_assistant_message_id,
  );
  const handoffMessageSnapshot = normalizeHandoffMessageSnapshot(
    row.handoff_message_snapshot,
  );

  if (!bridgeEventId) return null;
  if (!language) return null;
  if (!Number.isInteger(row.from_state_level)) return null;
  if (!Number.isInteger(row.to_state_level)) return null;
  if (!transitionKind) return null;
  if (!transitionMeaning) return null;
  if (!sourceAssistantMessageId) return null;
  if (!handoffMessageSnapshot) return null;

  return {
    bridgeEventId,
    patternId: normalizeNullableText(row.pattern_id),
    language,
    fromStateLevel: Number(row.from_state_level),
    toStateLevel: Number(row.to_state_level),
    deliveryTargetStateLevel: safeStateLevel(row.delivery_target_state_level),
    transitionKind,
    transitionMeaning,
    majorCategory: normalizeNullableText(row.major_category),
    minorCategory: normalizeNullableText(row.minor_category),
    changeTriggerKey: normalizeNullableText(row.change_trigger_key),
    supportShapeKey: normalizeNullableText(row.support_shape_key),
    sourceAssistantMessageId,
    handoffMessageSnapshot,
    futureSupportHint: normalizeNullableText(row.future_support_hint),
    futureVisibleSummary: normalizeNullableText(row.future_visible_summary),
    createdAt: normalizeNullableText(row.created_at),
  };
}

export async function selectFutureChainRecipientSupport(
  params: HopyFutureChainRecipientSupportSelectParams,
): Promise<HopyFutureChainRecipientSupportSelectResult> {
  const normalizedLanguage = normalizeNullableText(params.language);
  const excludeSourceAssistantMessageId = normalizeNullableText(
    params.excludeSourceAssistantMessageId,
  );
  const recipientThreadId = normalizeNullableText(params.recipientThreadId);
  const limit = clampSelectLimit(params.limit);

  const criteria: RecipientSupportSelectionCriteria = {
    recipientStateLevel: safeStateLevel(params.recipientStateLevel),
    recipientMajorCategory: normalizeLooseText(params.recipientMajorCategory),
    recipientMinorCategory: normalizeLooseText(params.recipientMinorCategory),
    recipientChangeTriggerKey: normalizeLooseText(
      params.recipientChangeTriggerKey,
    ),
  };

  const deliveredBridgeEventIds = await loadDeliveredBridgeEventIdsForThread({
    supabase: params.supabase,
    recipientThreadId,
  });

  let query = params.supabase
    .from("hopy_future_chain_bridge_events")
    .select(BRIDGE_EVENT_SELECT_COLUMNS)
    .eq("status", "active")
    .is("deleted_at", null)
    .not("handoff_message_snapshot", "is", null);

  if (normalizedLanguage) {
    query = query.eq("language", normalizedLanguage);
  }

  if (excludeSourceAssistantMessageId) {
    query = query.neq(
      "source_assistant_message_id",
      excludeSourceAssistantMessageId,
    );
  }

  const deliveredBridgeEventFilter = buildUuidInFilter(deliveredBridgeEventIds);

  if (deliveredBridgeEventFilter) {
    query = query.not("id", "in", deliveredBridgeEventFilter);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      ok: false,
      selected: null,
      reason: "recipient_support_select_failed",
      error,
    };
  }

  const rows = Array.isArray(data)
    ? (data as unknown as FutureChainRecipientSupportBridgeEventRow[])
    : [];

  const sortedRows = sortRowsByRecipientFit({
    rows,
    criteria,
  });

  for (const row of sortedRows) {
    const selected = buildRecipientSupportSelection(row);
    if (selected) {
      return {
        ok: true,
        selected,
        reason: "recipient_support_selected",
      };
    }
  }

  return {
    ok: true,
    selected: null,
    reason: "recipient_support_not_found",
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain v3.1 の recipient_support 用に、保存済み hopy_future_chain_bridge_events から、現在ユーザーへ届けてよい handoff_message_snapshot を1件だけ選ぶ。
このファイルは候補選択だけを担当し、delivery_event保存、UI表示、HOPY回答生成、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定、HOPY回答○再判定を担当しない。

【今回このファイルで修正したこと】
- selectFutureChainRecipientSupport(...) の params に recipientStateLevel / recipientMajorCategory / recipientMinorCategory / recipientChangeTriggerKey を追加した。
- hopy_future_chain_bridge_events の delivery_target_state_level を select 対象に追加した。
- 候補行を、現在ユーザーの状態値・カテゴリに近い順で優先できる scoring 処理を追加した。
- delivery_target_state_level / to_state_level / from_state_level と recipientStateLevel の近さを score 化した。
- major_category / minor_category / change_trigger_key が一致する場合に score を加算するようにした。
- 同一スレッドで表示済みの bridge_event_id 除外は維持した。
- delivery_event保存本体、UI表示、owner_handoff保存導線、カテゴリ生成、状態再判定には触れていない。
- HOPY回答全文、Compass全文、ユーザー発話生文を読む処理は入れていない。

/app/api/chat/_lib/hopy/future-chain/futureChainRecipientSupportSelect.ts
*/