// /app/api/chat/_lib/ownership/maybeEnforceThreadOwnership.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectDbKind } from "../supabase/dbError";

export async function maybeEnforceThreadOwnership(params: {
  supabase: SupabaseClient;
  conversationId: string;
  userId: string;
  enforce: boolean;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      error:
        | "thread_not_found"
        | "thread_forbidden"
        | "db_forbidden"
        | "thread_check_failed";
      detail?: string;
    }
> {
  if (!params.enforce) return { ok: true };

  try {
    // conversations がある前提でチェックする（強制ONのときは安全側で弾く）
    const { data, error } = await params.supabase
      .from("conversations")
      .select("id, user_id")
      .eq("id", params.conversationId)
      .maybeSingle();

    if (error) {
      const kind = detectDbKind(error);
      if (kind === "rls_denied") {
        return {
          ok: false,
          error: "db_forbidden",
          detail: String(error?.message ?? error),
        };
      }
      return {
        ok: false,
        error: "thread_check_failed",
        detail: String(error?.message ?? error),
      };
    }

    // ⚠️ RLSが厳しい環境では「他人のスレ」もここで data=null になる
    // ここでは "thread_not_found" として返すが、呼び出し側で即時確定しない（保存結果で確定）
    if (!data?.id) return { ok: false, error: "thread_not_found" };

    const owner = String((data as any).user_id ?? "").trim();
    if (!owner)
      return {
        ok: false,
        error: "thread_check_failed",
        detail: "thread_owner_missing",
      };

    if (owner !== params.userId) return { ok: false, error: "thread_forbidden" };

    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    return { ok: false, error: "thread_check_failed", detail: msg };
  }
}