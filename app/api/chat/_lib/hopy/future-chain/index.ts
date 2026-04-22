// /app/api/chat/_lib/hopy/future-chain/index.ts

export { saveFutureChainFromConfirmedPayload } from "./futureChainService";

export type { SaveFutureChainFromConfirmedPayloadResult } from "./futureChainService";

export {
  HOPY_FUTURE_CHAIN_GENERATION_VERSION,
  type HopyFutureChainCandidate,
  type HopyFutureChainConfirmedCompass,
  type HopyFutureChainConfirmedPayload,
  type HopyFutureChainConfirmedState,
  type HopyFutureChainDecision,
  type HopyFutureChainDecisionStatus,
  type HopyFutureChainInsertResult,
  type HopyFutureChainLanguage,
  type HopyFutureChainSaveCheckResult,
  type HopyFutureChainSourceContext,
  type HopyFutureChainStateLevel,
  type HopyFutureChainStatus,
  type HopyFutureChainTransitionKind,
} from "./futureChainTypes";

/*
【このファイルの正式役割】
HOPY Future Chain 専用フォルダの公開入口だけを担当する。
既存ファイル側が future-chain 内部の check / candidate / repository / service を深いパスで直接 import しないように、外へ出すものをこのファイルに集約する。
このファイルは保存前チェック、candidate生成、DB insert、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- Future Chain 専用フォルダ内に、公開入口 index.ts を新規作成した。
- 外部から使う入口関数 saveFutureChainFromConfirmedPayload を export した。
- 外部接続に必要な型だけを export した。
- check / candidate / repository の実装関数は直接 export せず、責務の入口を service に寄せた。

/app/api/chat/_lib/hopy/future-chain/index.ts
*/