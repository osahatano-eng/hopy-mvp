// /app/api/chat-test-db/route.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import { json, getBearerToken } from "../chat/_lib/infra/http";
import { clampText, normalizeLang } from "../chat/_lib/infra/text";
import { createAuthedSupabase } from "../chat/_lib/supabase/client";
import { normalizeAccessToken, getAuthedUserId } from "../chat/_lib/route/auth";
import {
  resolveClientRequestIdFromBody,
  resolveConversationIdFromBody,
} from "../chat/_lib/route/requestBody";
import { resolveAuthThread } from "../chat/_lib/route/authThread";
import { loadLatestAssistantStateForConversation } from "../chat/_lib/route/authState";
import { resolvePromptBundlePlanFromProfiles } from "../chat/_lib/route/authenticatedPlan";
import { loadMemoriesForPrompt } from "../chat/_lib/memories/loadMemoriesForPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type DbOnlyReplyInput = {
  plan: "free" | "plus" | "pro";
  state: Awaited<ReturnType<typeof loadLatestAssistantStateForConversation>>;
  memories: Awaited<ReturnType<typeof loadMemoriesForPrompt>>;
  userText: string;
  uiLang: "ja" | "en";
};

function normalizeReplyLang(value: unknown): "ja" | "en" {
  return normalizeLang(value) === "en" ? "en" : "ja";
}

function phaseLabelJa(phase: number | null | undefined): string {
  switch (phase) {
    case 1:
      return "混線";
    case 2:
      return "模索";
    case 3:
      return "整理";
    case 4:
      return "収束";
    case 5:
      return "決定";
    default:
      return "混線";
  }
}

function phaseLabelEn(phase: number | null | undefined): string {
  switch (phase) {
    case 1:
      return "Mixed";
    case 2:
      return "Exploring";
    case 3:
      return "Organizing";
    case 4:
      return "Converging";
    case 5:
      return "Deciding";
    default:
      return "Mixed";
  }
}

function buildDirectionJa(phase: number | null | undefined): string {
  switch (phase) {
    case 1:
      return "まずは、いま頭の中にあることを一つだけ言葉にして切り分けるのがよさそうです。";
    case 2:
      return "次は、気になっている選択肢を二つくらいまで絞って比べるのがよさそうです。";
    case 3:
      return "ここからは、整理できた内容の中で今いちばん大事な一点を決めると進みやすいです。";
    case 4:
      return "かなり方向が見えているので、最後に迷いを一つだけ確認すると決めやすくなります。";
    case 5:
      return "方向はかなり固まっているので、次は小さく一歩だけ実行に移すのがよさそうです。";
    default:
      return "まずは、いま頭の中にあることを一つだけ言葉にして切り分けるのがよさそうです。";
  }
}

function buildDirectionEn(phase: number | null | undefined): string {
  switch (phase) {
    case 1:
      return "A good next step is to separate just one thing that feels tangled right now.";
    case 2:
      return "A good next step is to narrow the possibilities down to about two options.";
    case 3:
      return "From here, it may help to choose the single most important point from what is already organized.";
    case 4:
      return "The direction is becoming clear, so checking one last hesitation may help you decide.";
    case 5:
      return "The direction looks fairly solid, so the next step is to turn it into one small action.";
    default:
      return "A good next step is to separate just one thing that feels tangled right now.";
  }
}

function normalizeMemoryBody(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function softenMemoryLineJa(value: string): string {
  let text = normalizeMemoryBody(value);
  if (!text) return "";

  text = text.replace(
    /^ユーザーは[「"](.+?)[」"]について整理や確認を求めている$/,
    "$1について、どう整理するかを気にしている",
  );

  text = text.replace(
    /^ユーザーは[「"](.+?)[」"]について整理を求めている$/,
    "$1について、どう整理するかを気にしている",
  );

  text = text.replace(
    /^ユーザーは[「"](.+?)[」"]について確認を求めている$/,
    "$1について、確かめたい気持ちが続いている",
  );

  text = text.replace(
    /^ユーザーは[「"](.+?)[」"]に不安を感じている$/,
    "$1に不安が残っている",
  );

  text = text.replace(
    /^ユーザーは[「"](.+?)[」"]を大切にしている$/,
    "$1を大事にしたい気持ちがある",
  );

  return text;
}

function softenMemoryLineEn(value: string): string {
  let text = normalizeMemoryBody(value);
  if (!text) return "";

  text = text.replace(
    /^The user is asking for organization or confirmation about ["“](.+?)["”]\.?$/i,
    "there is an ongoing need to sort out or confirm $1",
  );

  text = text.replace(
    /^The user is asking for organization about ["“](.+?)["”]\.?$/i,
    "there is an ongoing need to sort out $1",
  );

  text = text.replace(
    /^The user is asking for confirmation about ["“](.+?)["”]\.?$/i,
    "there is an ongoing need to confirm $1",
  );

  text = text.replace(
    /^The user feels anxious about ["“](.+?)["”]\.?$/i,
    "there is still some anxiety around $1",
  );

  return text;
}

function buildMemoryLinesJa(
  memories: Awaited<ReturnType<typeof loadMemoriesForPrompt>>,
  maxCount: number,
): string[] {
  if (!memories.ok) return [];
  return memories.memories
    .slice(0, maxCount)
    .map((memory) => softenMemoryLineJa(memory.body))
    .filter(Boolean);
}

function buildMemoryLinesEn(
  memories: Awaited<ReturnType<typeof loadMemoriesForPrompt>>,
  maxCount: number,
): string[] {
  if (!memories.ok) return [];
  return memories.memories
    .slice(0, maxCount)
    .map((memory) => softenMemoryLineEn(memory.body))
    .filter(Boolean);
}

function buildDbOnlyReply(input: DbOnlyReplyInput): string {
  const currentPhase =
    Number(input.state?.current_phase ?? input.state?.state_level ?? 1) || 1;

  const memoryMaxCount =
    input.plan === "pro" ? 3 : input.plan === "plus" ? 2 : 1;

  if (input.uiLang === "en") {
    const phase = phaseLabelEn(currentPhase);
    const memoryLines = buildMemoryLinesEn(input.memories, memoryMaxCount);
    const parts: string[] = [];

    parts.push(`Right now, your flow looks closest to ${phase}.`);

    if (memoryLines.length > 0) {
      parts.push(
        `What still seems to continue in your recent context is ${memoryLines.join(" / ")}.`,
      );
    }

    parts.push(buildDirectionEn(currentPhase));
    return parts.join("\n\n");
  }

  const phase = phaseLabelJa(currentPhase);
  const memoryLines = buildMemoryLinesJa(input.memories, memoryMaxCount);
  const parts: string[] = [];

  parts.push(`いまの流れは、「${phase}」に近い状態です。`);

  if (memoryLines.length > 0) {
    parts.push(
      `続いて見えているテーマは、${memoryLines.join(" / ")} ことです。`,
    );
  }

  parts.push(buildDirectionJa(currentPhase));
  return parts.join("\n\n");
}

function buildFallbackReply(uiLang: "ja" | "en"): string {
  if (uiLang === "en") {
    return "This DB-only test route could not find enough reusable records yet.";
  }
  return "このDB-onlyテストでは、再利用できる記録がまだ十分に見つかりませんでした。";
}

async function createAuthedClientFromRequest(
  req: Request,
): Promise<
  | { ok: true; supabase: SupabaseClient; accessToken: string }
  | { ok: false; response: Response }
> {
  const accessToken = normalizeAccessToken(getBearerToken(req));

  if (!accessToken) {
    return {
      ok: false,
      response: json(401, { ok: false, error: "auth_required" }),
    };
  }

  let supabase: SupabaseClient;
  try {
    supabase = createAuthedSupabase({ accessToken });
  } catch (e: any) {
    return {
      ok: false,
      response: json(500, {
        ok: false,
        error: "supabase_misconfigured",
        message: String(e?.message ?? e),
      }),
    };
  }

  return {
    ok: true,
    supabase,
    accessToken,
  };
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    let body: any = {};

    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {}

    const userText = clampText(body?.text ?? "", 8000);
    const uiLang = normalizeReplyLang(body?.lang);

    const authedClient = await createAuthedClientFromRequest(req);
    if (!authedClient.ok) {
      return authedClient.response;
    }

    const { supabase, accessToken } = authedClient;

    const au = await getAuthedUserId(supabase, accessToken);
    if (!au.ok) {
      return json(401, {
        ok: false,
        error: au.error,
      });
    }

    const authedUserId = au.userId;
    const clientRequestIdIn = resolveClientRequestIdFromBody(body);
    const requestedConversationId = resolveConversationIdFromBody(body);

    const threadRes = await resolveAuthThread({
      supabase,
      authedUserId,
      uiLang,
      requestedConversationId,
      clientRequestIdIn,
      missingThreadReuseWindowSec: 0,
      debugSave: false,
      enforceThreadOwnership: true,
    });

    if (!threadRes.ok) {
      return json(threadRes.status, threadRes.payload);
    }

    const { resolvedConversationId } = threadRes;

    const [resolvedPlan, latestAssistantState, loadedMemories] =
      await Promise.all([
        resolvePromptBundlePlanFromProfiles({
          supabase,
          userId: authedUserId,
        }),
        loadLatestAssistantStateForConversation({
          supabase,
          conversationId: resolvedConversationId,
        }),
        loadMemoriesForPrompt({
          supabase,
          userId: authedUserId,
          limit: 3,
        }),
      ]);

    const hasReusableState = !!latestAssistantState;
    const hasReusableMemories =
      loadedMemories.ok && loadedMemories.memories.length > 0;

    const reply =
      hasReusableState || hasReusableMemories
        ? buildDbOnlyReply({
            plan: resolvedPlan,
            state: latestAssistantState,
            memories: loadedMemories,
            userText,
            uiLang,
          })
        : buildFallbackReply(uiLang);

    return json(200, {
      ok: true,
      mode: "db_only_test",
      openai_used: false,
      conversation_id: resolvedConversationId,
      resolved_plan: resolvedPlan,
      reply,
      db_snapshot: {
        state: latestAssistantState,
        memory_count: loadedMemories.ok ? loadedMemories.memories.length : 0,
      },
    });
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
- DB-only テスト回答用の別入口
- 本番 chat route を触らずに authenticated ユーザーの DB 再利用力を確認する
- OpenAI を呼ばずに thread / plan / latest state / active memories を読んで最小返答を返す
- 本流の代替ではなく、DB-only 検証専用として使う
*/

/* 【今回このファイルで修正したこと】
- memory の body をそのまま返すのではなく、返答用に少しやわらかく整える処理を追加しました。
- 日本語の「ユーザーは〜について整理や確認を求めている」系の文を、そのまま読まず自然寄りの表現へ変えるようにしました。
- 英語側にも最小限の自然化処理を追加しました。
- memory を本文へ差し込む文言を「継続して見えている要素」から「続いて見えているテーマ」へ寄せました。
*/
// このファイルの正式役割: DB-only テスト回答用の別入口