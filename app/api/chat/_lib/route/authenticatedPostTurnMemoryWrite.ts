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

function normalizeMemoryText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compactMemoryText(value: unknown): string {
  return normalizeMemoryText(value).replace(/\s+/g, "").toLowerCase();
}

function isLowValueConfirmedMemoryCandidate(
  candidate: ConfirmedMemoryCandidate,
): boolean {
  const body = normalizeMemoryText((candidate as any)?.body);
  if (!body) return true;

  if ((candidate as any)?.savable === false) return true;

  const sourceType = compactMemoryText(
    (candidate as any)?.source_type ?? (candidate as any)?.sourceType,
  );
  const memoryType = compactMemoryText(
    (candidate as any)?.memory_type ?? (candidate as any)?.memoryType,
  );

  if (sourceType === "auto" && memoryType === "support_context") {
    return true;
  }

  return false;
}

function filterConfirmedMemoryCandidates(
  candidates: ConfirmedMemoryCandidate[],
): {
  filteredCandidates: ConfirmedMemoryCandidate[];
  skippedCount: number;
} {
  const filteredCandidates = candidates.filter(
    (candidate) => !isLowValueConfirmedMemoryCandidate(candidate),
  );

  return {
    filteredCandidates,
    skippedCount: candidates.length - filteredCandidates.length,
  };
}

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
    const { filteredCandidates, skippedCount } =
      filterConfirmedMemoryCandidates(confirmedMemoryCandidates);

    if (filteredCandidates.length <= 0) {
      memoryWrite = {
        ...createDefaultMemoryWriteDebug(
          skippedCount > 0
            ? "low_value_confirmed_memory_candidates"
            : "no_confirmed_memory_candidates",
        ),
        mem_write_attempted: true,
        mem_write_allowed: skippedCount <= 0,
        mem_parse_ok: true,
        mem_items_count: 0,
        mem_used_heuristic: usedHeuristicConfirmedMemoryCandidates,
        mem_low_value_skipped_count: skippedCount,
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
        confirmedMemoryCandidates: filteredCandidates,
      });
      memoryWrite = {
        ...memoryWrite,
        mem_used_heuristic:
          usedHeuristicConfirmedMemoryCandidates ||
          memoryWrite.mem_used_heuristic,
        mem_low_value_skipped_count: skippedCount,
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
- 文字列列挙で「整理や確認を求めている」系を追いかける保険コードを入れない形にした。
- auto support_context は、ユーザー本人があとで見返すMEMORIESではなく会話文脈説明になりやすいため、保存前に skip するようにした。
- trait / theme / manual_note など、ユーザーの継続的な好み・方針・支援条件になり得る候補は、このファイルでは止めない。
- state_changed、state_level、current_phase、Compass、HOPY回答○、Future Chain、Learning、Dashboard、UI、DB schema には触れていない。

 /app/api/chat/_lib/route/authenticatedPostTurnMemoryWrite.ts
*/