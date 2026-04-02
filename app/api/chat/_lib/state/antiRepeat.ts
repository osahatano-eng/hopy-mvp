// /app/api/chat/_lib/state/antiRepeat.ts
export function headPhrase(s: string): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  const firstLine = t.split("\n")[0] ?? "";
  const cut = firstLine.trim().slice(0, 20);
  return cut;
}

export function buildAvoidList(outputs: string[]): string[] {
  const list: string[] = [];
  for (const o of outputs) {
    const h = headPhrase(o);
    if (h && !list.includes(h)) list.push(h);
  }
  return list.slice(0, 10);
}
