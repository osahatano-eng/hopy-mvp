// /app/api/chat/_lib/hopy/future-chain/index.ts

export { saveFutureChainFromConfirmedPayload } from "./futureChainService";

export type { SaveFutureChainFromConfirmedPayloadResult } from "./futureChainService";

export {
  HOPY_FUTURE_CHAIN_GENERATION_VERSION,
  HOPY_FUTURE_CHAIN_GENERATION_VERSION_V1,
  HOPY_FUTURE_CHAIN_GENERATION_VERSION_V3,
  HOPY_FUTURE_CHAIN_PATTERN_VERSION_V2,
  type HopyFutureChainBridgeEventCandidate,
  type HopyFutureChainBridgeSummary,
  type HopyFutureChainCandidate,
  type HopyFutureChainCandidateMetadata,
  type HopyFutureChainCandidateMetadataVersion,
  type HopyFutureChainChangeTriggerKey,
  type HopyFutureChainConfirmedCompass,
  type HopyFutureChainConfirmedFutureChainContext,
  type HopyFutureChainConfirmedPayload,
  type HopyFutureChainConfirmedState,
  type HopyFutureChainDecision,
  type HopyFutureChainDecisionStatus,
  type HopyFutureChainDeliveryUsage,
  type HopyFutureChainDisplayMode,
  type HopyFutureChainInsertResult,
  type HopyFutureChainLanguage,
  type HopyFutureChainMajorCategory,
  type HopyFutureChainMinorCategory,
  type HopyFutureChainOwnerBridgeSummaryView,
  type HopyFutureChainPlan,
  type HopyFutureChainReceiverBridgeSummaryItems,
  type HopyFutureChainReceiverBridgeSummaryView,
  type HopyFutureChainReuseScope,
  type HopyFutureChainSaveCheckResult,
  type HopyFutureChainSourceContext,
  type HopyFutureChainStateLevel,
  type HopyFutureChainStatus,
  type HopyFutureChainSupportShapeKey,
  type HopyFutureChainTransitionKind,
  type HopyFutureChainTransitionMeaning,
} from "./futureChainTypes";

/*
【このファイルの正式役割】
HOPY Future Chain 専用フォルダの公開入口だけを担当する。
既存ファイル側が future-chain 内部の check / candidate / repository / service / types を深いパスで直接 import しないように、外へ出すものをこのファイルに集約する。
このファイルは保存前チェック、candidate生成、DB insert、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- Future Chain v3 で追加した plan / display_mode / delivery_usage / category / change_trigger / transition_meaning / bridge_event 系の型を公開入口から export した。
- HOPY_FUTURE_CHAIN_GENERATION_VERSION_V1 / HOPY_FUTURE_CHAIN_PATTERN_VERSION_V2 / HOPY_FUTURE_CHAIN_GENERATION_VERSION_V3 も公開入口から export した。
- 外部ファイルが futureChainTypes.ts を深いパスで直接 import しなくても、v3型を index.ts 経由で受け取れるようにした。
- 保存前チェック、candidate生成、DB insert、DB制約、UI、HOPY回答○、Compass表示、MEMORIES、DASHBOARDには触れていない。

/app/api/chat/_lib/hopy/future-chain/index.ts
*/