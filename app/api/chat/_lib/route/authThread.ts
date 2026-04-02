// /app/api/chat/_lib/route/authThread.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Lang } from "../router/simpleRouter";
import { maybeEnforceThreadOwnership } from "../ownership/maybeEnforceThreadOwnership";
import {
  resolveConversationTarget,
  type ThreadResolutionResult,
} from "./resolveConversationTarget";

export type AuthThreadResolutionOk = {
  ok: true;
  threadResolution: ThreadResolutionResult;
  resolvedConversationId: string;
  precheck_not_found: boolean;
};

export type AuthThreadResolutionNg = {
  ok: false;
  status: number;
  payload: any;
};

export type AuthThreadResolutionOutcome =
  | AuthThreadResolutionOk
  | AuthThreadResolutionNg;

type ResolveAuthThreadParams = {
  supabase: SupabaseClient;
  authedUserId: string;
  uiLang: Lang;
  requestedConversationId: string;
  clientRequestIdIn: string;
  missingThreadReuseWindowSec: number;
  debugSave: boolean;
  enforceThreadOwnership: boolean;
};

export async function resolveAuthThread(
  params: ResolveAuthThreadParams
): Promise<AuthThreadResolutionOutcome> {
  const {
    supabase,
    authedUserId,
    uiLang,
    requestedConversationId,
    clientRequestIdIn,
    missingThreadReuseWindowSec,
    debugSave,
    enforceThreadOwnership,
  } = params;

  let threadResolution: ThreadResolutionResult;
  try {
    threadResolution = await resolveConversationTarget({
      supabase,
      userId: authedUserId,
      uiLang,
      requestedConversationId,
      clientRequestIdIn,
      missingThreadReuseWindowSec,
    });
  } catch (e: any) {
    return {
      ok: false,
      status: 500,
      payload: {
        ok: false,
        error: "thread_create_failed",
        message: String(e?.message ?? e),
      },
    };
  }

  const {
    conversationId,
    server_created_thread,
    server_reused_recent_thread,
  } = threadResolution;

  const resolvedConversationId = String(conversationId ?? "").trim();
  if (!resolvedConversationId) {
    return {
      ok: false,
      status: 500,
      payload: {
        ok: false,
        error: "thread_resolution_failed",
      },
    };
  }

  let precheck_not_found = false;

  if (!server_created_thread) {
    const own = await maybeEnforceThreadOwnership({
      supabase,
      conversationId: resolvedConversationId,
      userId: authedUserId,
      enforce: enforceThreadOwnership,
    });

    if (!own.ok) {
      if (own.error === "thread_not_found") {
        if (!server_reused_recent_thread) {
          precheck_not_found = true;

          const payload: any = { ok: false, error: "thread_not_found" };
          if (debugSave) {
            payload.precheck_not_found = true;
            payload.requestedConversationId =
              String(requestedConversationId ?? "").trim() || null;
            if (own.detail) payload.detail = own.detail;
          }
          return { ok: false, status: 404, payload };
        }
      } else if (own.error === "db_forbidden") {
        const payload: any = { ok: false, error: "db_forbidden" };
        if (debugSave && own.detail) payload.detail = own.detail;
        return { ok: false, status: 403, payload };
      } else if (own.error === "thread_forbidden") {
        const payload: any = { ok: false, error: "thread_forbidden" };
        if (debugSave && own.detail) payload.detail = own.detail;
        return { ok: false, status: 403, payload };
      } else {
        const payload: any = { ok: false, error: "thread_check_failed" };
        if (debugSave && own.detail) payload.detail = own.detail;
        return { ok: false, status: 403, payload };
      }
    }
  }

  return {
    ok: true,
    threadResolution,
    resolvedConversationId,
    precheck_not_found,
  };
}

/*
このファイルの正式役割
- authenticated 経路で使う thread 解決の入口
- requestedConversationId を resolveConversationTarget(...) に渡す
- 解決後の conversationId に対して ownership / existence を確認する
- 下流へ進めてよい thread だけを返す
- 危険な thread はここで止める
*/

/*
【今回このファイルで修正したこと】
- thread_not_found 発生時に、ok: true のまま下流へ流さないようにした。
- server_reused_recent_thread ではない thread_not_found は、404 thread_not_found を返してここで止めるようにした。
- debugSave=true のときだけ、precheck_not_found と requestedConversationId を payload に載せるようにした。
*/