// /app/api/chat/_lib/route/authenticatedHelpers.ts

import {
  extractLearningBlockFromBaseSystemPrompt,
  loadLearningBlock,
  loadLearningPromptContext,
  saveUserPhraseLearning,
  saveAssistantLearningLogs,
  saveConfirmedAssistantLearningEntry,
  type UserPhraseLearningOutcome,
  type AssistantLearningLogsOutcome,
  type LearningInsightRow,
  type ConfirmedLearningSaveOutcome,
} from "./authenticatedLearning";
import {
  normalizeConfirmedMemoryCandidates,
  type ConfirmedMemoryCandidate,
} from "./authenticatedMemoryCandidates";
import { buildAuthenticatedChatPayload } from "./authenticatedPayload";
import {
  normalizeConfirmedStateLevel,
  buildConfirmedAssistantTurn,
} from "./authenticatedState";
import {
  saveUserMessageOrError,
  runAutoRename,
  saveAssistantMessageOrError,
} from "./authenticatedWrite";
import type { MemoryWriteDebug } from "./authenticatedTypes";

/* -----------------------------
 * state / confirmed turn
 * ----------------------------- */

export { normalizeConfirmedStateLevel, buildConfirmedAssistantTurn };

/* -----------------------------
 * memory re-exports
 * ----------------------------- */

export { normalizeConfirmedMemoryCandidates };
export type { ConfirmedMemoryCandidate };

export function createDefaultMemoryWriteDebug(
  reason: string,
): MemoryWriteDebug {
  return {
    mem_write_attempted: false,
    mem_write_allowed: false,
    mem_write_inserted: 0,
    mem_write_reason: reason,
    mem_items_count: 0,
    mem_parse_ok: null,
    mem_extract_preview: null,
    mem_used_heuristic: false,
  };
}

/* -----------------------------
 * learning re-exports
 * ----------------------------- */

export {
  extractLearningBlockFromBaseSystemPrompt,
  loadLearningBlock,
  loadLearningPromptContext,
  saveUserPhraseLearning,
  saveAssistantLearningLogs,
  saveConfirmedAssistantLearningEntry,
};

export type {
  UserPhraseLearningOutcome,
  AssistantLearningLogsOutcome,
  LearningInsightRow,
  ConfirmedLearningSaveOutcome,
};

/* -----------------------------
 * payload builder
 * ----------------------------- */

export { buildAuthenticatedChatPayload };

/* -----------------------------
 * message / title write helpers
 * ----------------------------- */

export {
  saveUserMessageOrError,
  runAutoRename,
  saveAssistantMessageOrError,
};