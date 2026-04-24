// /app/api/chat/_lib/route/authenticatedPostTurnThreadTitle.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Lang } from "../router/simpleRouter";
import { resolveThreadTitleForPayload } from "./threadTitle";

function getFallbackThreadTitleForPayload(params: {
  auto_title_updated: boolean;
  auto_title_title: string | null;
  server_reused_recent_thread: boolean;
  server_reused_recent_thread_title: string | null;
  server_created_thread: boolean;
  server_created_thread_title: string | null;
  uiLang: Lang;
}): string {
  if (params.auto_title_updated && params.auto_title_title) {
    return params.auto_title_title;
  }

  if (
    params.server_reused_recent_thread &&
    params.server_reused_recent_thread_title
  ) {
    return params.server_reused_recent_thread_title;
  }

  if (params.server_created_thread && params.server_created_thread_title) {
    return params.server_created_thread_title;
  }

  return params.uiLang === "ja" ? "新規チャット" : "New chat";
}

export async function resolveAuthenticatedPostTurnThreadTitle(params: {
  supabase: SupabaseClient;
  uiLang: Lang;
  resolvedConversationId: string;
  server_created_thread: boolean;
  server_created_thread_title: string | null;
  server_reused_recent_thread: boolean;
  server_reused_recent_thread_title: string | null;
  auto_title_updated: boolean;
  auto_title_title: string | null;
}): Promise<string> {
  const fallbackThreadTitleForPayload = getFallbackThreadTitleForPayload({
    auto_title_updated: params.auto_title_updated,
    auto_title_title: params.auto_title_title,
    server_reused_recent_thread: params.server_reused_recent_thread,
    server_reused_recent_thread_title:
      params.server_reused_recent_thread_title,
    server_created_thread: params.server_created_thread,
    server_created_thread_title: params.server_created_thread_title,
    uiLang: params.uiLang,
  });

  try {
    const resolvedTitle = await resolveThreadTitleForPayload({
      supabase: params.supabase,
      uiLang: params.uiLang,
      conversationId: params.resolvedConversationId,
      server_created_thread: params.server_created_thread,
      server_created_thread_title: params.server_created_thread_title,
      server_reused_recent_thread: params.server_reused_recent_thread,
      server_reused_recent_thread_title:
        params.server_reused_recent_thread_title,
      auto_title_updated: params.auto_title_updated,
      auto_title_title: params.auto_title_title,
    });

    return String(resolvedTitle ?? "").trim() || fallbackThreadTitleForPayload;
  } catch {
    return fallbackThreadTitleForPayload;
  }
}

/*
【このファイルの正式役割】
authenticated postTurn の最終 payload 用 thread title 解決責務だけを持つ。
auto title / reused thread title / created thread title から fallback title を決め、
必要に応じて resolveThreadTitleForPayload(...) でDB側の title を解決し、
最終 payload に載せる threadTitleForPayload を返す。
このファイルは title 解決だけを担当し、
state_changed、state_level、current_phase、Compass、HOPY回答○、memory、learning、
audit、thread_summary、Future Chain は再判定しない。

【今回このファイルで修正したこと】
- /app/api/chat/_lib/route/authenticatedPostTurn.ts から分離するため、
  最終 payload 用 thread title 解決責務を新規ファイルとして作成した。
- getFallbackThreadTitleForPayload(...) を移せる形で定義した。
- resolveThreadTitleForPayload(...) の try/catch と最終 title 決定処理を、
  resolveAuthenticatedPostTurnThreadTitle(...) として移せる形にした。
- 既存の fallback 優先順、DB title 解決、失敗時 fallback 返却の挙動は変えていない。
- HOPY唯一の正、Compass、memory、learning、audit、thread_summary、Future Chain には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnThreadTitle.ts
*/