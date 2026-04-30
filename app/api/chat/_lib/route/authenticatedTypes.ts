// /app/api/chat/_lib/route/authenticatedTypes.ts

import type { PromptBundle } from "./promptBundle";
import type { Lang } from "../router/simpleRouter";
import type { NotificationState } from "../state/notification";

export type SaveUserMessageOutcome =
  | { ok: true; userMessageId: string }
  | { ok: false; status: number; payload: any };

export type SaveAssistantMessageOutcome =
  | { ok: true; assistantMessageId: string; insAsstOk: boolean }
  | { ok: false; status: number; payload: any };

export type AutoTitleOutcome = {
  auto_title_ok: boolean | null;
  auto_title_updated: boolean | null;
  auto_title_reason: string | null;
  auto_title_title: string | null;
};

export type CanonicalAssistantState = {
  current_phase: 1 | 2 | 3 | 4 | 5;
  state_level: 1 | 2 | 3 | 4 | 5;
  prev_phase: 1 | 2 | 3 | 4 | 5;
  prev_state_level: 1 | 2 | 3 | 4 | 5;
  state_changed: boolean;
};

export type ConfirmedAssistantCompass = {
  text: string;
  prompt: string | null;
};

export type ConfirmedAssistantTurn = {
  assistantText: string;
  currentPhase: 1 | 2 | 3 | 4 | 5;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
  prevPhase: 1 | 2 | 3 | 4 | 5;
  prevStateLevel: 1 | 2 | 3 | 4 | 5;
  stateChanged: boolean;
  compassText?: string;
  compassPrompt?: string;
  compass?: ConfirmedAssistantCompass;
  canonicalAssistantState: CanonicalAssistantState;
};

export type AuthenticatedThreadPayload = {
  id: string;
  title: string;
  state_level: 1 | 2 | 3 | 4 | 5;
  current_phase: 1 | 2 | 3 | 4 | 5;
  state_changed: boolean;
  prev_phase: 1 | 2 | 3 | 4 | 5;
  prev_state_level: 1 | 2 | 3 | 4 | 5;
  client_request_id?: string;
};

export type AuthenticatedHopyConfirmedPayload = {
  reply: string;
  state: CanonicalAssistantState;
  compass?: ConfirmedAssistantCompass;
  future_chain_context?: Record<string, unknown> | null;
  thread_summary?: unknown;
  memory_candidates?: unknown;
  dashboard_signals?: unknown;
  notification_signal?: unknown;
  ui_effects?: unknown;
};

export type AuthenticatedChatPayload = {
  ok: true;
  notification: NotificationState;
  thread: AuthenticatedThreadPayload;
  state_update_ok: boolean;
  state_update_error: string | null;
  hopy_confirmed_payload?: AuthenticatedHopyConfirmedPayload;
  future_chain_persist?: unknown;
  future_chain_display?: unknown;
  future_chain_delivery_event?: unknown;
  debug?: Record<string, unknown>;
  memory_clean?: any;
};

export type MemoryWriteDebug = {
  mem_write_attempted: boolean;
  mem_write_allowed: boolean;
  mem_write_inserted: number;
  mem_write_reason: string | null;
  mem_items_count: number;
  mem_parse_ok: boolean | null;
  mem_extract_preview: any;
  mem_used_heuristic: boolean;
};

export type LoadedAuthenticatedContext = {
  history: any[];
};

export type AuthenticatedPromptInput = {
  promptBundle: PromptBundle;
  history: any[];
  userText: string;
  replyLang: Lang;
  currentPhase: 1 | 2 | 3 | 4 | 5;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
  prevPhase: 1 | 2 | 3 | 4 | 5;
  prevStateLevel: 1 | 2 | 3 | 4 | 5;
  stateChanged: boolean;
};

export type AuthenticatedModelOutput = {
  assistantText: string;
  openai_ok: boolean | null;
  openai_error: string | null;
  confirmed_memory_candidates?: unknown[] | null;
  state: Record<string, unknown> | null;
  hopy_confirmed_payload?: Record<string, unknown> | null;
  reply?: string | null;
  ui_effects?: Record<string, unknown> | null;
  compass?: ConfirmedAssistantCompass | null;
  compassText?: string | null;
  compassPrompt?: string | null;
};

/*
【このファイルの正式役割】
authenticated 系で使う共通型定義ファイル。
authenticated 経路の user / assistant 保存結果、確定済み assistant turn、payload土台、prompt input、model output の型を定義する。
このファイルは型定義だけを担当し、DB取得、DB保存、state_changed生成、Compass生成、HOPY回答○表示、Future Chain保存、MEMORIES保存、Learning保存、UI表示は担当しない。

【今回このファイルで修正したこと】
- AuthenticatedChatPayload から、現在の実装では返していない old top-level reply / state / state_level / current_phase / state_changed / prev_phase / prev_state_level / assistant_state / compass を削除した。
- HOPY唯一の正を payload.hopy_confirmed_payload に寄せるため、AuthenticatedHopyConfirmedPayload を追加した。
- thread.state_level / thread.current_phase / thread.state_changed / thread.prev系 は、thread 表示用の確定状態投影として維持した。
- future_chain_persist / future_chain_display / future_chain_delivery_event / debug は、postTurn finalize 後に付与される中継値として optional にした。
- ConfirmedAssistantTurn / CanonicalAssistantState / ConfirmedAssistantCompass / AuthenticatedModelOutput の既存shapeは維持した。
- state値は 1..5 のまま維持し、0..4 前提にはしていない。
- HOPY唯一の正、Compass生成、Future Chain保存、MEMORIES保存、Learning保存、DB保存、UI表示には触れていない。

/app/api/chat/_lib/route/authenticatedTypes.ts
*/