// /app/api/chat/route.ts
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildSigSeed } from "./_lib/system/system";
import { PERSONA_VERSION, personaPromptDigest } from "./_lib/system/persona";
import { routeInput, pickStrategy, type Lang } from "./_lib/router/simpleRouter";
import { json, getBearerToken } from "./_lib/infra/http";
import { envInt, envOn } from "./_lib/infra/env";
import { clampText, normalizeLang } from "./_lib/infra/text";
import { createAuthedSupabase } from "./_lib/supabase/client";
import { normalizeAccessToken, getAuthedUserId } from "./_lib/route/auth";
import {
  resolveClientRequestIdFromBody,
  resolveConversationIdFromBody,
} from "./_lib/route/requestBody";
import { decideReplyLanguage } from "./_lib/route/promptBundle";
import { handleGuestChat } from "./_lib/route/guest";
import { handleAuthenticatedChat } from "./_lib/route/authenticated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUILD_SIG = `chat_route_sig|${buildSigSeed()}|persona_v${PERSONA_VERSION}:${personaPromptDigest(
  "en"
)}:${personaPromptDigest("ja")}|route_v40_guest_allowed_no_persist`;

const MODEL_NAME = "gpt-4.1";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEBUG_SAVE = envOn("HOPY_DEBUG_SAVE");
const OPENAI_TIMEOUT_MS = Math.max(
  envInt("HOPY_OPENAI_TIMEOUT_MS", 90000),
  90000,
);
const MEMORY_EXTRACT_TIMEOUT_MS = envInt("HOPY_MEMORY_EXTRACT_TIMEOUT_MS", 5500);
const MEMORY_MIN_INTERVAL_SEC = envInt("HOPY_MEMORY_MIN_INTERVAL_SEC", 90);
const ALLOW_MEMORY_CLEAN = envOn("HOPY_ALLOW_MEMORY_CLEAN");
const MEMORY_CLEAN_LIMIT = envInt("HOPY_MEMORY_CLEAN_LIMIT", 300);
const CONTEXT_LIMIT = envInt("HOPY_CONTEXT_LIMIT", 16);
const ENFORCE_THREAD_OWNERSHIP = envOn("HOPY_ENFORCE_THREAD_OWNERSHIP");
const MISSING_THREAD_REUSE_WINDOW_SEC = envInt("HOPY_MISSING_THREAD_REUSE_WINDOW_SEC", 1800);

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    let body: any = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {}

    const userText = clampText(body?.text ?? "", 8000);
    if (!userText) return json(400, { ok: false, error: "bad_request" });

    const uiLang: Lang = normalizeLang(body?.lang);
    const accessToken = normalizeAccessToken(getBearerToken(req));
    const isGuest = !accessToken;

    const routed = routeInput(userText);
    const replyLang: Lang = decideReplyLanguage({
      uiLang,
      userText,
      routedLang: routed.lang ?? null,
    });

    if (isGuest) {
      const guestRes = await handleGuestChat({
        openai,
        modelName: MODEL_NAME,
        body,
        userText,
        uiLang,
        replyLang,
        routedLang: routed.lang ?? null,
        buildSig: BUILD_SIG,
        debugSave: DEBUG_SAVE,
        openaiTimeoutMs: OPENAI_TIMEOUT_MS,
        memoryExtractTimeoutMs: MEMORY_EXTRACT_TIMEOUT_MS,
        memoryMinIntervalSec: MEMORY_MIN_INTERVAL_SEC,
      });

      return json(200, guestRes.payload);
    }

    let supabase: SupabaseClient;
    try {
      supabase = createAuthedSupabase({ accessToken });
    } catch (e: any) {
      return json(500, {
        ok: false,
        error: "supabase_misconfigured",
        message: String(e?.message ?? e),
      });
    }

    const au = await getAuthedUserId(supabase, accessToken);
    if (!au.ok) {
      const payload: any = { ok: false, error: au.error };
      if (DEBUG_SAVE) {
        payload.detail = au.detail ?? null;
        payload.token_prefix = String(accessToken).slice(0, 8) + "…";
      }
      return json(401, payload);
    }

    const authedUserId = au.userId;
    const clientRequestIdIn = resolveClientRequestIdFromBody(body);
    const requestedConversationId = resolveConversationIdFromBody(body);

    const allowMissingThreadReuse = !!requestedConversationId;
    const missingThreadReuseWindowSec = allowMissingThreadReuse
      ? MISSING_THREAD_REUSE_WINDOW_SEC
      : 0;

    const selectedStrategy = pickStrategy(routed.tone, routed.intensity);

    const authRes = await handleAuthenticatedChat({
      openai,
      modelName: MODEL_NAME,
      supabase,
      accessToken,
      authedUserId,
      body,
      userText,
      uiLang,
      replyLang,
      routed: {
        tone: routed.tone,
        intensity: routed.intensity,
        lang: routed.lang ?? null,
      },
      selectedStrategy,
      buildSig: BUILD_SIG,
      debugSave: DEBUG_SAVE,
      openaiTimeoutMs: OPENAI_TIMEOUT_MS,
      memoryExtractTimeoutMs: MEMORY_EXTRACT_TIMEOUT_MS,
      memoryMinIntervalSec: MEMORY_MIN_INTERVAL_SEC,
      allowMemoryClean: ALLOW_MEMORY_CLEAN,
      memoryCleanLimit: MEMORY_CLEAN_LIMIT,
      contextLimit: CONTEXT_LIMIT,
      enforceThreadOwnership: ENFORCE_THREAD_OWNERSHIP,
      missingThreadReuseWindowSec,
      clientRequestIdIn,
      requestedConversationId,
    });

    return json(authRes.status, authRes.payload);
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: "unhandled",
      message: String(e?.message ?? e),
    });
  }
}

/*
このファイルの正式役割
- HTTP の入口
- request body を読む
- userText と uiLang を整える
- guest か authenticated かを分岐する
- guest なら handleGuestChat(...)
- authenticated なら handleAuthenticatedChat(...)
- 最後に json(...) で返す

このファイルが受け取るもの
- req
- body.text
- body.lang
- bearer token
- conversation / request id

このファイルが渡すもの
- guest 側へ:
  - openai
  - modelName
  - body
  - userText
  - uiLang
  - replyLang
  - routedLang
  - buildSig
  - debugSave
  - timeout 系設定
- authenticated 側へ:
  - openai
  - modelName
  - supabase
  - accessToken
  - authedUserId
  - body
  - userText
  - uiLang
  - replyLang
  - routed
  - selectedStrategy
  - buildSig
  - debugSave
  - timeout / memory / context 系設定
  - clientRequestIdIn
  - requestedConversationId

Compass 観点でこのファイルの意味
- このファイル自身は Compass を生成していない
- state_changed を判定していない
- Compass の表示可否も決めていない
- つまりここは Compass の入口ではあるが、生成や中継の核心ではない
- 今回の追跡対象では、Free ではなく Plus / Pro の HOPY○ → Compass 表示なので、guest ではなく authenticated 側が本道になる

このファイルで確認できた大事なこと
- route.ts は HTTP 入口と guest / authenticated 分岐の責務に留まっている
- Compass 問題の核心はこのファイルの下流にある
- 次に追うべき実在ファイルは /app/api/chat/_lib/route/authenticated.ts
*/

/* /app/api/chat/route.ts */