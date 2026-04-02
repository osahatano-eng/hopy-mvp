// /app/api/chat/_lib/infra/env.ts
export function envOn(name: string) {
  const v = String(process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export function envInt(name: string, fallback: number) {
  const raw = String(process.env[name] ?? "").trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}