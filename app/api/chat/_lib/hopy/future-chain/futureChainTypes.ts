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
  | "weather"
  | "fashion"
  | "daily_life"
  | "romance"
  | "relationships"
  | "family"
  | "parenting"
  | "caregiving"
  | "health"
  | "mental_health"
  | "sleep"
  | "menopause"
  | "pain"
  | "work"
  | "career"
  | "school"
  | "learning"
  | "creation"
  | "development"
  | "business"
  | "money"
  | "housing"
  | "legal"
  | "shopping"
  | "travel"
  | "food"
  | "beauty"
  | "pets"
  | "community"
  | "sns"
  | "life"
  | "hopy"
  | "other";

export type HopyFutureChainMinorCategory =
  | "anxiety"
  | "confusion"
  | "overwhelm"
  | "low_energy"
  | "unclear_thoughts"
  | "unclear_feelings"
  | "decision"
  | "practical_choice"
  | "communication"
  | "boundary"
  | "guilt"
  | "repair"
  | "priority_confusion"
  | "task_overload"
  | "first_step"
  | "continuity"
  | "recovery_pause"
  | "readjustment"
  | "pain"
  | "sleep_issue"
  | "risk_awareness"
  | "self_doubt"
  | "future_uncertainty"
  | "value_clarification"
  | "meaning_loss"
  | "comparison"
  | "loneliness"
  | "anger"
  | "sadness"
  | "trust_issue"
  | "role_pressure"
  | "information_search"
  | "planning";

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
  | "reset_premise"
  | "write_down_one_concern"
  | "name_current_feeling"
  | "notice_inner_reaction"
  | "choose_one_next_step"
  | "narrow_priority"
  | "accept_incomplete_state"
  | "pause_before_action"
  | "break_down_task"
  | "compare_options"
  | "define_success_condition"
  | "ask_one_question"
  | "reconnect_with_reason"
  | "notice_pattern"
  | "continue_small"
  | "handoff_message_snapshot";

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

  handoff_message_snapshot: string | null;
  handoff_snapshot_reason: string | null;
  source_assistant_message_id: string | null;

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
HOPY Future Chain v3.1 用の型定義だけを担当する。
hopy_confirmed_payload.future_chain_context を唯一の起点として、payload読取、保存候補、保存前チェック、DB保存、owner_handoff表示、recipient_support表示で共通利用する型を定義する。
このファイルは保存可否判定、candidate生成、DB insert、UI表示、state_changed再判定、state_level再判定、Compass再判定、HOPY回答再要約を担当しない。

【今回このファイルで修正したこと】
- HopyFutureChainMajorCategory を HOPY会話カテゴリ認識 v1 / Future Chain v3.1 の新カテゴリへ更新しました。
- HopyFutureChainMinorCategory を HOPY会話カテゴリ認識 v1 / Future Chain v3.1 の新カテゴリへ更新しました。
- HopyFutureChainChangeTriggerKey を既存互換を含む v3.1 の許可キーへ更新しました。
- HopyFutureChainConfirmedFutureChainContext に handoff_message_snapshot / handoff_snapshot_reason / source_assistant_message_id を追加しました。
- Future Chain の意味生成、保存可否判定、candidate生成、DB保存、UI表示、state_changed再判定、Compass再判定、HOPY回答再要約は触っていません。

/app/api/chat/_lib/hopy/future-chain/futureChainTypes.ts
*/