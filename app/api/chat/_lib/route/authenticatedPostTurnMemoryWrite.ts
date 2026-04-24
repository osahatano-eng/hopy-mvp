// /app/api/chat/_lib/route/authenticatedPostTurnMemoryWrite.ts

import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Lang } from "../router/simpleRouter";
import { handleMemoryWrite } from "./memoryWrite";
import type { ConfirmedMemoryCandidate } from "./authenticatedHelpers";
import { createDefaultMemoryWriteDebug } from "./authenticatedHelpers";

type HandleMemoryWriteInput = Parameters<typeof handleMemoryWrite>[0];

type MemoryWriteDebug = {
  mem_write_attempted: boolean;
  mem_write_allowed?: boolean | null;
  mem_parse_ok?: boolean | null;
  mem_items_count?: number | null;
  mem_used_heuristic?: boolean | null;
  [key: string]: any;
};

export type AuthenticatedPostTurnMemoryWriteParams = {
  openai: OpenAI;
  modelName: string;
  memoryExtractTimeoutMs: number;
  memoryMinIntervalSec: number;
  debugSave: boolean;
  supabase: SupabaseClient;
  authedUserId: string;
  assistantMessageId: string;
  resolvedConversationId: string;
  uiLang: Lang;
  routed: {
    tone: HandleMemoryWriteInput["routedTone"];
    intensity: number;
  };
  usedHeuristicConfirmedMemoryCandidates: boolean;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
  currentPhase: 1 | 2 | 3 | 4 | 5;
  stateChanged: boolean;
  confirmedMemoryCandidates: ConfirmedMemoryCandidate[];
};

export type AuthenticatedPostTurnMemoryWriteResult = {
  memoryWrite: MemoryWriteDebug;
  mem_write_ok: boolean | null;
  mem_write_error: string | null;
};

export async function executeAuthenticatedPostTurnMemoryWrite({
  openai,
  modelName,
  memoryExtractTimeoutMs,
  memoryMinIntervalSec,
  debugSave,
  supabase,
  authedUserId,
  assistantMessageId,
  resolvedConversationId,
  uiLang,
  routed,
  usedHeuristicConfirmedMemoryCandidates,
  currentStateLevel,
  currentPhase,
  stateChanged,
  confirmedMemoryCandidates,
}: AuthenticatedPostTurnMemoryWriteParams): Promise<AuthenticatedPostTurnMemoryWriteResult> {
  let memoryWrite: MemoryWriteDebug =
    createDefaultMemoryWriteDebug("not_attempted");

  let mem_write_ok: boolean | null = null;
  let mem_write_error: string | null = null;

  try {
    if (confirmedMemoryCandidates.length <= 0) {
      memoryWrite = {
        ...createDefaultMemoryWriteDebug("no_confirmed_memory_candidates"),
        mem_write_attempted: true,
        mem_write_allowed: true,
        mem_parse_ok: true,
        mem_items_count: 0,
        mem_used_heuristic: usedHeuristicConfirmedMemoryCandidates,
      };
      mem_write_ok = true;
    } else {
      memoryWrite = await handleMemoryWrite({
        openai,
        modelName,
        memoryExtractTimeoutMs,
        memoryMinIntervalSec,
        debugSave,
        supabase,
        userId: authedUserId,
        sourceMessageId: assistantMessageId,
        sourceThreadId: resolvedConversationId,
        uiLang,
        userText: "",
        assistantText: "",
        routedTone: routed.tone,
        routedIntensity: routed.intensity,
        usedHeuristicConfirmedMemoryCandidates,
        stateLevel: currentStateLevel,
        currentPhase,
        stateChanged,
        confirmedMemoryCandidates,
      });
      memoryWrite = {
        ...memoryWrite,
        mem_used_heuristic:
          usedHeuristicConfirmedMemoryCandidates ||
          memoryWrite.mem_used_heuristic,
      };
      mem_write_ok = true;
    }
  } catch (e: any) {
    mem_write_ok = false;
    mem_write_error = String(e?.message ?? e);
    memoryWrite = {
      ...createDefaultMemoryWriteDebug("exception"),
      mem_write_attempted: true,
      mem_used_heuristic: usedHeuristicConfirmedMemoryCandidates,
    };
  }

  return {
    memoryWrite,
    mem_write_ok,
    mem_write_error,
  };
}

/*
【このファイルの正式役割】
authenticated 経路の postTurn 最終化における Memory 書き込み実行責務。
confirmedMemoryCandidates と usedHeuristicConfirmedMemoryCandidates を受け取り、
Memory 書き込みを実行し、memoryWrite / mem_write_ok / mem_write_error を返す。
このファイルは state_changed / state_level / current_phase を再判定せず、
親から受け取った確定値を handleMemoryWrite へ渡すだけにする。

【今回このファイルで修正したこと】
- authenticatedPostTurn.ts に残っていた Memory 書き込み try/catch 本体を受け持つ新規ファイルを作成した。
- confirmedMemoryCandidates が空の場合の no_confirmed_memory_candidates debug 生成を移した。
- confirmedMemoryCandidates がある場合の handleMemoryWrite 実行を移した。
- 例外時の mem_write_ok / mem_write_error / memoryWrite debug 生成を移した。
- HOPY唯一の正、state_changed、Compass、HOPY回答○、Future Chain、thread_summary、audit、thread title、learning、payload 生成本体には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnMemoryWrite.ts
*/