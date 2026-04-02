// /app/api/chat/_lib/env.ts
export function envOn(name: string) {
  const v = String(process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export function envInt(name: string, fallback: number) {
  const raw = String(process.env[name] ?? "").trim();
  if (!raw) return fallback;

  const v = Number(raw);
  if (!Number.isFinite(v)) return fallback;

  const n = Math.trunc(v);

  // ✅ 0 も有効値として扱う（OFF/無効化に使える）
  // 例: TIMEOUT_MS=0 -> withTimeoutが素通しになる、LIMIT=0 -> 注入を止められる
  return n >= 0 ? n : fallback;
}

export function clampInt(n: number, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}