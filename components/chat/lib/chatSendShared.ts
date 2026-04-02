// /components/chat/lib/chatSendShared.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadActiveThreadId, saveActiveThreadId } from "./threadStore";

export type ErrKind = "Network" | "Auth" | "Validation" | "DB/Server" | "Unknown";

const RAW_CHAT_ENDPOINT =
  (() => {
    const v =
      typeof process !== "undefined"
        ? String(process.env.NEXT_PUBLIC_CHAT_ENDPOINT ?? "").trim()
        : "";
    return v || "/api/chat";
  })() || "/api/chat";

function isLoopbackHostname(hostname: string): boolean {
  const host = String(hostname ?? "").trim().toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
}

function resolveChatEndpoint(): string {
  const fallbackPath = "/api/chat";

  if (typeof window === "undefined") {
    return RAW_CHAT_ENDPOINT || fallbackPath;
  }

  const pageOrigin = String(window.location.origin ?? "").trim();
  const raw = String(RAW_CHAT_ENDPOINT ?? "").trim() || fallbackPath;

  try {
    if (!pageOrigin) {
      return raw || fallbackPath;
    }

    if (/^https?:\/\//i.test(raw)) {
      const endpointUrl = new URL(raw);
      const pageUrl = new URL(pageOrigin);

      const endpointIsLoopback = isLoopbackHostname(endpointUrl.hostname);
      const pageIsLoopback = isLoopbackHostname(pageUrl.hostname);

      if (endpointIsLoopback && !pageIsLoopback) {
        endpointUrl.protocol = pageUrl.protocol;
        endpointUrl.host = pageUrl.host;
      }

      return endpointUrl.toString();
    }

    return new URL(raw || fallbackPath, pageOrigin).toString();
  } catch {
    try {
      return new URL(fallbackPath, pageOrigin).toString();
    } catch {
      return fallbackPath;
    }
  }
}

export function safeStr(x: any) {
  if (typeof x === "string") return x;
  try {
    return JSON.stringify(x);
  } catch {
    return String(x ?? "");
  }
}

export function mkTempId() {
  return `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getChatEndpoint() {
  return resolveChatEndpoint();
}

export function pickReply(payload: any): string {
  const r = typeof payload?.reply === "string" ? payload.reply : "";
  if (r.trim()) return r.trim();
  const t = typeof payload?.text === "string" ? payload.text : "";
  if (t.trim()) return t.trim();
  return "";
}

export function pickLang(payload: any, fallback: "ja" | "en"): "ja" | "en" {
  const v = String(payload?.lang ?? payload?.uiLang ?? "")
    .toLowerCase()
    .trim();
  return v === "en" ? "en" : fallback;
}

export async function safeReadJson(res: Response) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    const t = await res.text();
    return { ok: false, message: t.slice(0, 500) };
  } catch {
    return null;
  }
}

export function microtask(fn: () => void) {
  try {
    if (typeof queueMicrotask === "function") return queueMicrotask(fn);
  } catch {}
  Promise.resolve()
    .then(fn)
    .catch(() => {});
}

function normalizeErrorMessage(value: unknown): string {
  return String(value ?? "").trim();
}

function pickPayloadErrorMessage(payload: any): string {
  return normalizeErrorMessage(payload?.message || payload?.error || "");
}

function isTimeoutLikeStatus(status?: number | null): boolean {
  return status === 408 || status === 504;
}

function isTimeoutLikeMessage(message: string): boolean {
  const s = normalizeErrorMessage(message).toLowerCase();
  if (!s) return false;

  return (
    s.includes("timeout") ||
    s.includes("timed out") ||
    s.includes("time out") ||
    s.includes("generation_timeout") ||
    s.includes("response_timeout") ||
    s.includes("request_timeout") ||
    s.includes("返答の生成が間に合いませんでした") ||
    s.includes("生成が間に合いませんでした") ||
    s.includes("時間切れ")
  );
}

export function classifyError(args: {
  err: any;
  status?: number | null;
  payload?: any | null;
}): { kind: ErrKind; message: string } {
  const { err, status, payload } = args;

  const msg0 = safeStr(err?.message ?? err ?? "");
  const msg = normalizeErrorMessage(msg0);
  const payloadMsg = pickPayloadErrorMessage(payload);
  const st = typeof status === "number" ? status : null;

  const timeoutLike =
    isTimeoutLikeStatus(st) ||
    isTimeoutLikeMessage(msg) ||
    isTimeoutLikeMessage(payloadMsg);

  if (timeoutLike) {
    return {
      kind: "DB/Server",
      message: payloadMsg || msg || "timeout_error",
    };
  }

  if (
    err?.name === "AbortError" ||
    /networkerror|failed to fetch|load failed|net::/i.test(msg)
  ) {
    return { kind: "Network", message: msg || "network_error" };
  }

  if (st != null) {
    if (st === 401 || st === 403) {
      return {
        kind: "Auth",
        message:
          msg ||
          payloadMsg ||
          "auth_error",
      };
    }
    if (st >= 400 && st <= 499) {
      return {
        kind: "Validation",
        message:
          msg ||
          payloadMsg ||
          "bad_request",
      };
    }
    if (st >= 500) {
      return {
        kind: "DB/Server",
        message:
          msg ||
          payloadMsg ||
          "server_error",
      };
    }
  }

  if (payloadMsg) return { kind: "Unknown", message: payloadMsg };

  return { kind: "Unknown", message: msg || "unknown_error" };
}

export function formatErrorText(kind: ErrKind, message: string, status?: number | null) {
  const s = String(message || "").trim();
  const st = typeof status === "number" ? status : null;
  const statusPart = st != null ? ` (${st})` : "";
  return `[${kind}${statusPart}] ${s || "error"}`;
}

const IS_DEV =
  (() => {
    try {
      return process.env.NODE_ENV !== "production";
    } catch {
      return true;
    }
  })() ?? true;

function isDebugLogEnabled(): boolean {
  if (IS_DEV) return true;
  try {
    return typeof window !== "undefined" && localStorage.getItem("hopy_debug") === "1";
  } catch {
    return false;
  }
}

export function logWarn(...args: any[]) {
  if (!isDebugLogEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.warn(...args);
  } catch {}
}

export function normalizeForSend(input: string) {
  let s = String(input ?? "").replace(/\r\n/g, "\n");

  s = s.trim();
  if (!s) return "";

  s = s.replace(/\n{3,}/g, "\n\n");

  s = s.trim();

  return s;
}

export function isUuidLikeThreadId(value: string) {
  const v = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function isTemporaryGuestThreadId(value: string) {
  const v = String(value ?? "").trim();
  if (!v) return false;
  if (isUuidLikeThreadId(v)) return false;

  const lower = v.toLowerCase();

  if (
    lower.startsWith("guest") ||
    lower.startsWith("guest_") ||
    lower.startsWith("guest-") ||
    lower.startsWith("local") ||
    lower.startsWith("local_") ||
    lower.startsWith("local-") ||
    lower.startsWith("temp") ||
    lower.startsWith("temp_") ||
    lower.startsWith("temp-") ||
    lower.startsWith("draft") ||
    lower.startsWith("draft_") ||
    lower.startsWith("draft-") ||
    lower.startsWith("tmp_") ||
    lower.startsWith("tmp-") ||
    lower.startsWith("cr_") ||
    lower.startsWith("cli_")
  ) {
    return true;
  }

  return true;
}

export function pickThreadId(payload: any): string {
  try {
    const fromThread = String(payload?.thread?.id ?? "").trim();
    if (fromThread) return fromThread;

    const a = String(payload?.thread_id ?? "").trim();
    if (a) return a;

    const b = String(payload?.conversation_id ?? "").trim();
    if (b) return b;

    const c = String(payload?.conversationId ?? "").trim();
    if (c) return c;
  } catch {}
  return "";
}

export function safePersistActiveThreadId(id: string) {
  const tid = String(id ?? "").trim();
  if (!tid) return;
  try {
    saveActiveThreadId(tid);
  } catch {}
}

export function safeLoadPersistedActiveThreadId(): string | null {
  try {
    const v = String(loadActiveThreadId() ?? "").trim();
    return v || null;
  } catch {
    return null;
  }
}

export function genClientRequestId(): string {
  try {
    const c: any = (globalThis as any)?.crypto;
    if (c && typeof c.randomUUID === "function") {
      return String(c.randomUUID());
    }
  } catch {}

  try {
    const a = Math.random().toString(36).slice(2);
    const b = Math.random().toString(36).slice(2);
    return `cli_${Date.now()}_${a}${b}`;
  } catch {
    return `cli_${Date.now()}`;
  }
}

export function buildAutoTitle(text: string, max = 28): string {
  try {
    let s = String(text ?? "").replace(/\r\n/g, "\n");
    s = s.replace(/\n+/g, " ");
    s = s.replace(/\s{2,}/g, " ").trim();
    if (!s) return "";
    if (s.length <= max) return s;
    return s.slice(0, max).trim();
  } catch {
    return "";
  }
}

export function isDefaultThreadTitle(serverTitle: string) {
  const t = String(serverTitle ?? "").trim();
  if (!t) return true;
  return t === "New chat" || t === "新規チャット" || t === "Untitled" || t === "無題";
}

export async function getAuthContext(supabase: SupabaseClient): Promise<{
  accessToken: string;
  userId: string;
  isLoggedIn: boolean;
}> {
  try {
    const sess = await supabase.auth.getSession();
    const session = sess.data.session;
    const accessToken = String(session?.access_token ?? "").trim();
    const userId = String(session?.user?.id ?? "").trim();
    return {
      accessToken,
      userId,
      isLoggedIn: Boolean(accessToken && userId),
    };
  } catch {
    return {
      accessToken: "",
      userId: "",
      isLoggedIn: false,
    };
  }
}

/*
このファイルの正式役割
送信共通ユーティリティ。
送信先 endpoint、エラー分類、入力正規化、thread id 永続化、
auth context 取得など、useChatSend.ts が使う共通処理をここに集約する。
*/

/*
【今回このファイルで修正したこと】
- getChatEndpoint() が module 初期化時の固定値ではなく、呼び出し時の現在 origin を基準に解決するようにした。
- NEXT_PUBLIC_CHAT_ENDPOINT が localhost 系でも、画面を 192.168.* など別 host で開いている場合は、現在の origin に寄せて /api/chat を送るようにした。
- 相対パス指定でも new URL(..., window.location.origin) で現在表示中の origin に確実に解決するようにした。
*/