import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// ✅ cron無し運用の「重くしない」世界基準ブレーキ
const TRASH_TTL_DAYS = 30;
const TRASH_MAX = 200;
const PRUNE_MAX_PER_REQUEST = 50;

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || "";
}

async function requireUser(req: Request) {
  const token = getBearerToken(req);
  if (!token) return { ok: false as const, status: 401, error: "Unauthorized" };

  if (!SUPABASE_URL || !ANON_KEY) {
    return { ok: false as const, status: 500, error: "Missing Supabase env" };
  }

  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabaseAuth.auth.getUser(token);
  const user = data?.user;

  if (error || !user) {
    return { ok: false as const, status: 401, error: "Invalid session" };
  }

  return { ok: true as const, user, token };
}

function dbClient(token: string) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// ✅ Next.js: params が Promise のことがあるので await で吸収
type RouteCtx = {
  params: Promise<{ id: string }> | { id: string };
};

async function readId(ctx: RouteCtx): Promise<string> {
  const p: any = (ctx as any)?.params;
  const params = typeof p?.then === "function" ? await p : p;
  return String(params?.id ?? "").trim();
}

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function pruneTrashForUser(userId: string) {
  const supabase = serviceClient();
  if (!supabase) return;

  const cutoff = new Date(Date.now() - TRASH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // A) 30日超（最大50件）
  const { data: oldIds } = await supabase
    .from("memories")
    .select("id")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)
    .order("deleted_at", { ascending: true })
    .limit(PRUNE_MAX_PER_REQUEST);

  if (oldIds && oldIds.length > 0) {
    const ids = oldIds.map((x: any) => x.id);
    await supabase.from("memories").delete().in("id", ids);
    return;
  }

  // B) 200件上限（超過分の古い方を最大50件）
  const { count } = await supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("deleted_at", "is", null);

  const total = typeof count === "number" ? count : 0;
  const overflow = Math.max(0, total - TRASH_MAX);
  if (overflow <= 0) return;

  const take = Math.min(overflow, PRUNE_MAX_PER_REQUEST);

  const { data: overflowIds } = await supabase
    .from("memories")
    .select("id")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: true })
    .limit(take);

  if (overflowIds && overflowIds.length > 0) {
    const ids = overflowIds.map((x: any) => x.id);
    await supabase.from("memories").delete().in("id", ids);
  }
}

// =========================
// POST /api/memories/:id/restore
// ✅ restoreの後にだけ prune（重くしない）
// =========================
export async function POST(req: Request, ctx: RouteCtx) {
  const auth = await requireUser(req);
  if (!auth.ok) return json(auth.status, { ok: false, error: auth.error });

  const id = await readId(ctx);
  if (!id) return json(400, { ok: false, error: "id is required" });

  const supabase = dbClient(auth.token);

  const { data, error } = await supabase
    .from("memories")
    .update({ deleted_at: null })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return json(500, { ok: false, error: error.message });
  if (!data) return json(404, { ok: false, error: "Not found" });

  // ✅ 復元後にだけ掃除（最大50件）
  await pruneTrashForUser(auth.user.id).catch(() => {});

  return json(200, { ok: true });
}
