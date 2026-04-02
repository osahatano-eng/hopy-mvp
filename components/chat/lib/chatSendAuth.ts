// /components/chat/lib/chatSendAuth.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthContext, logWarn } from "./chatSendShared";

export type ResolvedAuthContext = {
  isLoggedIn: boolean;
  accessToken: string | null;
};

export async function resolveAuthContextForSend(
  supabase: SupabaseClient
): Promise<ResolvedAuthContext> {
  const AUTH_RESOLVE_TIMEOUT_MS = 4000;

  const timeoutPromise = new Promise<ResolvedAuthContext>((_, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("auth_context_timeout"));
    }, AUTH_RESOLVE_TIMEOUT_MS);

    void timer;
  });

  try {
    const auth = await Promise.race([
      getAuthContext(supabase).then((result) => ({
        isLoggedIn: Boolean(result?.isLoggedIn),
        accessToken: String(result?.accessToken ?? "").trim() || null,
      })),
      timeoutPromise,
    ]);

    return auth;
  } catch (primaryError) {
    logWarn("[useChatSend] getAuthContext timed out or failed before fetch", {
      reason: String((primaryError as any)?.message ?? primaryError ?? ""),
    });

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      const accessToken =
        String(data?.session?.access_token ?? "").trim() || null;

      return {
        isLoggedIn: Boolean(accessToken),
        accessToken,
      };
    } catch (fallbackError) {
      logWarn("[useChatSend] supabase.auth.getSession fallback failed before fetch", {
        reason: String((fallbackError as any)?.message ?? fallbackError ?? ""),
      });

      return {
        isLoggedIn: false,
        accessToken: null,
      };
    }
  }
}

/*
このファイルの正式役割
送信前の auth 解決を行う専用ファイル。
getAuthContext の通常取得と、timeout 時の supabase.auth.getSession fallback をまとめて担当する。

【今回このファイルで修正したこと】
- useChatSend.ts 内にあった resolveAuthContextForSend をこのファイルへ分離しました。
- auth_context_timeout 時の fallback 処理もこのファイルへ移しました。
- auth 解決結果の型 ResolvedAuthContext もこのファイルへ分離しました。
*/