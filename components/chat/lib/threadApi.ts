// /components/chat/lib/threadApi.ts
"use client";

export { fetchThreads } from "./threadApiFetchThreads";
export type { ThreadsResult } from "./threadApiFetchThreads";

export { ensureActiveThread } from "./threadApiEnsureActiveThread";
export type {
  EnsureActiveThreadArgs,
  EnsureResult,
} from "./threadApiEnsureActiveThread";

export {
  updateThreadStateLevel,
  renameThread,
  deleteThread,
} from "./threadApiMutations";

export { loadMessages } from "./threadApiMessages";
export type { LoadMessagesStateArgs } from "./threadApiMessages";

/*
このファイルの正式役割:
thread API の公開窓口だけを持つ barrel。実装は持たず、既存 import を壊さずに各責務ファイルの export を束ねるだけ。

【今回このファイルで修正したこと】
公開窓口の役割だけが見えるように、説明用の装飾コメントを削除し、re-export だけが残る形に整理した。

/components/chat/lib/threadApi.ts
*/