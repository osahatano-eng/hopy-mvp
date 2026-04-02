// /app/api/chat/_lib/route/threadTitle.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import { errorText } from "../infra/text";
import type { Lang } from "../router/simpleRouter";

async function safeFetchConversationTitle(args: {
  supabase: SupabaseClient;
  conversationId: string;
}): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  const cid = String(args.conversationId ?? "").trim();
  if (!cid) return { ok: false, error: "thread_id_empty" };

  try {
    const { data, error } = await args.supabase
      .from("conversations")
      .select("id, title")
      .eq("id", cid)
      .maybeSingle();

    if (error) return { ok: false, error: errorText(error) };

    const title = String((data as any)?.title ?? "").trim();
    return { ok: true, title };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function resolveThreadTitleForPayload(args: {
  supabase: SupabaseClient;
  uiLang: Lang;
  conversationId: string;
  server_created_thread: boolean;
  server_created_thread_title: string | null;
  server_reused_recent_thread: boolean;
  server_reused_recent_thread_title: string | null;
  auto_title_updated: boolean | null;
  auto_title_title: string | null;
}): Promise<string> {
  if (args.server_created_thread) {
    return args.server_created_thread_title ?? (args.uiLang === "en" ? "New chat" : "新規チャット");
  }

  if (args.server_reused_recent_thread && args.server_reused_recent_thread_title) {
    return args.server_reused_recent_thread_title;
  }

  if (args.auto_title_updated && args.auto_title_title) {
    return args.auto_title_title;
  }

  const r = await safeFetchConversationTitle({
    supabase: args.supabase,
    conversationId: args.conversationId,
  });

  const title = r.ok ? String(r.title ?? "").trim() : "";
  return title || (args.uiLang === "en" ? "New chat" : "新規チャット");
}