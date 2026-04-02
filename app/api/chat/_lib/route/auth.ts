// /app/api/chat/_lib/route/auth.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeAccessToken(raw: any): string {
  try {
    let s = String(raw ?? "").trim();
    if (!s) return "";
    s = s.replace(/^bearer\s+/i, "").trim();
    return s;
  } catch {
    return "";
  }
}

async function getUserIdByAuthRest(
  accessToken: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string; detail?: string }> {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anon = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const token = String(accessToken ?? "").trim();

  if (!url || !anon) return { ok: false, error: "supabase_env_missing" };
  if (!token) return { ok: false, error: "missing_token" };

  const endpoint = `${url.replace(/\/+$/, "")}/auth/v1/user`;

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      let detail = `status_${res.status}`;
      try {
        const t = await res.text();
        const clipped = String(t ?? "").trim().slice(0, 300);
        if (clipped) detail = `${detail}:${clipped}`;
      } catch {}
      return { ok: false, error: "auth_failed", detail };
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    const uid = String(data?.id ?? data?.user?.id ?? "").trim();
    if (!uid) return { ok: false, error: "auth_failed", detail: "no_user_in_response" };

    return { ok: true, userId: uid };
  } catch (e: any) {
    return { ok: false, error: "auth_failed", detail: String(e?.message ?? e) };
  }
}

export async function getAuthedUserId(
  supabase: SupabaseClient,
  accessToken: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string; detail?: string }> {
  const token = String(accessToken ?? "").trim();
  if (!token) return { ok: false, error: "missing_token" };

  try {
    const authAny: any = (supabase as any)?.auth;
    if (authAny && typeof authAny.getUser === "function") {
      try {
        const r1 = await authAny.getUser(token);
        const uid1 = String(r1?.data?.user?.id ?? "").trim();
        if (uid1) return { ok: true, userId: uid1 };
      } catch {}

      try {
        const r0 = await authAny.getUser();
        const uid0 = String(r0?.data?.user?.id ?? "").trim();
        if (uid0) return { ok: true, userId: uid0 };
      } catch {}
    }
  } catch {}

  return await getUserIdByAuthRest(token);
}