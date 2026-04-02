// /app/api/chat/route.ts
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUILD_SIG = "chat_route_sig_2026-02-19_a11";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

import { getOrCreateUserState } from "./_lib/db/userState";
import { updateUserStateFromMessage } from "./_lib/state/update";
import { buildPhaseSystem } from "./_lib/phase/system";
import { phaseParams } from "./_lib/phase/phaseParams";

type Lang = "ja" | "en";

function normalizeLang(x: any): Lang {
  const s = String(x ?? "").toLowerCase().trim();
  return s === "en" ? "en" : "ja";
}

function clampText(s: string, max = 8000) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) : t;
}

function json(status: number, payload: any) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-HOPY-Build": BUILD_SIG,
    },
  });
}

function normalizeUserId(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.toLowerCase() === "null") return null;
  if (s.toLowerCase() === "undefined") return null;
  return s;
}

async function insertMessage(args: {
  user_id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
}) {
  const { user_id, conversation_id, role, content, lang } = args;

  // 🔥 最終防衛線（絶対null禁止）
  if (!user_id) {
    return {
      ok: false as const,
      error: { message: "FATAL: user_id is null before insert" },
    };
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      user_id,
      conversation_id,
      role,
      content,
      lang,
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error };

  return { ok: true as const, id: data?.id ?? null };
}

export async function POST(req: Request) {
  const t0 = Date.now();

  try {
    const rawBody = await req.text();
    console.log("RAW BODY:", rawBody);

    let body: any = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      body = {};
    }
    console.log("PARSED BODY:", body);

    const conversationId = String(body?.thread_id ?? "").trim();
    if (!conversationId) {
      return json(400, { ok: false, build: BUILD_SIG, error: "missing_thread_id" });
    }

    const userText = clampText(body?.text ?? "");
    if (!userText) {
      return json(400, { ok: false, build: BUILD_SIG, error: "bad_request" });
    }

    const bodyUserId = normalizeUserId(body?.user_id);
    console.log("BODY USER_ID:", bodyUserId);

    if (!bodyUserId) {
      return json(401, {
        ok: false,
        build: BUILD_SIG,
        error: "missing_user_id",
        debug_received_user_id: body?.user_id ?? null,
      });
    }

    // ✅ lang は client が msgLang を送る前提だが、念のため正規化
    const uiLang: Lang = normalizeLang(body?.lang);

    // ✅ Phase2-②: memory_block（今はDB統合しない：安定優先）
    const memoryBlock = String(body?.memory_block ?? "").trim();

    // 1) user message 保存
    const insUser = await insertMessage({
      user_id: bodyUserId,
      conversation_id: conversationId,
      role: "user",
      content: userText,
      lang: uiLang,
    });

    if (!insUser.ok) {
      return json(500, {
        ok: false,
        build: BUILD_SIG,
        error: "user_save_failed",
        details: insUser.error?.message,
      });
    }

    // 2) Phase2-①: state update（non-fatal / observability）
    let stateOk = false;
    let stateError: any = null;
    let stateForSystem: any = null;

    try {
      const upd = await updateUserStateFromMessage({
        supabase,
        userId: bodyUserId,
        uiLang,
        text: userText,
      });

      if (upd.ok) {
        stateOk = true;
        stateForSystem = upd.state ?? null;

        if (upd.skipped) {
          // skipped is not error
        }
      } else {
        stateOk = false;
        stateError = upd.error ?? { message: "state_update_failed" };
      }
    } catch (e: any) {
      stateOk = false;
      stateError = { message: String(e?.message ?? e) };
    }

    // 2.5) fallback read (system needs state even if update failed)
    if (!stateForSystem) {
      try {
        const sr = await getOrCreateUserState({ supabase, userId: bodyUserId });
        if (sr.ok && sr.state) stateForSystem = sr.state;
      } catch {
        // ignore
      }
    }

    const phaseForParams =
      typeof stateForSystem?.current_phase === "number" ? stateForSystem.current_phase : 1;

    const systemPrompt = buildPhaseSystem({
      uiLang,
      state: stateForSystem ?? null,
      memoryBlock,
      userText,
      conversationId,
    });

    const paramsByPhase = phaseParams(phaseForParams);

    // 3) OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      temperature: paramsByPhase.temperature,
      max_tokens: paramsByPhase.max_tokens,
    });

    const assistantText = clampText(completion.choices?.[0]?.message?.content ?? "");

    // 4) assistant message 保存
    const insAsst = await insertMessage({
      user_id: bodyUserId,
      conversation_id: conversationId,
      role: "assistant",
      content: assistantText,
      lang: uiLang,
    });

    if (!insAsst.ok) {
      return json(500, {
        ok: false,
        build: BUILD_SIG,
        error: "assistant_save_failed",
        details: insAsst.error?.message,
      });
    }

    return json(200, {
      ok: true,
      build: BUILD_SIG,
      reply: assistantText,
      user_saved: true,
      assistant_saved: true,

      // ✅ state observability
      state_ok: stateOk,
      state_available: !!stateForSystem,
      state: stateForSystem ?? null,
      state_error: stateError,

      // ✅ phase params observability
      phase_params: {
        phase: phaseForParams,
        temperature: paramsByPhase.temperature,
        max_tokens: paramsByPhase.max_tokens,
      },

      ms: Date.now() - t0,
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      build: BUILD_SIG,
      error: "unhandled",
      message: String(e?.message ?? e),
    });
  }
}
