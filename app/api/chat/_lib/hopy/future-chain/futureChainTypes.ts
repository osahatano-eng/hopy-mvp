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

export type HopyFutureChainDeliveryEventStatus =
  | "shown"
  | "skipped"
  | "trash";

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

export type HopyFutureChainCandidateMetadataSource =
  | "hopy_confirmed_payload"
  | "hopy_confirmed_payload.future_chain_context";

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

export type HopyFutureChainOwnerHandoff = {
  insight: string | null;
  hint: string | null;
  flow: string | null;
  reason: string | null;
};

export type HopyFutureChainRecipientSupportQuery = {
  target_state_level: HopyFutureChainStateLevel | null;
  major_category: HopyFutureChainMajorCategory | null;
  minor_category: HopyFutureChainMinorCategory | null;
  change_trigger_key: HopyFutureChainChangeTriggerKey | null;
  support_shape_key: HopyFutureChainSupportShapeKey | null;
};

export type HopyFutureChainConfirmedFutureChainContext = {
  delivery_mode: HopyFutureChainDisplayMode;

  major_category: HopyFutureChainMajorCategory | null;
  minor_category: HopyFutureChainMinorCategory | null;

  current_stuck_state: string | null;
  true_feeling_hypothesis: string | null;
  change_trigger_key: HopyFutureChainChangeTriggerKey | null;

  support_needed: boolean;

  transition_kind: HopyFutureChainTransitionKind | null;
  transition_meaning: HopyFutureChainTransitionMeaning | null;

  support_shape_key: HopyFutureChainSupportShapeKey | null;

  owner_handoff: HopyFutureChainOwnerHandoff | null;

  recipient_support_query: HopyFutureChainRecipientSupportQuery | null;
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

export type HopyFutureChainRecipientSupportItems = Pick<
  HopyFutureChainBridgeSummary,
  "insight" | "hint" | "flow"
>;

export type HopyFutureChainReceiverBridgeSummaryItems =
  HopyFutureChainRecipientSupportItems;

export type HopyFutureChainOwnerBridgeSummaryView = {
  type: "bridge_summary_for_owner";
  title: string;
  subtitle: string;
  note: string;
  items: HopyFutureChainBridgeSummary;
};

export type HopyFutureChainRecipientSupportView = {
  type: "bridge_summary_for_recipient";
  title: string;
  subtitle: string;
  note: string;
  items: HopyFutureChainRecipientSupportItems;
};

export type HopyFutureChainReceiverBridgeSummaryView =
  HopyFutureChainRecipientSupportView;

export type HopyFutureChainCandidateMetadata = {
  source: HopyFutureChainCandidateMetadataSource;
  version: HopyFutureChainCandidateMetadataVersion;
  raw_log_saved?: false;
  generation?: "owner_handoff" | "recipient_support" | "none" | string;
};

export type HopyFutureChainPatternCandidate = {
  pattern_key: string;
  language: HopyFutureChainLanguage;

  from_state_level: HopyFutureChainStateLevel;
  to_state_level: HopyFutureChainStateLevel;

  transition_kind: HopyFutureChainTransitionKind;
  transition_meaning: HopyFutureChainTransitionMeaning;

  support_shape_key: HopyFutureChainSupportShapeKey;

  major_category: HopyFutureChainMajorCategory;
  minor_category: HopyFutureChainMinorCategory;
  change_trigger_key: HopyFutureChainChangeTriggerKey;

  delivery_target_state_level: HopyFutureChainStateLevel | null;
  delivery_usage: HopyFutureChainDeliveryUsage;

  evidence_count: number;
  weight: number;
  confidence_score: number;

  reuse_scope: HopyFutureChainReuseScope;
  status: HopyFutureChainStatus;

  metadata: HopyFutureChainCandidateMetadata;
};

export type HopyFutureChainBridgeEventCandidate = {
  pattern_id?: string | null;

  owner_user_id: string;

  language: HopyFutureChainLanguage;

  from_state_level: HopyFutureChainStateLevel;
  to_state_level: HopyFutureChainStateLevel;

  transition_kind: HopyFutureChainTransitionKind;
  transition_meaning: HopyFutureChainTransitionMeaning;

  major_category: HopyFutureChainMajorCategory;
  minor_category: HopyFutureChainMinorCategory;
  change_trigger_key: HopyFutureChainChangeTriggerKey;
  support_shape_key: HopyFutureChainSupportShapeKey;

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

  source_transition_signal_id?: string | null;
  source_assistant_message_id: string;
  source_trigger_message_id?: string | null;

  delivery_eligible: boolean;

  confidence_score: number;
  reuse_scope: HopyFutureChainReuseScope;
  status: HopyFutureChainStatus;

  safety_notes: string | null;
  avoidance_notes: string | null;

  metadata: HopyFutureChainCandidateMetadata;
};

export type HopyFutureChainDeliveryEventCandidate = {
  bridge_event_id: string;
  pattern_id?: string | null;

  owner_user_id?: string | null;
  recipient_user_id: string;

  recipient_thread_id?: string | null;
  recipient_assistant_message_id?: string | null;

  recipient_state_level: HopyFutureChainStateLevel;

  major_category: HopyFutureChainMajorCategory;
  minor_category: HopyFutureChainMinorCategory;
  change_trigger_key: HopyFutureChainChangeTriggerKey | null;
  support_shape_key: HopyFutureChainSupportShapeKey | null;

  display_title: string;
  display_insight: string;
  display_hint: string;
  display_flow: string;

  delivery_reason: string;

  owner_notified: boolean;
  owner_notified_at?: string | null;

  status: HopyFutureChainDeliveryEventStatus;

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

  major_category: HopyFutureChainMajorCategory;
  minor_category: HopyFutureChainMinorCategory;
  change_trigger_key: HopyFutureChainChangeTriggerKey;

  delivery_target_state_level: HopyFutureChainStateLevel | null;
  delivery_usage: HopyFutureChainDeliveryUsage;

  abstract_context: string;
  transition_reason: string;
  effective_support: string;
  user_progress_signal: string;
  future_support_hint: string;

  bridge_summary: HopyFutureChainBridgeSummary;
  bridge_event: HopyFutureChainBridgeEventCandidate;

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
HOPY Future Chain v3 用の型定義だけを担当する。
hopy_confirmed_payload.future_chain_context を唯一の起点として、payload読取、保存候補、保存前チェック、DB保存、owner_handoff表示、recipient_support表示で共通利用する型を定義する。
このファイルは保存可否判定、candidate生成、DB insert、UI表示、state_changed再判定、state_level再判定、Compass再判定、HOPY回答再要約を担当しない。

【今回このファイルで修正したこと】
- hopy_future_chain_bridge_events のDB実態に合わせて、HopyFutureChainBridgeEventCandidate に user_signal_summary / hopy_support_summary / transition_reason / future_support_hint を追加した。
- hopy_future_chain_bridge_events のDB実態に合わせて、HopyFutureChainBridgeEventCandidate に delivery_target_state_level / delivery_usage を任意項目として追加した。
- futureChainRepository.ts が bridge_event 保存payloadを作るときに、DB実在カラムを型安全に参照できるようにした。
- このファイルでは、保存可否判定、candidate生成、DB保存、UI表示、state_changed再判定、Compass再判定、HOPY回答再要約は触っていない。

/app/api/chat/_lib/hopy/future-chain/futureChainTypes.ts
*/