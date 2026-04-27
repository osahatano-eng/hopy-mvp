// /app/api/chat/_lib/hopy/future-chain/index.ts

export { saveFutureChainFromConfirmedPayload } from "./futureChainService";

export type { SaveFutureChainFromConfirmedPayloadResult } from "./futureChainService";

export { executeFutureChainSaveFlow } from "./futureChainSaveFlow";

export type {
  ExecuteFutureChainSaveFlowParams,
  ExecuteFutureChainSaveFlowResult,
  FutureChainSaveFlowStage,
} from "./futureChainSaveFlow";

export { buildFutureChainDisplayPayload } from "./futureChainDisplayPayload";

export type {
  BuildFutureChainDisplayPayloadParams,
  HopyFutureChainDisplayDetailLevel,
  HopyFutureChainDisplayKind,
  HopyFutureChainDisplayPayload,
  HopyFutureChainDisplayPlacement,
  HopyFutureChainDisplayPlan,
  HopyFutureChainRecipientSupportDisplaySource,
} from "./futureChainDisplayPayload";

export { selectFutureChainRecipientSupport } from "./futureChainRecipientSupportSelect";

export type {
  HopyFutureChainRecipientSupportSelection,
  HopyFutureChainRecipientSupportSelectParams,
  HopyFutureChainRecipientSupportSelectResult,
} from "./futureChainRecipientSupportSelect";

export { saveFutureChainDeliveryEventForPayload } from "./futureChainDeliveryEvent";

export type {
  SaveFutureChainDeliveryEventParams,
  SaveFutureChainDeliveryEventResult,
} from "./futureChainDeliveryEvent";

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
既存ファイル側が future-chain 内部の check / candidate / repository / service / types / saveFlow / displayPayload / recipientSupportSelect / deliveryEvent を深いパスで直接 import しないように、外へ出すものをこのファイルに集約する。
このファイルは保存前チェック、candidate生成、DB insert、recipient_support候補選択本体、delivery_event保存本体、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定、UI表示判定を担当しない。

【今回このファイルで修正したこと】
- futureChainDeliveryEvent.ts の saveFutureChainDeliveryEventForPayload を export した。
- SaveFutureChainDeliveryEventParams / SaveFutureChainDeliveryEventResult 型を export した。
- 既存の saveFlow / displayPayload / recipientSupportSelect / futureChainTypes の export は維持した。
- delivery_event保存本体、recipient_support候補選択、DB insert実行、DB制約、UI本体、HOPY回答○、Compass表示、MEMORIES、DASHBOARDには触れていない。

/app/api/chat/_lib/hopy/future-chain/index.ts
*/