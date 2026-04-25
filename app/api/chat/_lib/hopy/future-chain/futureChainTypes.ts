// /app/api/chat/_lib/hopy/future-chain/futureChainTypes.ts

export type HopyFutureChainStateLevel = 1 | 2 | 3 | 4 | 5;

export type HopyFutureChainTransitionKind =
  | "upward"
  | "same_level"
  | "downward";

export type HopyFutureChainTransitionMeaning =
  | "progress"
  | "readjustment"
  | "recovery_entry"
  | "premise_reconsideration"
  | "stabilization"
  | "reinforcement";

export type HopyFutureChainReuseScope =
  | "global"
  | "limited"
  | "experimental";

export type HopyFutureChainStatus = "active" | "trash";

export type HopyFutureChainDecision = "save" | "skip";

export type HopyFutureChainDecisionStatus =
  | HopyFutureChainStatus
  | "none";

export type HopyFutureChainLanguage = "ja" | "en" | string;

export type HopyFutureChainPlan = "free" | "plus" | "pro";

export type HopyFutureChainDisplayMode =
  | "owner_handoff"
  | "recipient_support"
  | "none";

export type HopyFutureChainDeliveryUsage =
  | "owner_handoff"
  | "recipient_support"
  | "both";

export type HopyFutureChainMajorCategory =
  | "work"
  | "relationship"
  | "money"
  | "family"
  | "learning"
  | "development"
  | "creation"
  | "life"
  | "future"
  | "self";

export type HopyFutureChainMinorCategory =
  | "anxiety"
  | "confusion"
  | "decision"
  | "action"
  | "continuity"
  | "relationship"
  | "confidence"
  | "priority"
  | "letting_go"
  | "retry"
  | "visualization";

export type HopyFutureChainChangeTriggerKey =
  | "verbalized"
  | "narrowed_to_one"
  | "noticed_true_feeling"
  | "stated_action"
  | "accepted_discomfort"
  | "found_priority"
  | "found_purpose"
  | "noticed_fear_source"
  | "allowed_to_release"
  | "rested_before_action"
  | "reset_premise";

export type HopyFutureChainSupportShapeKey = string;

export const HOPY_FUTURE_CHAIN_GENERATION_VERSION_V1 =
  "future_chain_generation_v1" as const;

export const HOPY_FUTURE_CHAIN_PATTERN_VERSION_V2 =
  "future_chain_pattern_v2" as const;

export const HOPY_FUTURE_CHAIN_GENERATION_VERSION_V3 =
  "future_chain_generation_v3" as const;

export const HOPY_FUTURE_CHAIN_GENERATION_VERSION =
  HOPY_FUTURE_CHAIN_GENERATION_VERSION_V3;

export type HopyFutureChainCandidateMetadataVersion =
  | typeof HOPY_FUTURE_CHAIN_GENERATION_VERSION_V1
  | typeof HOPY_FUTURE_CHAIN_PATTERN_VERSION_V2
  | typeof HOPY_FUTURE_CHAIN_GENERATION_VERSION_V3;

export type HopyFutureChainConfirmedState = {
  current_phase: HopyFutureChainStateLevel;
  state_level: HopyFutureChainStateLevel;
  prev_phase: HopyFutureChainStateLevel;
  prev_state_level: HopyFutureChainStateLevel;
  state_changed: boolean;
};

export type HopyFutureChainConfirmedCompass = {
  text?: string;
  prompt?: string;
};

export type HopyFutureChainConfirmedFutureChainContext = {
  major_category: HopyFutureChainMajorCategory | null;
  minor_category: HopyFutureChainMinorCategory | null;
  current_stuck_state: string | null;
  true_feeling_hypothesis: string | null;
  change_trigger_candidate: HopyFutureChainChangeTriggerKey | null;
  support_needed: boolean;
  delivery_mode: HopyFutureChainDisplayMode;
};

export type HopyFutureChainConfirmedPayload = {
  reply?: string;
  state?: HopyFutureChainConfirmedState | null;
  compass?: HopyFutureChainConfirmedCompass | null;
  thread_summary?: string;
  memory_candidates?: unknown;
  dashboard_signals?: unknown;
  future_chain_context?: HopyFutureChainConfirmedFutureChainContext | null;
};

export type HopyFutureChainSourceContext = {
  userId: string;
  threadId: string;
  userMessageId: string;
  assistantMessageId: string;
  language: HopyFutureChainLanguage;
  hopyConfirmedPayload: HopyFutureChainConfirmedPayload;
  isFirstUserMessageInThread?: boolean;
  isDevelopmentTest?: boolean;
};

export type HopyFutureChainBridgeSummary = {
  insight: string;
  hint: string;
  flow: string;
  reason: string;
};

export type HopyFutureChainReceiverBridgeSummaryItems = Pick<
  HopyFutureChainBridgeSummary,
  "insight" | "hint" | "flow"
>;

export type HopyFutureChainOwnerBridgeSummaryView = {
  type: "bridge_summary_for_owner";
  title: string;
  subtitle: string;
  note: string;
  items: HopyFutureChainBridgeSummary;
};

export type HopyFutureChainReceiverBridgeSummaryView = {
  type: "bridge_summary_for_receiver";
  title: string;
  subtitle: string;
  note: string;
  items: HopyFutureChainReceiverBridgeSummaryItems;
};

export type HopyFutureChainCandidateMetadata = {
  source: "hopy_confirmed_payload";
  version: HopyFutureChainCandidateMetadataVersion;
};

export type HopyFutureChainBridgeEventCandidate = {
  pattern_id?: string | null;
  language: HopyFutureChainLanguage;
  from_state_level: HopyFutureChainStateLevel;
  to_state_level: HopyFutureChainStateLevel;
  transition_kind: HopyFutureChainTransitionKind;
  transition_meaning: HopyFutureChainTransitionMeaning;
  major_category?: HopyFutureChainMajorCategory | null;
  minor_category?: HopyFutureChainMinorCategory | null;
  change_trigger_key?: HopyFutureChainChangeTriggerKey | null;
  support_shape_key?: HopyFutureChainSupportShapeKey | null;
  delivery_target_state_level?: HopyFutureChainStateLevel | null;
  delivery_usage?: HopyFutureChainDeliveryUsage | null;
  user_signal_summary: string;
  hopy_support_summary: string;
  transition_reason: string;
  future_support_hint: string;
  bridge_insight: string;
  bridge_hint: string;
  bridge_flow: string;
  bridge_reason: string;
  owner_visible_summary: string;
  future_visible_summary: string;
  compass_basis: string | null;
  safety_notes: string | null;
  avoidance_notes: string | null;
  source_transition_signal_id?: string | null;
  source_assistant_message_id: string;
  source_trigger_message_id?: string | null;
  confidence_score: number;
  reuse_scope: HopyFutureChainReuseScope;
  status: HopyFutureChainStatus;
  metadata: HopyFutureChainCandidateMetadata;
};

export type HopyFutureChainCandidate = {
  pattern_key: string;
  language: HopyFutureChainLanguage;
  from_state_level: HopyFutureChainStateLevel;
  to_state_level: HopyFutureChainStateLevel;
  transition_kind: HopyFutureChainTransitionKind;
  transition_meaning: HopyFutureChainTransitionMeaning;
  support_shape_key: HopyFutureChainSupportShapeKey;
  major_category?: HopyFutureChainMajorCategory | null;
  minor_category?: HopyFutureChainMinorCategory | null;
  change_trigger_key?: HopyFutureChainChangeTriggerKey | null;
  delivery_target_state_level?: HopyFutureChainStateLevel | null;
  delivery_usage?: HopyFutureChainDeliveryUsage | null;
  abstract_context: string;
  transition_reason: string;
  effective_support: string;
  user_progress_signal: string;
  future_support_hint: string;
  bridge_summary?: HopyFutureChainBridgeSummary | null;
  bridge_event?: HopyFutureChainBridgeEventCandidate | null;
  compass_basis: string | null;
  safety_notes: string | null;
  avoidance_notes: string | null;
  evidence_count: number;
  weight: number;
  confidence_score: number;
  reuse_scope: HopyFutureChainReuseScope;
  status: HopyFutureChainStatus;
  metadata: HopyFutureChainCandidateMetadata;
  source_transition_signal_id?: string | null;
  source_response_learning_id?: string | null;
  source_learning_insight_id?: string | null;
};

export type HopyFutureChainSaveCheckResult =
  | {
      decision: "save";
      reason: string;
      status: HopyFutureChainStatus;
      candidate: HopyFutureChainCandidate;
    }
  | {
      decision: "skip";
      reason: string;
      status: "none";
      candidate?: undefined;
    };

export type HopyFutureChainInsertResult =
  | {
      ok: true;
      patternId: string | null;
      bridgeEventId?: string | null;
      deliveryEventId?: string | null;
    }
  | {
      ok: false;
      error: unknown;
    };

/*
【このファイルの正式役割】
HOPY Future Chain DB 用の型定義だけを担当する。
hopy_confirmed_payload を起点にした保存可否チェック、candidate生成、DB保存、本人表示、受け取り側表示で共通利用する型を定義する。
このファイルは保存可否判定、candidate生成、DB insert、state_changed再判定、state_level再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- metadata.version が "future_chain_generation_v1" 固定になっていた状態をやめ、v1 / v2途中実装 / v3 を受けられる HopyFutureChainCandidateMetadataVersion を追加した。
- Future Chain v3 DB定義に合わせて、plan / display_mode / transition_meaning / major_category / minor_category / change_trigger_key / delivery_usage の型を追加した。
- hopy_confirmed_payload 側で確定する future_chain_context の型 HopyFutureChainConfirmedFutureChainContext を追加した。
- hopy_future_chain_bridge_events 保存候補用の HopyFutureChainBridgeEventCandidate を追加した。
- HopyFutureChainCandidate に v3追加カラムと bridge_event を受けられる型を追加した。
- このファイルでは、保存可否判定、candidate生成、DB保存、UI表示、state_changed再判定、Compass再判定は触っていない。

/app/api/chat/_lib/hopy/future-chain/futureChainTypes.ts
*/