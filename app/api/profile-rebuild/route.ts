import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function jsonError(status: number, error: string, message?: string) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

function cleanSummary(s: string) {
  return String(s || "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, 4000);
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY)
    return jsonError(500, "missing_OPENAI_API_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return jsonError(500, "missing_SUPABASE_SERVICE_ROLE_KEY");

  const body = await req.json().catch(() => null);
  if (!body) return jsonError(400, "bad_request");

  const userId = String(body.userId ?? "").trim();
  const lang = (String(body.lang ?? "ja").trim() as "ja" | "en") || "ja";
  if (!userId) return jsonError(400, "missing_userId");

  // 直近の messages（トーン/目的の把握用）
  const { data: recentMsgs } = await supabase
    .from("messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  // 重要 memories（核となる長期記憶）
  const { data: mems } = await supabase
    .from("memories")
    .select("content, importance, created_at")
    .eq("user_id", userId)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  const memoryLines =
    mems && mems.length
      ? mems
          .map((m: any) => `- (${m.importance}) ${String(m.content ?? "").trim()}`)
          .join("\n")
      : "";

  const convoLines =
    recentMsgs && recentMsgs.length
      ? recentMsgs
          .slice()
          .reverse()
          .map((m: any) => `${m.role === "user" ? "U" : "A"}: ${String(m.content ?? "").trim()}`)
          .join("\n")
      : "";

  // memories が空なら summary も空でOK（ただしprofiles行は作る）
  const system =
    lang === "en"
      ? `You are a product-grade "user profile summarizer" for an AI app.
Create a concise, factual, non-sensitive user profile summary for personalization.
Rules:
- Output MUST be English.
- Do NOT include private secrets, exact addresses, or anything risky.
- Prefer stable traits: preferences, goals, tone, constraints, ongoing projects.
- If uncertain, state it softly.
Return only the summary text.`
      : `あなたはAIアプリの「ユーザープロフィール要約エンジン」です。
パーソナライズ用に、事実ベースで簡潔な要約を作ってください。
ルール：
- 出力は必ず日本語。
- 住所などの危険な個人情報や秘密は書かない。
- 安定的な情報（好み、目標、口調、制約、継続プロジェクト）を優先。
- 不確かなものは断定しない。
要約本文だけ返す。`;

  const userPrompt =
    lang === "en"
      ? `MEMORIES (high-signal):
${memoryLines || "(none)"}

RECENT CONVERSATION (for tone/context):
${convoLines || "(none)"}

Write the best possible profile summary.`
      : `MEMORIES（重要）:
${memoryLines || "（なし）"}

直近会話（トーン/状況）:
${convoLines || "（なし）"}

この情報をもとに、プロフィール要約を作成してください。`;

  let summary = "";
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
    });

    summary = cleanSummary(res.choices?.[0]?.message?.content ?? "");
  } catch (e: any) {
    return jsonError(500, "openai_error", e?.message ?? "unknown");
  }

  // upsert profiles
  const { error: upErr } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      summary,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (upErr) return jsonError(500, "profiles_upsert_failed", upErr.message);

  return NextResponse.json({ ok: true, summary });
}
