// /app/api/chat/_lib/infra/text.ts
import type { Lang } from "../router/simpleRouter";

export function clampText(input: any, max = 8000) {
  const t = String(input ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) : t;
}

export function normalizeLang(x: any): Lang {
  const s = String(x ?? "").toLowerCase().trim();
  return s === "en" ? "en" : "ja";
}

export function errorText(e: any): string {
  return String(e?.message ?? e ?? "").trim();
}

export function extractFirstJsonObject(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b > a) return s.slice(a, b + 1).trim();
  return "";
}