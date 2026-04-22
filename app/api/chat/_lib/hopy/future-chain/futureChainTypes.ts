// /app/api/chat/_lib/hopy/future-chain/futureChainTypes.ts

export type HopyFutureChainStateLevel = 1 | 2 | 3 | 4 | 5;

export type HopyFutureChainTransitionKind =
  | "upward"
  | "same_level"
  | "downward";

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

export const HOPY_FUTURE_CHAIN_GENERATION_VERSION =
  "future_chain_generation_v1" as const;

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

export type HopyFutureChainConfirmedPayload = {
  reply?: string;
  state?: HopyFutureChainConfirmedState | null;
  compass?: HopyFutureChainConfirmedCompass | null;
  thread_summary?: string;
  memory_candidates?: unknown;
  dashboard_signals?: unknown;
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

export type HopyFutureChainCandidateMetadata = {
  source: "hopy_confirmed_payload";
  version: typeof HOPY_FUTURE_CHAIN_GENERATION_VERSION;
};

export type HopyFutureChainCandidate = {
  pattern_key: string;
  language: HopyFutureChainLanguage;
  from_state_level: HopyFutureChainStateLevel;
  to_state_level: HopyFutureChainStateLevel;
  transition_kind: HopyFutureChainTransitionKind;
  abstract_context: string;
  transition_reason: string;
  effective_support: string;
  user_progress_signal: string;
  future_support_hint: string;
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
    }
  | {
      ok: false;
      error: unknown;
    };

/*
【このファイルの正式役割】
HOPY Future Chain DB 用の型定義だけを担当する。
hopy_confirmed_payload を起点にした保存可否チェック、candidate生成、DB保存で共通利用する型を定義する。
このファイルは保存可否判定、candidate生成、DB insert、state_changed再判定、state_level再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- Future Chain 専用フォルダの最初の新規ファイルとして、型定義だけを作成した。
- 状態値は 1..5 に固定し、0..4 前提を入れていない。
- transition_kind は Future Chain 用の upward / same_level / downward に固定した。
- hopy_confirmed_payload を起点にするための confirmed payload 型と source context 型を定義した。
- 保存候補、保存可否チェック結果、DB insert 結果の型を定義した。
- 保存可否判定、candidate生成、DB保存処理はまだ実装していない。

/app/api/chat/_lib/hopy/future-chain/futureChainTypes.ts
*/