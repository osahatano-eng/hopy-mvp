import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { recentMessages, memories } = await req.json();

    if (!Array.isArray(memories)) {
      return NextResponse.json({ error: "memories required" }, { status: 400 });
    }

    const prompt = `
あなたは高度な自己分析AIです。

以下はユーザーの最近の会話と既存の記憶です。

【最近の会話】
${recentMessages.map((m: any) => `${m.role}: ${m.content}`).join("\n")}

【既存の記憶】
${memories.map((m: any, i: number) =>
      `${i + 1}. (${m.id}) 重要度:${m.importance} 内容:${m.content}`
    ).join("\n")}

各記憶について、
現在の文脈に基づき重要度(1-5)を再評価してください。

JSON形式で返してください：

{
  "updates": [
    { "id": "...", "importance": 4 },
    { "id": "...", "importance": 2 }
  ]
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices[0].message.content ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "invalid AI response" }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json(parsed);

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
