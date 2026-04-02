import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function jsonError(status: number, error: string, message?: string) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

type Lang = "en" | "ja";
function normalizeLang(x: any): Lang {
  const v = String(x ?? "").toLowerCase();
  return v === "en" ? "en" : "ja";
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY)
    return jsonError(500, "missing_OPENAI_API_KEY");

  const body = await req.json().catch(() => null);
  if (!body) return jsonError(400, "bad_request");

  const targetLang: Lang = normalizeLang(body.targetLang);
  const texts: string[] = Array.isArray(body.texts) ? body.texts : [];

  const batch = texts
    .map((s) => String(s ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 20);

  if (batch.length === 0) {
    return NextResponse.json({ ok: true, translations: [] });
  }

  const rule =
    targetLang === "ja"
      ? "Translate into natural Japanese. Keep code/proper nouns unchanged."
      : "Translate into natural English. Keep code/proper nouns unchanged.";

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            `${rule}\nReturn ONLY a JSON array of translated strings in the same order. No extra text.`.trim(),
        },
        {
          role: "user",
          content: JSON.stringify(batch),
        },
      ],
    });

    const raw = String(res.choices?.[0]?.message?.content ?? "").trim();

    // JSON配列を安全にパース
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // フォールバック：雑に配列っぽい部分を拾う（最終保険）
      return jsonError(500, "translate_parse_failed", raw.slice(0, 200));
    }

    if (!Array.isArray(parsed)) {
      return jsonError(500, "translate_bad_format", "not an array");
    }

    const translations = parsed.map((x) => String(x ?? "").trim());

    // 長さがズレたら保険：原文を返す（表示崩壊を防ぐ）
    if (translations.length !== batch.length) {
      return NextResponse.json({ ok: true, translations: batch });
    }

    return NextResponse.json({ ok: true, translations });
  } catch (e: any) {
    return jsonError(500, "openai_error", e?.message ?? "unknown");
  }
}
