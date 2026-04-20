// /components/chat/lib/useChatInitParts.ts
"use client";

export {
  createThreadsRefreshHandler,
  createSelectThreadHandler,
} from "./useChatInitEventHandlers";
export type { ThreadsRefreshHandlerArgs } from "./useChatInitEventHandlers";

export {
  isSessionUsable,
  shouldHandleAuthEventWithRefs,
  getSessionWithRetry,
} from "./useChatInitSession";
export type { ShouldHandleAuthRefs } from "./useChatInitSession";

export { fetchUserStateOnly } from "./useChatInitUserState";
export type { UseChatInitUserStateParams } from "./useChatInitUserState";

export {
  fetchThreadsOnly,
  fetchThreadsWithRetry,
} from "./useChatInitThreads";
export type {
  FetchThreadsWithRetryResult,
  UseChatInitThreadsParams,
} from "./useChatInitThreads";

export {
  readPreferredActiveThreadId,
  resolveActiveThreadTarget,
  pickInitialThreadId,
  persistActiveThreadId,
  clearStoredActiveThreadId,
} from "./useChatInitActiveThread";
export type { ResolveActiveThreadTargetResult } from "./useChatInitActiveThread";

export {
  resolveClientRequestIdForCreate,
  createMergeSetThreads,
  resetForForcedCreate,
  ensureForcedActiveThread,
  createCreateThreadHandler,
} from "./useChatInitCreateThread";
export type { UseChatInitCreateThreadParams } from "./useChatInitCreateThread";

export {
  createInitController,
} from "./useChatInitControllerCore";
export type {
  UseChatInitParams,
  PendingInit,
  InitControllerArgs,
} from "./useChatInitControllerCore";

export {
  IS_DEV,
  isDebugLogEnabled,
  sleep,
  logInfo,
  logWarn,
  microtask,
  errText,
  getCustomDetail,
} from "./useChatInitUtils";

/*
このファイルの正式役割:
チャット初期化まわりの再エクスポート専用ファイル。
各責務ファイルへの入口をまとめるだけを担当する。
初期化本線は useChatInitControllerCore.ts が担う。
profile / plan / userState 取得本体は useChatInitUserState.ts が担う。
threads 取得本体は useChatInitThreads.ts が担う。
activeThread 復元補助は useChatInitActiveThread.ts が担う。
新規 thread 作成制御は useChatInitCreateThread.ts が担う。
補助ユーティリティは useChatInitUtils.ts が担う。
このファイルは session / profile / plan / threads / activeThread / createThread / messages / HOPY状態 / Compass / confirmed payload の正を作らない。
*/

/*
【今回このファイルで修正したこと】
1. createInitController 本体を useChatInitControllerCore.ts へ分離しました。
2. UseChatInitParams / PendingInit / InitControllerArgs の型定義を useChatInitControllerCore.ts へ分離しました。
3. useChatInitParts.ts から init 本線、session 判定、threads 取得後処理、activeThread 復元、新規 thread 作成制御の実装本体を削除しました。
4. このファイルは各責務ファイルを re-export するだけの入口ファイルに寄せました。
5. 既存の外部 import を壊さないため、これまで useChatInitParts.ts から参照されていた関数・型は re-export として残しています。
6. 本文表示、messages取得、送信、MEMORIES には触っていません。
7. HOPY唯一の正、confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階、DB保存・復元仕様には触っていません。
*/

/* /components/chat/lib/useChatInitParts.ts */