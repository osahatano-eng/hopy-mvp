// /app/api/chat/_lib/supabase/client.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createAuthedSupabase(params: { accessToken: string }): SupabaseClient {
  // ✅ server env を優先（Next.js Route Handler では NEXT_PUBLIC が無い/想定外でも壊れない）
  const url = String(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anon = String(process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  const token = String(params?.accessToken ?? "").trim();

  if (!url || !anon) {
    throw new Error("supabase_env_missing");
  }
  if (!token) {
    throw new Error("supabase_access_token_missing");
  }

  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}