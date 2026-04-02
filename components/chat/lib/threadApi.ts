// /components/chat/lib/threadApi.ts
"use client";

// ✅ threadApi の公開窓口（re-export）
// - 既存 import を壊さずに、内部実装を分割ファイルへ移した構成

// fetchThreads
export { fetchThreads } from "./threadApiFetchThreads";
export type { ThreadsResult } from "./threadApiFetchThreads";

// ensureActiveThread
export { ensureActiveThread } from "./threadApiEnsureActiveThread";
export type { EnsureActiveThreadArgs, EnsureResult } from "./threadApiEnsureActiveThread";

// mutations
export { updateThreadStateLevel, renameThread, deleteThread } from "./threadApiMutations";

// messages
export { loadMessages } from "./threadApiMessages";
export type { LoadMessagesStateArgs } from "./threadApiMessages";