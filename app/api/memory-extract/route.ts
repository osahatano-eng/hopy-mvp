import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function jsonError(status: number, error: string, message?: string) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return jsonError(500, "missing_OPENAI_API_KEY", "OPENAI_API_KEY がありません");
  }

  const body = await req.json().catch(() => null);
  if (!body) return jsonError(400, "bad_request");

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) return NextResponse.json({ ok: true, memories: [] });

  const system = `
あなたは「自己分析型・記憶する伴走AI」の記憶抽出器です。
会話ログから“長期的に有用な記憶”だけを抽出してください。

出力は必ず JSON のみ:
{
  "memories": [
    { "content": "覚える内容（短い1文）", "importance": 1〜5 }
  ]
}

ルール:
- 住所/電話/クレカなどの個人情報は保存しない
- その場限りの雑談は保存しない
- 好み/目標/価値観/制約/習慣/継続プロジェクト/重要な前提だけ
- content は短く、主語を省略せず、曖昧にしない
- importance は 1(低)〜5(高)
`;

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system.trim() },
        { role: "user", content: JSON.stringify({ messages }) },
      ],
    });

    const text = res.choices?.[0]?.message?.content ?? "{}";

    let obj: any = {};
    try {
      obj = JSON.parse(text);
    } catch {
      obj = { memories: [] };
    }

    const memories = Array.isArray(obj.memories) ? obj.memories : [];
    return NextResponse.json({ ok: true, memories });
  } catch (e: any) {
    return jsonError(500, "openai_error", e?.message ?? "unknown");
  }
}
