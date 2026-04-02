// /components/chat/ui/leftRailStorage.ts
export function safeRemove(keys: string[]) {
  try {
    for (const k of keys) {
      try {
        window.localStorage.removeItem(k);
      } catch {}
      try {
        window.sessionStorage.removeItem(k);
      } catch {}
    }
  } catch {}
}

export function readRailOpen(): boolean {
  try {
    const v = window.localStorage.getItem("hopy_rail_open");
    return String(v ?? "") === "1";
  } catch {
    return false;
  }
}

export function writeRailOpen(open: boolean) {
  try {
    window.localStorage.setItem("hopy_rail_open", open ? "1" : "0");
  } catch {}
}

export function dispatchSafe(name: string, detail: any) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {}
}

export function safeUUID(): string {
  try {
    const g: any = globalThis as any;
    if (g?.crypto && typeof g.crypto.randomUUID === "function") {
      return g.crypto.randomUUID();
    }
  } catch {}
  try {
    return `cr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  } catch {
    return `cr_${Date.now()}`;
  }
}

export function isThenable(x: any): x is PromiseLike<any> {
  try {
    return !!x && (typeof x === "object" || typeof x === "function") && typeof (x as any).then === "function";
  } catch {
    return false;
  }
}

export function parseTimeMs(x: any): number | null {
  try {
    const s = String(x ?? "").trim();
    if (!s) return null;
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}