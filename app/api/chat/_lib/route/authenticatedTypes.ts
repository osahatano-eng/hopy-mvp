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

export type AuthenticatedChatPayload = {
  ok: true;
  reply: string;
  state: CanonicalAssistantState;
  notification: NotificationState;
  thread: AuthenticatedThreadPayload;
  state_update_ok: boolean;
  state_update_error: string | null;
  state_level: 1 | 2 | 3 | 4 | 5;
  current_phase: 1 | 2 | 3 | 4 | 5;
  state_changed: boolean;
  prev_phase: 1 | 2 | 3 | 4 | 5;
  prev_state_level: 1 | 2 | 3 | 4 | 5;
  assistant_state: CanonicalAssistantState;
  compass?: ConfirmedAssistantCompass;
  hopy_confirmed_payload?: {
    reply: string;
    state: CanonicalAssistantState;
    compass?: ConfirmedAssistantCompass;
  };
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
【今回このファイルで修正したこと】
- 旧 CompassPayload を削除し、現在の正式shapeである ConfirmedAssistantCompass を追加した。
- AuthenticatedChatPayload.compass を必須ではなく optional に修正した。
- AuthenticatedChatPayload.hopy_confirmed_payload の正式受け口を型へ追加した。
- ConfirmedAssistantTurn に compass を追加し、text / prompt の正式shapeを型でも保持できるようにした。
- AuthenticatedModelOutput.compass も ConfirmedAssistantCompass | null にそろえた。

このファイルの正式役割
authenticated 系で使う共通型定義ファイル
*/

/*
このファイルの正式役割
authenticated 系で使う共通型定義ファイル
*/

/*
【今回このファイルで修正したこと】
- Compass の型定義を旧shapeから正式shapeへ統一した。
- payload.compass / hopy_confirmed_payload.compass / confirmedTurn.compass の型ずれを解消した。
- Compass が optional である現在の実装に合わせて AuthenticatedChatPayload を修正した。
*/
// このファイルの正式役割: authenticated 系で使う共通型定義ファイル