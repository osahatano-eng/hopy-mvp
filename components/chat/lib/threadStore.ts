// /components/chat/lib/threadStore.ts

const KEY = "hopy_active_thread";

// 同一タブ通知用（storage は同一タブでは発火しないため）
const EVT = "hopy:active-thread-changed";

/**
 * ✅ 壊れないための方針
 * - key を 1箇所に固定（typo事故防止）
 * - 空文字は常に null 扱い
 * - 例外は握りつぶす（UIを止めない）
 * - 同一タブ/別タブの整合性を threadStore に寄せる（唯一の真実）
 */
function normalize(v: any): string | null {
  try {
    if (v == null) return null;
    const s = String(v).trim();
    return s.length > 0 ? s : null;
  } catch {
    return null;
  }
}

function safeDispatch(next: string | null, reason: "save" | "clear") {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(EVT, {
        detail: {
          next,
          reason,
          at: Date.now(), // ✅ 購読側デデュープ用
        },
      })
    );
  } catch {
    // noop
  }
}

function readLS(): string | null {
  try {
    return normalize(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function readSS(): string | null {
  try {
    return normalize(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function writeLS(v: string) {
  try {
    localStorage.setItem(KEY, v);
  } catch {}
}

function writeSS(v: string) {
  try {
    sessionStorage.setItem(KEY, v);
  } catch {}
}

function removeLS() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

function removeSS() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

export function loadActiveThreadId(): string | null {
  // ✅ sessionStorage 優先（タブ固有の現在値を最優先）
  //    localStorage は別タブ共有のため、無い時だけ復旧導線として使う
  const a = readSS();
  if (a) return a;
  const b = readLS();
  return b || null;
}

export function saveActiveThreadId(id: string | null | undefined) {
  try {
    const v = normalize(id);

    // prev の取得は try 分離（環境差で読みが落ちても壊さない）
    let prev: string | null = null;
    try {
      prev = loadActiveThreadId();
    } catch {
      prev = null;
    }

    // clear
    if (!v) {
      if (prev == null) return;

      // ✅ 両方消す（ゴミ残りで復元がブレない）
      removeLS();
      removeSS();

      safeDispatch(null, "clear");
      return;
    }

    // same -> noop
    if (prev === v) return;

    // ✅ 両方へ best-effort で書く（互換/復旧を強くする）
    writeLS(v);
    writeSS(v);

    safeDispatch(v, "save");
  } catch {
    // noop
  }
}

export function clearActiveThreadId() {
  try {
    const prev = loadActiveThreadId();
    if (prev == null) return;

    // ✅ 両方消す（ゴミ残りで復元がブレない）
    removeLS();
    removeSS();

    safeDispatch(null, "clear");
  } catch {
    // noop
  }
}

/**
 * ✅ マルチタブ整合性：activeThreadId の変更を購読する
 * - 別タブ: storage event（localStorage）
 * - 同一タブ: CustomEvent（save/clear 内から発火）
 *
 * 追加の安全策:
 * - 同じ値の連続通知を抑止（多重発火を減らす）
 * - 同一タブ CustomEvent は at を使って短時間連射を抑止
 *
 * ✅ 重要:
 * - 初回は「値がある時だけ」通知（null 初期での無駄通知を避ける）
 *   ※ HOPY方針「未選択ゼロ」に合わせて、この挙動は維持（必要なら将来ここを変更）
 */
export function subscribeActiveThreadId(onChange: (next: string | null) => void): () => void {
  // ✅ SSR/Edge 等で誤って呼ばれても安全に no-op
  if (typeof window === "undefined") {
    return () => {};
  }

  let last: string | null = null;
  let inited = false;

  // 同一タブ通知の短時間デデュープ
  // ✅ “時刻だけ”で落とすと next が変わる正しい通知まで落ちるため、
  //    (next + reason) を含むキーでデデュープする
  let lastEvtAt = 0;
  let lastEvtKey = "";
  const EVT_DEDUPE_MS = 650;

  const emitIfChanged = (raw: any) => {
    const next = normalize(raw);

    // ✅ 初回は “値がある時だけ” 通知（null 初期の無駄発火を減らす）
    if (!inited) {
      inited = true;
      last = next;
      if (next == null) return;
      try {
        onChange(next);
      } catch {}
      return;
    }

    if (next === last) return;
    last = next;

    try {
      onChange(next);
    } catch {
      // noop
    }
  };

  const onStorage = (e: StorageEvent) => {
    try {
      if (!e) return;
      // ✅ 環境によって storageArea が null/undefined のことがあるため、主条件は key に寄せる
      if (e.key !== KEY) return;

      // ✅ 重要：storage event の newValue は信用しすぎない（ブラウザ差・順序差）
      // - 現在タブでは sessionStorage を優先し、
      //   無い時だけ localStorage を復旧導線として使う
      emitIfChanged(loadActiveThreadId());
    } catch {
      // noop
    }
  };

  const onEvent = (e: any) => {
    try {
      const d = e?.detail ?? {};
      const at = Number(d?.at ?? 0) || 0;
      const reason = String(d?.reason ?? "").trim();
      const next = normalize(d?.next);

      // ✅ next が無い（null）でも emitIfChanged は扱える
      const key = `${String(next ?? "")}|${reason}`;

      // ✅ 同一タブでの連射を抑止（ただし “同じnext+reason” のみ）
      const now = Date.now();
      const base = at > 0 ? at : now;

      if (
        base > 0 &&
        base - lastEvtAt >= 0 &&
        base - lastEvtAt <= EVT_DEDUPE_MS &&
        key &&
        key === lastEvtKey
      ) {
        return;
      }

      lastEvtAt = base;
      lastEvtKey = key;

      emitIfChanged(next);
    } catch {
      // noop
    }
  };

  // 初期値を整合させる（ただし null は通知しない）
  try {
    emitIfChanged(loadActiveThreadId());
  } catch {
    // noop
  }

  try {
    window.addEventListener("storage", onStorage);
  } catch {
    // noop
  }

  try {
    window.addEventListener(EVT, onEvent as any);
  } catch {
    // noop
  }

  return () => {
    try {
      window.removeEventListener("storage", onStorage);
    } catch {
      // noop
    }
    try {
      window.removeEventListener(EVT, onEvent as any);
    } catch {
      // noop
    }
  };
}

/**
 * ✅ 観測用（開発時のみ使う想定）
 * - 他レイヤーから直接 localStorage を触らない
 */
export function getActiveThreadStorageKey() {
  return KEY;
}