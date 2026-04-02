// /app/api/chat/_lib/http.ts
export function json(status: number, payload: any) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Phase1 stability: ensure no caching by any layer
      "Cache-Control": "no-store",
    },
  });
}

export function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? "";
}
