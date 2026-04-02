// /app/api/chat/_lib/db/context.ts
import type { SupabaseClient } from "@supabase/supabase-js";

type Lang = "ja" | "en";

type DbMessageRow = {
  role: "user" | "assistant";
  content: string;
  lang?: Lang | null;
  created_at?: string | null;
};

export type ChatHistoryResult =
  | { ok: true; messages: { role: "user" | "assistant"; content: string }[] }
  | { ok: false; error: any; messages: { role: "user" | "assistant"; content: string }[] };

function safeString(x: any) {
  const s = typeof x === "string" ? x : x == null ? "" : String(x);
  return s.trim();
}

/**
 * conversationId の直近N件をDBから取得し、OpenAI用に整形して返す
 * - DBは降順で取って、返却は時系列（古→新）に並べ替える
 * - role/content が欠けている行は落とす
 */
export async function loadRecentConversationMessages(params: {
  supabase: SupabaseClient;
  conversationId: string;
  limit: number;
}): Promise<ChatHistoryResult> {
  const { supabase, conversationId } = params;
  const limit = Math.max(1, Math.min(50, Math.trunc(params.limit || 20)));

  const cid = safeString(conversationId);
  if (!cid) return { ok: false, error: "missing_conversationId", messages: [] };

  try {
    const { data, error } = await supabase
      .from("messages")
      .select("role,content,created_at")
      .eq("conversation_id", cid)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { ok: false, error, messages: [] };

    const rows = (data ?? []) as DbMessageRow[];

    // 返却は古→新
    const sorted = [...rows].reverse();

    const msgs = sorted
      .map((r) => {
        const role = r?.role;
        const content = safeString(r?.content);
        if ((role !== "user" && role !== "assistant") || !content) return null;
        return { role, content };
      })
      .filter(Boolean) as { role: "user" | "assistant"; content: string }[];

    return { ok: true, messages: msgs };
  } catch (e: any) {
    return { ok: false, error: e, messages: [] };
  }
}
