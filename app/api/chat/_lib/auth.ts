// /app/api/chat/_lib/auth.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBearerToken } from "./http";

function createAuthedSupabase(params: { accessToken: string }): SupabaseClient {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anon = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
      },
    },
  });
}

/**
 * サーバーAPI用（RLSを確実に回避して安定性を担保）
 * - service role が無ければ（開発初期など） anon+Bearer にフォールバック
 */
function createServiceSupabaseFallback(params: {
  accessToken: string;
}): SupabaseClient {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const service = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (url && service) {
    return createClient(url, service, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  // フォールバック（RLS設定次第で失敗する可能性はあるが、環境未整備でも動く）
  return createAuthedSupabase({ accessToken: params.accessToken });
}

export async function requireUser(req: Request): Promise<{
  ok: boolean;
  supabase?: SupabaseClient;
  userId?: string;
  error?: string;
}> {
  const accessToken = getBearerToken(req);
  if (!accessToken) return { ok: false, error: "missing_authorization_bearer" };

  // ✅ まず本人確認（anon + bearer）
  const authClient = createAuthedSupabase({ accessToken });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data?.user?.id) return { ok: false, error: "invalid_token" };

  // ✅ DB処理は service role（無ければ anon+bearer にフォールバック）
  const dbClient = createServiceSupabaseFallback({ accessToken });

  return { ok: true, supabase: dbClient, userId: data.user.id };
}
