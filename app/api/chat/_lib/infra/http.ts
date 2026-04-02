// /app/api/chat/_lib/infra/http.ts
export function json(status: number, payload: any) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function getBearerToken(req: Request): string {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  let s = String(h ?? "").trim();
  if (!s) return "";

  // まずは Bearer 形式を抜く（通常ケース）
  const m = s.match(/^Bearer\s+(.+)$/i);
  s = (m?.[1] ?? s).trim();

  // "Bearer Bearer xxx" のような二重/混入ケースでも必ず剥がす（最大2回で十分）
  for (let i = 0; i < 2; i++) {
    const mm = s.match(/^Bearer\s+(.+)$/i);
    if (!mm?.[1]) break;
    s = String(mm[1]).trim();
  }

  return s;
}