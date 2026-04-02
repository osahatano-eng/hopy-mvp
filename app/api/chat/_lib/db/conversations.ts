// /app/api/chat/_lib/db/conversations.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * conversations テーブル前提（DB実態に合わせる）
 *
 * ✅ DB（あなたの環境の実スキーマ）
 * - id: uuid (PK, default gen_random_uuid())
 * - user_id: uuid (NOT NULL, default auth.uid() + INSERT trigger set_user_id_from_auth())
 * - title: text (NOT NULL, default 'New chat')
 * - created_at: timestamptz (NOT NULL, default now())
 * - updated_at: timestamptz (NOT NULL, default now() + UPDATE trigger touch_updated_at())
 * - state_level: int (NOT NULL, default 1, FK -> states.level)
 *
 * ✅ 方針
 * - insert 時は DB の default/trigger を優先しつつ、
 *   サーバー冪等化に必要な user_id / client_request_id は明示的に渡せるようにする
 *
 * =========================================================
 * ✅ New Chat 二重作成の根治（サーバ側冪等化）
 *
 * 目的:
 * - ネットワーク再送 / 多重クリック / StrictMode / 二重イベント等でも
 *   「同じユーザー操作」が複数 insert されないようにする。
 *
 * 推奨SQL（一度だけ適用）:
 *
 *   alter table public.conversations
 *     add column if not exists client_request_id text;
 *
 *   create unique index if not exists conversations_user_client_request_uidx
 *     on public.conversations (user_id, client_request_id)
 *     where client_request_id is not null;
 *
 * - client_request_id は「新規チャット作成ボタン1回につき1つ」生成して送る。
 * - これで upsert が効き、同一キーの再送は同一行に収束する。
 * =========================================================
 */

export type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  state_level: number;

  // ✅ optional: 冪等キー（DBに列がある場合のみ返る）
  client_request_id?: string;
};

export type StateRow = {
  level: number;
  code: string;
  label_ja: string;
  label_en: string;
  color_token: string;
  ui_class: string;
};

function reqNonEmpty(name: string, v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`${name}_empty`);
  return s;
}

function clampTitleOrUndef(v: unknown, max = 120): string | undefined {
  const s = String(v ?? "").trim();
  if (!s) return undefined; // DB default 'New chat' に任せる
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeTitleCandidate(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
}

function normalizeTitleKey(title: string | null | undefined): string {
  // ✅ 既定タイトル判定のための正規化（大小/空白ゆれ吸収）
  return normalizeTitleCandidate(String(title ?? "")).toLowerCase();
}

/**
 * ✅ UIの同名重複表示などで末尾に付く「短いID風サフィックス」を剥がす
 * 例:
 * - "新規チャット · r2c" / "新規チャット r2c"
 * - "New chat · a1b2" / "New chat a1b2"
 *
 * ※ユーザーが明示的に付けた長いタイトルまで誤って default 扱いしないよう、
 *   「区切り + 2〜8文字の英数」程度に限定する
 */
function stripDisambiguationSuffix(title: string): string {
  const s = normalizeTitleCandidate(title);
  if (!s) return "";

  // " · ab12" / " - ab12" / "  ab12" などの短い末尾トークンを剥がす
  // - 区切り記号: · / ・ / - / —
  // - または末尾にスペース + 短い英数
  // - 英数長は 2〜8
  const patterns: RegExp[] = [
    /\s*[·・]\s*[a-z0-9]{2,8}\s*$/i,
    /\s*[-—]\s*[a-z0-9]{2,8}\s*$/i,
    /\s+[a-z0-9]{2,8}\s*$/i,
  ];

  for (const re of patterns) {
    if (re.test(s)) {
      const out = s.replace(re, "").trim();
      return out || s;
    }
  }
  return s;
}

function buildAutoTitleFromUserText(userText: string, maxLen = 30): string {
  const base = normalizeTitleCandidate(userText);
  if (!base) return "";
  if (base.length <= maxLen) return base;
  return base.slice(0, maxLen).trimEnd();
}

function isDefaultConversationTitle(title: string | null | undefined): boolean {
  const raw = String(title ?? "").trim();
  if (!raw) return true;

  // ✅ 「新規チャット · r2c」等でも default 扱いできるように末尾サフィックスを剥がす
  const core = stripDisambiguationSuffix(raw);

  // ✅ DB default / UI default の両方を許容（壊れない前提）
  // - 英語は大小無視（lowercase key）
  // - 日本語は同一文字列で一致（lowercaseしても影響なし）
  const defaults = new Set(["new chat", "新規チャット", "新しいチャット", "untitled", "無題"]);

  const key = normalizeTitleKey(core);
  return defaults.has(key);
}

// ✅ Supabase/PostgREST の “列が無い” 系を広めに拾う（schema cache も含む）
function isMissingColumnError(e: any) {
  const s = String(e?.message ?? e ?? "").toLowerCase();

  const looksLikeMissing =
    s.includes("column") &&
    (s.includes("does not exist") ||
      s.includes("unknown column") ||
      s.includes("not found") ||
      s.includes("not exist") ||
      s.includes("undefined_column"));

  const schemaCache =
    s.includes("schema cache") &&
    (s.includes("could not find") || s.includes("not found") || s.includes("missing") || s.includes("column"));

  return looksLikeMissing || schemaCache;
}

// ✅ upsert が “制約未整備” で失敗するパターンを拾う（冪等化SQL未適用でも壊さない）
function isMissingUpsertConstraintError(e: any) {
  const s = String(e?.message ?? e ?? "").toLowerCase();

  // Postgres: there is no unique or exclusion constraint matching the ON CONFLICT specification
  if (s.includes("no unique") && s.includes("constraint") && s.includes("on conflict")) return true;

  // 近い表現の揺れ（exclusion / matching）
  if (s.includes("exclusion constraint") && s.includes("on conflict")) return true;
  if (s.includes("matching") && s.includes("on conflict") && s.includes("constraint")) return true;

  return false;
}

function safeText(v: any): string {
  const s = String(v ?? "").trim();
  return s;
}

function toRow(r: any): ConversationRow {
  const out: ConversationRow = {
    id: String(r.id ?? ""),
    user_id: String(r.user_id ?? ""),
    title: String(r.title ?? ""),
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
    state_level: Number(r.state_level ?? 0),
  };

  const cr = safeText((r as any)?.client_request_id);
  if (cr) out.client_request_id = cr;

  return out;
}

function toStateRow(r: any): StateRow {
  return {
    level: Number(r?.level ?? 0),
    code: String(r?.code ?? ""),
    label_ja: String(r?.label_ja ?? ""),
    label_en: String(r?.label_en ?? ""),
    color_token: String(r?.color_token ?? ""),
    ui_class: String(r?.ui_class ?? ""),
  };
}

/**
 * ✅ 取得（IDのみ）
 * - RLSにより「他人のスレ」は見えない前提
 */
export async function getConversationById(params: {
  supabase: SupabaseClient;
  conversationId: string;
}): Promise<{ ok: boolean; row?: ConversationRow | null; error?: any }> {
  const { supabase } = params;

  try {
    const cid = reqNonEmpty("conversationId", params.conversationId);

    // client_request_id は列が無い環境もあり得るので select は安全側（列が無いと落ちるため）
    const { data, error } = await supabase
      .from("conversations")
      .select("id,user_id,title,created_at,updated_at,state_level")
      .eq("id", cid)
      .maybeSingle();

    if (error) return { ok: false, error };
    if (!data) return { ok: true, row: null };

    return { ok: true, row: toRow(data as any) };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * ✅ 新規作成（冪等化対応）
 *
 * - clientRequestId が渡された場合:
 *   DBに (user_id, client_request_id) UNIQUE がある環境では upsert で束ねる
 * - 列/制約が無い環境:
 *   自動で従来 insert にフォールバック（壊さない）
 */
export async function createConversation(params: {
  supabase: SupabaseClient;
  userId: string;
  title?: string | null;

  /**
   * ✅ 冪等キー（同一操作の二重insert防止）
   * 推奨: crypto.randomUUID() 等で生成して、1回の「新規チャット」操作につき1つ渡す
   */
  clientRequestId?: string | null;
}): Promise<{ ok: boolean; row?: ConversationRow; error?: any }> {
  const { supabase } = params;

  try {
    const userId = reqNonEmpty("userId", params.userId);
    const title = clampTitleOrUndef(params.title ?? null);
    const clientRequestId = safeText(params.clientRequestId);

    const insertPayload: Record<string, any> = {
      user_id: userId,
    };

    if (title !== undefined) insertPayload.title = title;

    // ✅ client_request_id は列がある環境でのみ送る（無いと落ちるので try で包む）
    if (clientRequestId) insertPayload.client_request_id = clientRequestId;

    // 1) 冪等化（列/制約があるなら upsert）
    if (clientRequestId) {
      try {
        const { data, error } = await supabase
          .from("conversations")
          .upsert(insertPayload, {
            onConflict: "user_id,client_request_id",
            ignoreDuplicates: false,
          })
          .select("id,user_id,title,created_at,updated_at,state_level,client_request_id")
          .single();

        if (error) {
          // 列/制約が無い・schema cache 等はフォールバックへ
          if (isMissingColumnError(error) || isMissingUpsertConstraintError(error)) {
            throw error;
          }
          return { ok: false, error };
        }

        return { ok: true, row: toRow(data as any) };
      } catch {
        // ✅ 列が無い/制約が無い/古いschema cache等 → 従来insertへフォールバック
      }
    }

    // 2) 従来insert（互換）
    {
      const fallbackPayload: Record<string, any> = {
        user_id: userId,
      };
      if (title !== undefined) fallbackPayload.title = title;

      const { data, error } = await supabase
        .from("conversations")
        .insert(fallbackPayload)
        .select("id,user_id,title,created_at,updated_at,state_level")
        .single();

      if (error) return { ok: false, error };
      return { ok: true, row: toRow(data as any) };
    }
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * ✅ 所有権チェック専用（厳密版）
 *
 * 戻り値:
 * - conversation_not_found      → 物理的に存在しない
 * - conversation_forbidden      → 存在するが所有者が違う
 * - conversation_db_forbidden   → RLSなどで拒否
 */
export async function assertConversationOwnership(params: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
}): Promise<{ ok: boolean; error?: string; detail?: any }> {
  try {
    const uid = reqNonEmpty("userId", params.userId);
    const cid = reqNonEmpty("conversationId", params.conversationId);

    const { data, error } = await params.supabase.from("conversations").select("id,user_id").eq("id", cid).maybeSingle();

    if (error) {
      const msg = String(error?.message ?? "").toLowerCase();
      if (msg.includes("row-level security") || msg.includes("permission")) {
        return { ok: false, error: "conversation_db_forbidden", detail: error };
      }
      return { ok: false, error: "conversation_check_failed", detail: error };
    }

    if (!data) {
      return { ok: false, error: "conversation_not_found" };
    }

    const owner = String((data as any).user_id ?? "");
    if (owner !== uid) {
      return { ok: false, error: "conversation_forbidden" };
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: "conversation_check_failed", detail: e };
  }
}

/**
 * ✅ チャット単位の思考状態を更新
 * - user_id一致も条件に入れて誤更新を防ぐ（RLSが無い環境でも事故回避）
 * - 0件更新（no_match）は updated:false
 */
export async function updateConversationStateLevel(params: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  stateLevel: number;
}): Promise<{ ok: boolean; updated: boolean; row?: ConversationRow; reason: string; error?: any }> {
  const { supabase } = params;

  try {
    const uid = reqNonEmpty("userId", params.userId);
    const cid = reqNonEmpty("conversationId", params.conversationId);

    const level = Number(params.stateLevel);
    if (!Number.isFinite(level) || level <= 0) {
      return { ok: false, updated: false, reason: "invalid_state_level" };
    }

    const { data, error } = await supabase
      .from("conversations")
      .update({ state_level: level })
      .eq("id", cid)
      .eq("user_id", uid)
      .select("id,user_id,title,created_at,updated_at,state_level")
      .maybeSingle();

    if (error) return { ok: false, updated: false, reason: "update_failed", error };
    if (!data) return { ok: true, updated: false, reason: "no_match" };

    return { ok: true, updated: true, reason: "updated", row: toRow(data as any) };
  } catch (error) {
    return { ok: false, updated: false, reason: "exception", error };
  }
}

/**
 * ✅ チャット単位の思考状態（statesマスタ）を取得
 * - 安全性優先で 2 クエリ（join名/constraint名に依存しない）
 */
export async function getConversationStateMaster(params: {
  supabase: SupabaseClient;
  conversationId: string;
}): Promise<{ ok: boolean; state?: StateRow | null; error?: any; reason?: string }> {
  const { supabase } = params;

  try {
    const cid = reqNonEmpty("conversationId", params.conversationId);

    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("state_level")
      .eq("id", cid)
      .maybeSingle();

    if (convErr) return { ok: false, error: convErr, reason: "select_conversation_failed" };
    if (!conv) return { ok: true, state: null, reason: "conversation_not_found_or_not_visible" };

    const level = Number((conv as any)?.state_level ?? 0);
    if (!level) return { ok: true, state: null, reason: "no_state_level" };

    const { data: st, error: stErr } = await supabase
      .from("states")
      .select("level,code,label_ja,label_en,color_token,ui_class")
      .eq("level", level)
      .maybeSingle();

    if (stErr) return { ok: false, error: stErr, reason: "select_states_failed" };
    if (!st) return { ok: true, state: null, reason: "state_not_found" };

    return { ok: true, state: toStateRow(st as any) };
  } catch (error) {
    return { ok: false, error, reason: "exception" };
  }
}

/**
 * ✅ タイトル自動生成（PhaseC-1）
 * - 既存タイトルが default のときだけ更新（ユーザーrename優先）
 * - user_id一致も条件に入れて誤更新を防ぐ（RLSが無い環境でも事故回避）
 * - 失敗しても会話を壊さない（ok=falseでも呼び出し側は継続可能）
 */
export async function maybeAutoRenameConversationTitle(params: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  userText: string;
  maxLen?: number;
  defaults?: string[];
}): Promise<{ ok: boolean; updated: boolean; reason: string; title?: string }> {
  const { supabase } = params;

  try {
    const uid = reqNonEmpty("userId", params.userId);
    const cid = reqNonEmpty("conversationId", params.conversationId);

    const maxLen = Number.isFinite(params.maxLen) ? Number(params.maxLen) : 30;
    const nextTitle = buildAutoTitleFromUserText(params.userText, maxLen);

    if (!nextTitle) return { ok: true, updated: false, reason: "no_title" };

    const { data: selData, error: selError } = await supabase
      .from("conversations")
      .select("title")
      .eq("id", cid)
      .maybeSingle();

    if (selError) return { ok: false, updated: false, reason: "select_failed" };

    // ✅ RLS等で見えない場合は更新できないので、ここで静かにスキップ
    if (!selData) return { ok: true, updated: false, reason: "not_visible" };

    const currentTitle = (selData as any)?.title as string | null | undefined;

    // defaults を明示したい場合に拡張できるようにする（正規化して比較）
    const extraDefaults = Array.isArray(params.defaults)
      ? params.defaults
          .map((x) => normalizeTitleCandidate(String(x ?? "")))
          .filter(Boolean)
          .map((x) => normalizeTitleKey(x))
      : [];

    // ✅ default判定は「末尾サフィックスを剥いだタイトル」で比較
    const currentKey = normalizeTitleKey(stripDisambiguationSuffix(String(currentTitle ?? "")));
    const isDefault =
      isDefaultConversationTitle(currentTitle) || (extraDefaults.length ? extraDefaults.includes(currentKey) : false);

    if (!isDefault) return { ok: true, updated: false, reason: "not_default" };

    // ✅ 重要：本当に更新できたかを data の有無で判定（0件更新＝updated:false）
    const { data: updData, error: updError } = await supabase
      .from("conversations")
      .update({ title: nextTitle })
      .eq("id", cid)
      .eq("user_id", uid)
      .select("id,title")
      .maybeSingle();

    if (updError) return { ok: false, updated: false, reason: "update_failed" };
    if (!updData) return { ok: true, updated: false, reason: "no_match" };

    const title = normalizeTitleCandidate(String((updData as any)?.title ?? nextTitle)) || nextTitle;

    return { ok: true, updated: true, reason: "updated", title };
  } catch {
    return { ok: false, updated: false, reason: "exception" };
  }
}