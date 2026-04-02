// /app/api/chat/_lib/route/resolveConversationTarget.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import { createConversation } from "../db/conversations";
import { errorText } from "../infra/text";
import type { Lang } from "../router/simpleRouter";

export type ThreadResolutionResult = {
  conversationId: string;
  server_created_thread: boolean;
  server_created_thread_title: string | null;
  server_created_client_request_id: string | null;
  server_reused_recent_thread: boolean;
  server_reused_recent_thread_title: string | null;
};

function genClientRequestId(): string {
  try {
    const g: any = globalThis as any;
    const c: any = (g as any)?.crypto;
    if (c && typeof c.randomUUID === "function") {
      return String(c.randomUUID());
    }
  } catch {}

  try {
    const a = Math.random().toString(36).slice(2);
    const b = Math.random().toString(36).slice(2);
    return `srv_${Date.now()}_${a}${b}`;
  } catch {
    return `srv_${Date.now()}`;
  }
}

async function safeFindRecentConversationForReuse(args: {
  supabase: SupabaseClient;
  userId: string;
  reuseWindowSec: number;
}): Promise<{ ok: true; row: { id: string; title: string } | null } | { ok: false; error: string }> {
  const userId = String(args.userId ?? "").trim();
  if (!userId) return { ok: true, row: null };

  const sec = Math.max(0, Math.trunc(Number(args.reuseWindowSec ?? 0) || 0));
  if (sec <= 0) {
    return { ok: true, row: null };
  }

  const cutoffIso = new Date(Date.now() - sec * 1000).toISOString();

  try {
    let q = args.supabase
      .from("conversations")
      .select("id, title, updated_at, created_at")
      .eq("user_id", userId)
      .gte("updated_at", cutoffIso)
      .order("updated_at", { ascending: false })
      .limit(3);

    const { data, error } = await q;
    if (error) return { ok: false, error: errorText(error) };

    const rows = Array.isArray(data) ? data : [];
    for (const row of rows) {
      const id = String((row as any)?.id ?? "").trim();
      if (!id) continue;

      const title = String((row as any)?.title ?? "").trim();
      return { ok: true, row: { id, title } };
    }

    return { ok: true, row: null };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function resolveConversationTarget(args: {
  supabase: SupabaseClient;
  userId: string;
  uiLang: Lang;
  requestedConversationId: string;
  clientRequestIdIn: string;
  missingThreadReuseWindowSec: number;
}): Promise<ThreadResolutionResult> {
  let conversationId = String(args.requestedConversationId ?? "").trim();

  let server_created_thread = false;
  let server_created_thread_title: string | null = null;
  let server_created_client_request_id: string | null = null;
  let server_reused_recent_thread = false;
  let server_reused_recent_thread_title: string | null = null;

  const allowRecentReuse = Math.max(0, Math.trunc(Number(args.missingThreadReuseWindowSec ?? 0) || 0)) > 0;

  if (!conversationId && allowRecentReuse) {
    const reused = await safeFindRecentConversationForReuse({
      supabase: args.supabase,
      userId: args.userId,
      reuseWindowSec: args.missingThreadReuseWindowSec,
    });

    if (reused.ok && reused.row?.id) {
      conversationId = String(reused.row.id).trim();
      server_reused_recent_thread = true;
      server_reused_recent_thread_title = String(reused.row.title ?? "").trim() || null;
    }
  }

  if (!conversationId) {
    const title = args.uiLang === "en" ? "New chat" : "新規チャット";
    const clientRequestId = args.clientRequestIdIn || genClientRequestId();

    const r = await createConversation({
      supabase: args.supabase,
      userId: args.userId,
      title,
      clientRequestId,
    });

    if (!r.ok || !r.row?.id) {
      throw new Error(`thread_create_failed:${errorText((r as any).error)}`);
    }

    conversationId = String(r.row.id).trim();
    server_created_thread = true;
    server_created_thread_title = String(r.row.title ?? "").trim() || title;
    server_created_client_request_id = clientRequestId;
  }

  return {
    conversationId,
    server_created_thread,
    server_created_thread_title,
    server_created_client_request_id,
    server_reused_recent_thread,
    server_reused_recent_thread_title,
  };
}