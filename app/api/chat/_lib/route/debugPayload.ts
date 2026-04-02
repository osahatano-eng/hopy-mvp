// /app/api/chat/_lib/route/debugPayload.ts
import { systemCoreDigest } from "../system/system";
import { PERSONA_VERSION, personaPromptDigest } from "../system/persona";
import {
  detectExplicitReplyLanguageRequest,
  isShortLowSignalEnglish,
} from "./promptBundle";
import type { Lang } from "../router/simpleRouter";

type ResolvedPlan = "free" | "plus" | "pro";

type DebugPayloadArgs = {
  payload: any;
  buildSig: string;
  openaiTimeoutMs: number;
  contextLimit: number;
  memoryExtractTimeoutMs: number;
  memoryMinIntervalSec: number;
  memoryCleanEnabled: boolean;
  memoryCleanLimit: number;
  enforceThreadOwnership: boolean;
  missingThreadReuseWindowSec: number;

  openai_ok: boolean;
  openai_error: string | null;

  userMessageId: string;
  insUserOk: boolean;

  assistantMessageId: string;
  insAsstOk: boolean;
  replyLang: Lang;
  resolvedPlan: ResolvedPlan;

  memoryInjected: boolean;
  memoryBlock: string;
  learningBlock?: string;
  ctxRes: any;

  mem_write_attempted: boolean;
  mem_write_allowed: boolean;
  mem_write_inserted: number;
  mem_write_reason: string | null;

  mem_items_count: number;
  mem_parse_ok: boolean | null;
  mem_extract_preview: unknown;
  mem_used_heuristic: boolean | null;

  learning_save_attempted?: boolean | null;
  learning_save_inserted?: number | null;
  learning_save_reason?: string | null;
  learning_save_error?: string | null;

  st: any;

  audit_ok: boolean | null;
  audit_error: string | null;

  precheck_not_found: boolean;

  auto_title_ok: boolean | null;
  auto_title_updated: boolean | null;
  auto_title_reason: string | null;
  auto_title_title: string | null;

  server_created_thread: boolean;
  server_created_thread_title: string | null;
  server_reused_recent_thread: boolean;
  server_reused_recent_thread_title: string | null;

  clientRequestIdIn: string;
  server_created_client_request_id: string | null;

  accessToken: string;
  uiLang: Lang;
  routedLang: Lang | null | undefined;
  userText: string;

  response_generation_log_ok: boolean | null;
  response_generation_log_error: string | null;
  state_transition_signal_ok: boolean | null;
  state_transition_signal_error: string | null;
};

function buildLanguageDebugInfo(args: {
  userText: string;
  uiLang: Lang;
  routedLang: Lang | null | undefined;
  replyLang: Lang;
}) {
  return {
    ui_lang: args.uiLang,
    routed_lang: args.routedLang ?? null,
    reply_lang: args.replyLang,
    explicit_reply_lang_request: detectExplicitReplyLanguageRequest(
      args.userText,
    ),
    short_low_signal_english: isShortLowSignalEnglish(args.userText),
  };
}

function normalizeMemWriteReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMemExtractPreview(value: unknown): unknown {
  if (value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }

    return trimmed;
  }

  return value;
}

export function attachDebugPayload(args: DebugPayloadArgs) {
  args.payload.openai_ok = args.openai_ok;
  args.payload.openai_error = args.openai_error;
  args.payload.openai_timeout_ms = args.openaiTimeoutMs;

  args.payload.user_saved = args.insUserOk;
  args.payload.user_message_id = args.userMessageId;

  args.payload.assistant_saved = args.insAsstOk;
  args.payload.assistant_message_id = args.assistantMessageId;
  args.payload.assistant_reply_lang = args.replyLang;
  args.payload.resolved_plan = args.resolvedPlan;

  args.payload.memory_injected = args.memoryInjected;
  args.payload.memory_chars = String(args.memoryBlock ?? "").length;
  args.payload.learning_chars = String(args.learningBlock ?? "").length;
  args.payload.learning_injected =
    String(args.learningBlock ?? "").trim().length > 0;
  args.payload.learning_block = args.learningBlock ?? "";

  args.payload.learning_save_attempted = args.learning_save_attempted ?? null;
  args.payload.learning_save_inserted = args.learning_save_inserted ?? null;
  args.payload.learning_save_reason = args.learning_save_reason ?? null;
  args.payload.learning_save_error = args.learning_save_error ?? null;

  args.payload.ctx_ok = args.ctxRes.ok;
  args.payload.ctx_error = args.ctxRes?.error ?? null;
  args.payload.ctx_limit = args.contextLimit;
  args.payload.ctx_count = args.ctxRes.ok ? args.ctxRes.items.length : 0;
  args.payload.ctx_tried = args.ctxRes?.tried ?? null;

  args.payload.mem_write_attempted = args.mem_write_attempted;
  args.payload.mem_write_allowed = args.mem_write_allowed;
  args.payload.mem_write_inserted = args.mem_write_inserted;
  args.payload.mem_write_reason = normalizeMemWriteReason(
    args.mem_write_reason,
  );

  args.payload.mem_items_count = args.mem_items_count;
  args.payload.mem_parse_ok = args.mem_parse_ok;
  args.payload.mem_extract_preview = normalizeMemExtractPreview(
    args.mem_extract_preview,
  );
  args.payload.mem_used_heuristic = args.mem_used_heuristic;

  args.payload.mem_min_interval_sec = args.memoryMinIntervalSec;
  args.payload.mem_extract_timeout_ms = args.memoryExtractTimeoutMs;

  args.payload.mem_clean_enabled = args.memoryCleanEnabled;
  args.payload.mem_clean_limit = args.memoryCleanLimit;

  args.payload.conversation_state_ok = args.st.ok;
  args.payload.conversation_state_error = args.st.ok
    ? null
    : args.st?.error ?? "conversation_state_failed";
  args.payload.conversation_state_skipped = args.st?.skipped ?? null;
  args.payload.conversation_state_skip_reason =
    args.st?.skip_reason ?? args.st?.reason ?? null;

  args.payload.audit_ok = args.audit_ok;
  args.payload.audit_error = args.audit_error;
  args.payload.build_sig = args.buildSig;
  args.payload.system_core_digest = systemCoreDigest();

  args.payload.persona_version = PERSONA_VERSION;
  args.payload.persona_digest_en = personaPromptDigest("en");
  args.payload.persona_digest_ja = personaPromptDigest("ja");

  args.payload.own_precheck_not_found = args.precheck_not_found;
  args.payload.enforce_thread_ownership = args.enforceThreadOwnership;

  args.payload.auto_title_ok = args.auto_title_ok;
  args.payload.auto_title_updated = args.auto_title_updated;
  args.payload.auto_title_reason = args.auto_title_reason;
  args.payload.auto_title_title = args.auto_title_title;

  args.payload.server_created_thread = args.server_created_thread;
  args.payload.server_created_thread_title = args.server_created_thread_title;

  args.payload.server_reused_recent_thread = args.server_reused_recent_thread;
  args.payload.server_reused_recent_thread_title =
    args.server_reused_recent_thread_title;
  args.payload.missing_thread_reuse_window_sec =
    args.missingThreadReuseWindowSec;

  args.payload.client_request_id_in = args.clientRequestIdIn || null;
  args.payload.server_created_client_request_id =
    args.server_created_client_request_id;

  args.payload.auth_mode = "bearer_token";
  args.payload.token_prefix = String(args.accessToken).slice(0, 8) + "…";
  args.payload.auth_rest_fallback = true;

  args.payload.response_generation_log_ok = args.response_generation_log_ok;
  args.payload.response_generation_log_error =
    args.response_generation_log_error;
  args.payload.state_transition_signal_ok = args.state_transition_signal_ok;
  args.payload.state_transition_signal_error =
    args.state_transition_signal_error;

  const languageDebug = buildLanguageDebugInfo({
    userText: args.userText,
    uiLang: args.uiLang,
    routedLang: args.routedLang,
    replyLang: args.replyLang,
  });

  args.payload.ui_lang = languageDebug.ui_lang;
  args.payload.routed_lang = languageDebug.routed_lang;
  args.payload.reply_lang = languageDebug.reply_lang;
  args.payload.explicit_reply_lang_request =
    languageDebug.explicit_reply_lang_request;
  args.payload.short_low_signal_english =
    languageDebug.short_low_signal_english;
}

/*
このファイルの正式役割
debug payload へ各種診断情報を積む専用ファイル。
build 時や実行時の確認に必要な情報を payload に集約する。
*/

/*
【今回このファイルで修正したこと】
- promptBundle.ts から export されていない ResolvedPlan の import を削除した。
- このファイル内で必要最小限の ResolvedPlan 型を定義した。
- attachDebugPayload の実行ロジック自体は変えていない。
*/
// このファイルの正式役割: debug payload へ各種診断情報を積む専用ファイル