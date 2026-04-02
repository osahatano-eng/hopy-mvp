import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const body = await req.json();
  const { newMemory, existingMemories } = body;

  if (!newMemory) {
    return NextResponse.json({ isDuplicate: false });
  }

  const prompt = `
あなたは記憶の重複判定AIです。

既存記憶:
${existingMemories.map((m: string) => "- " + m).join("\n")}

新しい記憶:
"${newMemory}"

意味的に重複している場合は true、
重複していなければ false をJSONで返してください。

出力形式:
{ "isDuplicate": true or false }
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "厳密にJSONのみ返してください。" },
      { role: "user", content: prompt },
    ],
  });

  const text = res.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(text);

  return NextResponse.json(parsed);
}
