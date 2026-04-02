// /app/api/chat/_lib/context/loadRecentConversationMessages.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type DbChatRow = {
  role: "user" | "assistant";
  content: string;
  compass_text?: string | null;
  compass_prompt?: string | null;
};

type LoadRecentConversationMessagesResult = {
  ok: boolean;
  items: DbChatRow[];
  error?: string;
  tried?: Array<{
    threadCol: "conversation_id" | "thread_id";
    timeCol: "created_at";
  }>;
};

function isMissingColumnError(e: any) {
  const s = String(e?.message ?? e ?? "").toLowerCase();

  const looksLikeMissing =
    s.includes("column") &&
    (s.includes("does not exist") ||
      s.includes("unknown column") ||
      s.includes("not found") ||
      s.includes("not exist"));

  const schemaCache =
    s.includes("schema cache") &&
    (s.includes("could not find") ||
      s.includes("not found") ||
      s.includes("missing") ||
      s.includes("column"));

  return looksLikeMissing || schemaCache;
}

function normalizeLimit(limit: number): number {
  return Math.max(0, Math.min(60, Math.trunc(limit || 0)));
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length > 0 ? s : null;
}

async function fetchRecentConversationMessages(params: {
  supabase: SupabaseClient;
  conversationId: string;
  limit: number;
}): Promise<{
  data: any[] | null;
  error: any;
  tried: Array<{
    threadCol: "conversation_id" | "thread_id";
    timeCol: "created_at";
  }>;
}> {
  const timeCol: "created_at" = "created_at";
  const tried: Array<{
    threadCol: "conversation_id" | "thread_id";
    timeCol: "created_at";
  }> = [];

  const run = async (threadCol: "conversation_id" | "thread_id") => {
    tried.push({ threadCol, timeCol });

    return await params.supabase
      .from("messages")
      .select(`role, content, compass_text, compass_prompt, ${timeCol}`)
      .eq(threadCol, params.conversationId)
      .order(timeCol, { ascending: false })
      .limit(params.limit);
  };

  let { data, error } = await run("conversation_id");

  if (error && isMissingColumnError(error)) {
    const fallback = await run("thread_id");
    data = fallback.data;
    error = fallback.error;
  }

  return {
    data: Array.isArray(data) ? data : [],
    error,
    tried,
  };
}

function normalizeRecentConversationRows(rows: any[]): DbChatRow[] {
  const out: DbChatRow[] = [];

  for (const row of rows) {
    const role = String((row as any)?.role ?? "").trim();
    const content = String((row as any)?.content ?? "").trim();

    if (!content) continue;
    if (role !== "user" && role !== "assistant") continue;

    out.push({
      role: role as "user" | "assistant",
      content,
      compass_text: normalizeOptionalString((row as any)?.compass_text),
      compass_prompt: normalizeOptionalString((row as any)?.compass_prompt),
    });
  }

  out.reverse();
  return out;
}

export async function loadRecentConversationMessages(params: {
  supabase: SupabaseClient;
  conversationId: string;
  limit: number;
}): Promise<LoadRecentConversationMessagesResult> {
  try {
    const lim = normalizeLimit(params.limit);
    if (!lim) {
      return {
        ok: true,
        items: [],
        tried: [],
      };
    }

    const fetched = await fetchRecentConversationMessages({
      supabase: params.supabase,
      conversationId: params.conversationId,
      limit: lim,
    });

    if (fetched.error) {
      return {
        ok: false,
        items: [],
        error: String(fetched.error?.message ?? fetched.error),
        tried: fetched.tried,
      };
    }

    return {
      ok: true,
      items: normalizeRecentConversationRows(fetched.data ?? []),
      tried: fetched.tried,
    };
  } catch (e: any) {
    return {
      ok: false,
      items: [],
      error: String(e?.message ?? e),
      tried: [],
    };
  }
}

/*
このファイルの正式役割
recent conversation messages の取得ファイル。
messages テーブルから会話文脈として必要な直近 message 行を読み、
authenticated 側へ渡すための最小 shape に正規化する。
回復経路では、assistant 本文だけでなく Compass 復元に必要な列もここから渡す。
*/

/*
【今回このファイルで修正したこと】
- messages 取得列から、実在しない hopy_confirmed_payload を削除した。
- DbChatRow から hopy_confirmed_payload を削除した。
- Compass 復元に必要な compass_text / compass_prompt は維持した。
- これにより、ctx_error: column messages.hopy_confirmed_payload does not exist をこのファイル内で止めた。
*/
// このファイルの正式役割: recent conversation messages の取得ファイル