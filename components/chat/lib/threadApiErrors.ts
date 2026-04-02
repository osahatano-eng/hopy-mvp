// /components/chat/lib/threadApiErrors.ts

/**
 * ✅ エラーメッセージを message / details / hint / code からまとめて正規化
 */
function getErrorText(e: any) {
  const msg = String(e?.message ?? e ?? "").toLowerCase();
  const det = String(e?.details ?? "").toLowerCase();
  const hint = String(e?.hint ?? "").toLowerCase();
  const code = String(e?.code ?? "").toLowerCase();
  return `${msg} ${det} ${hint} ${code}`.trim();
}

/**
 * ✅ "column <name> does not exist" / schema cache missing を
 * 特定カラム名つきで厳密に判定する
 */
export function isMissingSpecificColumnError(e: any, columnName: string) {
  const s = getErrorText(e);
  const col = String(columnName ?? "").trim().toLowerCase();
  if (!s || !col) return false;

  const quoted = `"${col}"`;
  const dotted = `.${col}`;
  const spaced = ` ${col} `;
  const parened = `(${col})`;

  const mentionsColumn =
    s.includes(quoted) ||
    s.includes(dotted) ||
    s.includes(spaced) ||
    s.includes(parened) ||
    s.includes(`column ${col}`) ||
    s.includes(`'${col}'`) ||
    s.includes(`"${col}"`);

  if (!mentionsColumn) return false;

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

/**
 * ✅ Supabase/PostgREST の “列が無い” 系を広めに拾う（schema cache も含む）
 * ただし「どの列か」は見ないため、フォールバック分岐では
 * isMissingSpecificColumnError(...) を優先利用すること
 */
export function isMissingColumnError(e: any) {
  const s = getErrorText(e);
  if (!s) return false;

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

/**
 * ✅ conversation_id 列が無い環境かどうかを厳密判定
 */
export function isConversationIdMissingError(e: any) {
  return isMissingSpecificColumnError(e, "conversation_id");
}

/**
 * ✅ thread_id 列が無い環境かどうかを厳密判定
 */
export function isThreadIdMissingError(e: any) {
  return isMissingSpecificColumnError(e, "thread_id");
}

/**
 * ✅ 「updated_at が無い / order できない」環境かどうかを判定（PCの400対策）
 */
export function isUpdatedAtUnsupportedError(e: any) {
  const s = getErrorText(e);
  if (!s) return false;

  if (isMissingSpecificColumnError(e, "updated_at")) return true;

  if (s.includes("updated_at") && (s.includes("order") || s.includes("sorting") || s.includes("could not find")))
    return true;

  return false;
}

/**
 * ✅ PGRST116: single/maybeSingle が 0 rows で落ちる環境の吸収
 */
export function isNoRowsSingleError(e: any) {
  const code = String((e as any)?.code ?? "").trim();
  if (code === "PGRST116") return true;

  const s = getErrorText(e);
  if (!s) return false;

  if (s.includes("cannot coerce") && s.includes("single json")) return true;
  if (s.includes("result contains 0 rows")) return true;

  return false;
}

/**
 * ✅ ON CONFLICT に必要な UNIQUE 制約が無い時の典型エラーを拾う
 */
export function isOnConflictConstraintMissingError(e: any) {
  const s = getErrorText(e);
  return (
    s.includes("no unique") &&
    s.includes("exclusion constraint") &&
    (s.includes("matching") || s.includes("on conflict"))
  );
}

/**
 * ✅ 一時的な認証揺れ（PWA復帰直後）を拾う
 */
export function isTransientAuthOrNetworkError(e: any) {
  const s = getErrorText(e);
  if (!s) return false;

  if (s.includes("failed to fetch")) return true;
  if (s.includes("network")) return true;
  if (s.includes("timeout")) return true;
  if (s.includes("temporar")) return true;
  if (s.includes("socket")) return true;

  if (s.includes("jwt")) return true;
  if (s.includes("token")) return true;
  if (s.includes("refresh")) return true;
  if (s.includes("unauthorized")) return true;
  if (s.includes("forbidden")) return true;
  if (s.includes("401")) return true;
  if (s.includes("403")) return true;

  return false;
}

/**
 * ✅ “認証がまだ復元中” っぽいときの判定（DB/RLSが401/403になる経路を止める）
 */
export function isAuthNotReadyError(e: any) {
  const s = getErrorText(e);
  if (!s) return false;

  if (s.includes("401") || s.includes("403")) return true;
  if (s.includes("unauthorized") || s.includes("forbidden")) return true;
  if (s.includes("jwt") || s.includes("token")) return true;

  return false;
}