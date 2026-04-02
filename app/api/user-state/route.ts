// /app/api/user-state/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

function clampInt(n: any, min: number, max: number, fallback: number) {
  const x = Number.isFinite(Number(n)) ? Number(n) : fallback;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function normalizePhase(v: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  const rounded = Math.round(n);
  if (rounded <= 1) return 1;
  if (rounded === 2) return 2;
  if (rounded === 3) return 3;
  if (rounded === 4) return 4;
  return 5;
}

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || "";
}

function sleep(ms: number) {
  return new Promise<void>((r) => {
    try {
      setTimeout(r, Math.max(0, ms | 0));
    } catch {
      r();
    }
  });
}

function isTransientAuthError(e: any) {
  const s = String(e?.message ?? e ?? "").toLowerCase();
  if (!s) return false;

  if (s.includes("jwt")) return true;
  if (s.includes("token")) return true;
  if (s.includes("refresh")) return true;
  if (s.includes("unauthorized")) return true;
  if (s.includes("forbidden")) return true;
  if (s.includes("401")) return true;
  if (s.includes("403")) return true;

  // ネットワーク揺れも一応
  if (s.includes("failed to fetch")) return true;
  if (s.includes("network")) return true;
  if (s.includes("timeout")) return true;
  if (s.includes("temporar")) return true;

  return false;
}

// server only (service role) - DB read/write
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// auth verify (anon + bearer)
function createAuthedSupabase(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    }
  );
}

type UserState = {
  user_id: string;
  current_phase: number;
  stability_score: number;
  last_trigger: string | null;
  updated_at: string | null;
};

async function requireUserIdWithRetry(
  req: Request
): Promise<{ ok: true; userId: string } | { ok: false; error: string; transient?: boolean }> {
  const token = getBearerToken(req);

  // ✅ GET は PWA復帰直後など “token無し” があり得るので、ここで落とす（401を減らす）
  if (!token) return { ok: false, error: "missing_authorization_bearer", transient: true };

  const supabase = createAuthedSupabase(token);

  // ✅ 復帰直後は auth.getUser() が一瞬失敗することがあるので短期リトライ
  const delays = [0, 80, 180];

  let lastErr: any = null;

  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await sleep(delays[i]);

    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user?.id) return { ok: true, userId: data.user.id };

      lastErr = error ?? new Error("invalid_token");
      if (i < delays.length - 1 && isTransientAuthError(lastErr)) continue;

      return { ok: false, error: "invalid_token", transient: isTransientAuthError(lastErr) };
    } catch (e) {
      lastErr = e;
      if (i < delays.length - 1 && isTransientAuthError(e)) continue;
      return { ok: false, error: "invalid_token", transient: isTransientAuthError(e) };
    }
  }

  return { ok: false, error: "invalid_token", transient: isTransientAuthError(lastErr) };
}

// GET /api/user-state  (self only)
export async function GET(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL)
      return json(500, { ok: false, error: "missing_SUPABASE_URL" });
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      return json(500, { ok: false, error: "missing_SUPABASE_ANON_KEY" });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return json(500, { ok: false, error: "missing_SUPABASE_SERVICE_ROLE_KEY" });

    const auth = await requireUserIdWithRetry(req);

    // ✅ 重要：GET は UI安定のため “401を返さない”
    // - 復帰直後の一瞬token無し/揺れで DevTools が赤くなるのを防ぐ
    // - クライアントは ok:false を見てデフォルト状態にする
    if (!auth.ok) {
      return json(200, { ok: false, error: auth.error });
    }

    const user_id = auth.userId;

    const { data, error } = await supabaseAdmin
      .from("user_state")
      .select("user_id,current_phase,stability_score,last_trigger,updated_at")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error) return json(500, { ok: false, error: error.message });

    const state: UserState =
      data != null
        ? {
            user_id: String((data as any)?.user_id ?? user_id),
            current_phase: normalizePhase((data as any)?.current_phase),
            stability_score: Number((data as any)?.stability_score ?? 0),
            last_trigger:
              (data as any)?.last_trigger == null ? null : String((data as any).last_trigger),
            updated_at:
              (data as any)?.updated_at == null ? null : String((data as any).updated_at),
          }
        : {
            user_id,
            current_phase: 1,
            stability_score: 0,
            last_trigger: null,
            updated_at: null,
          };

    return json(200, { ok: true, state });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: "server_error",
      message: String(e?.message ?? e),
    });
  }
}

// POST /api/user-state  (self only)
// body: { current_phase?, stability_score?, last_trigger? }
export async function POST(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL)
      return json(500, { ok: false, error: "missing_SUPABASE_URL" });
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      return json(500, { ok: false, error: "missing_SUPABASE_ANON_KEY" });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return json(500, { ok: false, error: "missing_SUPABASE_SERVICE_ROLE_KEY" });

    // ✅ POST は Bearer 必須（書き込みなので 401 を維持）
    const auth = await requireUserIdWithRetry(req);
    if (!auth.ok) return json(401, { ok: false, error: auth.error });

    const user_id = auth.userId;

    const body = await req.json().catch(() => null);

    const current_phase = normalizePhase(body?.current_phase);
    const stability_score = clampInt(body?.stability_score, -100, 100, 0);
    const last_trigger =
      body?.last_trigger === undefined ? undefined : String(body?.last_trigger ?? "").slice(0, 400);

    const payload: any = {
      user_id,
      current_phase,
      stability_score,
    };
    if (last_trigger !== undefined) payload.last_trigger = last_trigger;

    const { data, error } = await supabaseAdmin
      .from("user_state")
      .upsert(payload, { onConflict: "user_id" })
      .select("user_id,current_phase,stability_score,last_trigger,updated_at")
      .single();

    if (error) return json(500, { ok: false, error: error.message });

    return json(200, {
      ok: true,
      state: {
        user_id: String((data as any)?.user_id ?? user_id),
        current_phase: normalizePhase((data as any)?.current_phase),
        stability_score: Number((data as any)?.stability_score ?? 0),
        last_trigger: (data as any)?.last_trigger == null ? null : String((data as any).last_trigger),
        updated_at: (data as any)?.updated_at == null ? null : String((data as any).updated_at),
      },
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: "server_error",
      message: String(e?.message ?? e),
    });
  }
}