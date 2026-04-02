// /app/api/memories/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { createManualMemory } from "./_lib/createManualMemory";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// ✅ cron無し運用の「重くしない」世界基準ブレーキ
const TRASH_TTL_DAYS = 30;
const TRASH_MAX = 200;
const PRUNE_MAX_PER_REQUEST = 50;

// ✅ 入力ブレーキ（重くしない・壊さない）
const TEXT_MAX = 800;
const IMPORTANCE_MIN = 0;
const IMPORTANCE_MAX = 100;

// ✅ memories 返却に状態情報も含める
const MEMORY_SELECT =
  "id, content, importance, created_at, updated_at, deleted_at, state_level, current_phase, state_changed";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function clampText(s: any, max = TEXT_MAX) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) : t;
}

function clampInt(n: any, min: number, max: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const x = Math.round(v);
  return Math.min(max, Math.max(min, x));
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
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
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
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
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
// GET  /api/memories?scope=active|trash
// =========================
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return json(auth.status, { ok: false, error: auth.error });

  const { searchParams } = new URL(req.url);
  const scopeRaw = String(searchParams.get("scope") || "active").toLowerCase();
  const scope = scopeRaw === "trash" ? "trash" : "active";

  if (scope === "trash") {
    await pruneTrashForUser(auth.user.id).catch(() => {});
  }

  const supabase = dbClient(auth.token);

  const countQuery = supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);

  const counted =
    scope === "trash"
      ? countQuery.not("deleted_at", "is", null)
      : countQuery.is("deleted_at", null);

  const { count, error: countError } = await counted;
  if (countError) return json(500, { ok: false, error: countError.message });

  let q = supabase
    .from("memories")
    .select(MEMORY_SELECT)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  q = scope === "trash" ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);

  const { data, error } = await q;
  if (error) return json(500, { ok: false, error: error.message });

  return json(200, {
    ok: true,
    scope,
    total: typeof count === "number" ? count : 0,
    items: data ?? [],
  });
}

// =========================
// POST /api/memories
// body: { body?: string, text?: string, content?: string, importance?: number }
// 新しい Manual 保存本体 createManualMemory へ接続
// =========================
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return json(auth.status, { ok: false, error: auth.error });

  try {
    const body = await req.json().catch(() => ({} as any));
    const text = clampText(body.body ?? body.content ?? body.text ?? "");
    if (!text) return json(400, { ok: false, error: "Text is required" });

    const importance = clampInt(body.importance, IMPORTANCE_MIN, IMPORTANCE_MAX);
    const supabase = dbClient(auth.token);

    const created = await createManualMemory({
      supabase,
      userId: auth.user.id,
      input: {
        body: text,
        source_message_id:
          typeof body.source_message_id === "string" ? body.source_message_id : undefined,
        source_thread_id:
          typeof body.source_thread_id === "string" ? body.source_thread_id : undefined,
      },
    });

    if (!created.ok) {
      if (created.reason === "empty_body") {
        return json(400, { ok: false, error: "Text is required" });
      }

      if (created.reason === "invalid_user_id") {
        return json(401, { ok: false, error: "Invalid session" });
      }

      return json(500, { ok: false, error: "Failed to create memory" });
    }

    const { data, error } = await supabase
      .from("memories")
      .select(MEMORY_SELECT)
      .eq("user_id", auth.user.id)
      .eq("source_type", "manual")
      .eq("memory_type", "manual_note")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return json(200, {
        ok: true,
        inserted: created.inserted,
      });
    }

    const item =
      importance === null || data == null
        ? data
        : {
            ...data,
            importance,
          };

    return json(200, {
      ok: true,
      inserted: created.inserted,
      item,
    });
  } catch (e: any) {
    return json(400, { ok: false, error: e?.message ?? "Invalid request" });
  }
}

// =========================
// PATCH /api/memories
// body:
//  - update:  { id, body?, text?, content?, importance? }
//  - restore: { id, restore: true }
//  - trash:   { id, trash: true }
//  - untrash: { id, trash: false }
// =========================
export async function PATCH(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return json(auth.status, { ok: false, error: auth.error });

  try {
    const body = await req.json().catch(() => ({} as any));
    const id = String(body.id ?? "").trim();
    if (!id) return json(400, { ok: false, error: "id is required" });

    const supabase = dbClient(auth.token);

    const wantsRestore = body.restore === true || body.trash === false;

    if (wantsRestore) {
      const { data, error } = await supabase
        .from("memories")
        .update({ deleted_at: null })
        .eq("id", id)
        .eq("user_id", auth.user.id)
        .select(MEMORY_SELECT)
        .single();

      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, item: data });
    }

    if (body.trash === true) {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("memories")
        .update({ deleted_at: now })
        .eq("id", id)
        .eq("user_id", auth.user.id)
        .select(MEMORY_SELECT)
        .single();

      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, item: data });
    }

    const next: any = {};

    const nextTextRaw = body.content ?? body.body ?? body.text;
    if (nextTextRaw !== undefined) {
      const nextText = clampText(nextTextRaw);
      if (!nextText) return json(400, { ok: false, error: "Text is required" });
      next.content = nextText;
    }

    if (body.importance !== undefined) {
      const imp = clampInt(body.importance, IMPORTANCE_MIN, IMPORTANCE_MAX);
      if (imp === null) {
        return json(400, { ok: false, error: "importance must be a number" });
      }
      next.importance = imp;
    }

    if (Object.keys(next).length === 0) {
      return json(400, { ok: false, error: "No fields to update" });
    }

    const { data, error } = await supabase
      .from("memories")
      .update(next)
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .select(MEMORY_SELECT)
      .single();

    if (error) return json(500, { ok: false, error: error.message });
    return json(200, { ok: true, item: data });
  } catch (e: any) {
    return json(400, { ok: false, error: e?.message ?? "Invalid request" });
  }
}

// =========================
// DELETE /api/memories?id=...&hard=1
// =========================
export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return json(auth.status, { ok: false, error: auth.error });

  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") || "").trim();
  if (!id) return json(400, { ok: false, error: "id is required" });

  const hard = String(searchParams.get("hard") || "").toLowerCase();
  const hardDelete = hard === "1" || hard === "true" || hard === "yes";

  const supabase = dbClient(auth.token);

  if (hardDelete) {
    const { error } = await supabase
      .from("memories")
      .delete()
      .eq("id", id)
      .eq("user_id", auth.user.id);

    if (error) return json(500, { ok: false, error: error.message });
    return json(200, { ok: true, hardDeleted: true, id });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("memories")
    .update({ deleted_at: now })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select(MEMORY_SELECT)
    .single();

  if (error) return json(500, { ok: false, error: error.message });
  return json(200, { ok: true, item: data });
}

/*
このファイルの正式役割
- /api/memories のサーバールートとして、認証済みユーザーの MEMORIES 一覧取得・作成・更新・削除・復元を扱う
- Bearer token からログインユーザーを確定する
- 対象ユーザーの memories だけを返す
- trash の簡易 pruning を行う
- HOPY の状態表示の唯一の正は作らず、保存済みデータをそのまま扱う
*/

/*
【今回このファイルで修正したこと】
GET の件数取得と一覧取得に user_id = auth.user.id を明示追加した。
PATCH の復元・ゴミ箱移動・更新に user_id = auth.user.id を明示追加した。
DELETE の通常削除・完全削除に user_id = auth.user.id を明示追加した。
MEMORIES の取得更新削除対象を、認証済み本人のデータだけに固定した。
*/