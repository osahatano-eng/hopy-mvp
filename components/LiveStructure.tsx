"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "./LangToggle";

function splitSentences(text: string) {
  const t = text.trim();
  if (!t) return [];
  return t
    .replace(/\r/g, "")
    .split(/[\n。！？.!?]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function extractKeywords(text: string) {
  const t = text.toLowerCase();
  const words = t
    .replace(/[^a-z0-9ぁ-んァ-ン一-龠ー\s]/g, " ")
    .split(/\s+/g)
    .filter(Boolean);

  const filtered = words.filter((w) => w.length >= 3 || /[ぁ-んァ-ン一-龠]/.test(w));

  const freq = new Map<string, number>();
  for (const w of filtered) freq.set(w, (freq.get(w) ?? 0) + 1);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 10);
}

function getOrCreateAnonUserId() {
  if (typeof window === "undefined") return "anon";
  const key = "hopy_demo_user_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `anon_${Math.random().toString(16).slice(2)}_${Date.now()}`;

  window.localStorage.setItem(key, id);
  return id;
}

type SseEvent =
  | { type: "meta"; ok: boolean; lang?: Lang }
  | { type: "delta"; delta: string }
  | { type: "done"; ok: boolean }
  | { type: "error"; ok: boolean; error?: string; message?: string };

function isAbortLike(err: any) {
  const name = String(err?.name ?? "");
  const msg = String(err?.message ?? "");
  return (
    name === "AbortError" ||
    msg.includes("AbortError") ||
    msg.includes("aborted") ||
    msg.includes("signal is aborted")
  );
}

function takeChars(s: string, n: number) {
  const arr = Array.from(s);
  const head = arr.slice(0, n).join("");
  const tail = arr.slice(n).join("");
  return { head, tail };
}

type Mode = "demo" | "chat";

export default function LiveStructure({
  placeholder,
  lang,
  onReply,
  mode = "demo",
}: {
  placeholder: string;
  lang: Lang;
  onReply?: () => void;
  mode?: Mode;
}) {
  const [text, setText] = useState("");
  const [ai, setAi] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Abort制御
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const endpoint = (process.env.NEXT_PUBLIC_CHAT_ENDPOINT as string) || "/api/chat";
  const userId = useMemo(() => getOrCreateAnonUserId(), []);

  // ===== タイプライター =====
  const queueRef = useRef<string[]>([]);
  const pumpTimerRef = useRef<number | null>(null);
  const pumpActiveRef = useRef(false);
  const streamDoneRef = useRef(false);

  const PUMP_INTERVAL_MS = 38;
  const CHARS_PER_TICK = 2;

  function stopPump() {
    if (pumpTimerRef.current) window.clearInterval(pumpTimerRef.current);
    pumpTimerRef.current = null;
    pumpActiveRef.current = false;
  }

  function startPump() {
    if (pumpActiveRef.current) return;
    pumpActiveRef.current = true;

    pumpTimerRef.current = window.setInterval(() => {
      if (queueRef.current.length === 0) {
        if (streamDoneRef.current) stopPump();
        return;
      }

      let cur = queueRef.current[0] ?? "";
      if (!cur) {
        queueRef.current.shift();
        return;
      }

      const { head, tail } = takeChars(cur, CHARS_PER_TICK);
      setAi((prev) => prev + head);

      if (tail) queueRef.current[0] = tail;
      else queueRef.current.shift();
    }, PUMP_INTERVAL_MS);
  }

  function enqueueDelta(delta: string) {
    if (!delta) return;
    queueRef.current.push(delta);
    startPump();
  }

  async function waitDrain(ac: AbortController) {
    while (!ac.signal.aborted) {
      if (queueRef.current.length === 0) return;
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  // ===== THINKING カーソル =====
  const [cursorOn, setCursorOn] = useState(false);
  const cursorTimerRef = useRef<number | null>(null);

  function stopCursor() {
    if (cursorTimerRef.current) window.clearInterval(cursorTimerRef.current);
    cursorTimerRef.current = null;
    setCursorOn(false);
  }

  function startCursor() {
    if (cursorTimerRef.current) return;
    setCursorOn(true);
    cursorTimerRef.current = window.setInterval(() => {
      setCursorOn((v) => !v);
    }, 520);
  }

  useEffect(() => {
    if (loading) startCursor();
    else stopCursor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const joined = useMemo(() => {
    const a = (text ?? "").trim();
    const b = (ai ?? "").trim();
    return [a, b].filter(Boolean).join("\n");
  }, [text, ai]);

  const points = useMemo(() => splitSentences(joined), [joined]);
  const keywords = useMemo(() => extractKeywords(joined), [joined]);

  const title = lang === "ja" ? "構造化プレビュー" : "Structured Preview";
  const a = lang === "ja" ? "要点" : "Key points";
  const b = lang === "ja" ? "キーワード" : "Keywords";
  const c = lang === "ja" ? "保存イメージ" : "Memory shape";

  async function callJson(input: string, ac: AbortController) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input,
        userId,
        lang,
        uiLang: lang,
        stream: false,
      }),
      signal: ac.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.message || data?.error || `http_${res.status}`;
      throw new Error(String(msg));
    }

    const reply =
      typeof data?.reply === "string"
        ? data.reply
        : typeof data?.text === "string"
        ? data.text
        : typeof data?.content === "string"
        ? data.content
        : "";

    if (!reply) throw new Error("empty_reply");

    enqueueDelta(reply);
    streamDoneRef.current = true;
    startPump();
    await waitDrain(ac);

    // ✅ 返答が確定したタイミングでカウント
    onReply?.();
  }

  async function streamSse(input: string, ac: AbortController) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        text: input,
        userId,
        lang,
        uiLang: lang,
        stream: true,
      }),
      signal: ac.signal,
    });

    const ct = (res.headers.get("content-type") || "").toLowerCase();

    if (!ct.includes("text/event-stream")) {
      if (!res.ok) {
        const maybe = await res.text().catch(() => "");
        throw new Error(`not_sse_http_${res.status}: ${maybe.slice(0, 200)}`);
      }
      await callJson(input, ac);
      return;
    }

    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      throw new Error(`sse_http_${res.status}: ${t.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    let replied = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;

        let evt: SseEvent | null = null;
        try {
          evt = JSON.parse(line.slice(6));
        } catch {
          evt = null;
        }
        if (!evt) continue;

        if (evt.type === "delta") {
          enqueueDelta((evt as any).delta);
        } else if (evt.type === "error") {
          const msg = (evt as any).message || (evt as any).error || "error";
          throw new Error(msg);
        } else if (evt.type === "done") {
          streamDoneRef.current = true;
          startPump();
          await waitDrain(ac);

          if (!replied) {
            replied = true;
            onReply?.();
          }
          return;
        }
      }
    }

    streamDoneRef.current = true;
    startPump();
    await waitDrain(ac);

    onReply?.();
  }

  async function run(input: string) {
    const myRunId = ++runIdRef.current;

    try {
      abortRef.current?.abort();
    } catch {
      // noop
    }

    const ac = new AbortController();
    abortRef.current = ac;

    queueRef.current = [];
    streamDoneRef.current = false;
    stopPump();

    setLoading(true);
    setAi("");

    try {
      await streamSse(input, ac);
    } catch (e: any) {
      if (isAbortLike(e)) return;

      try {
        await callJson(input, ac);
      } catch (e2: any) {
        if (isAbortLike(e2)) return;
        if (myRunId !== runIdRef.current) return;

        const msg = String(e2?.message || e?.message || "unknown_error");
        setAi(lang === "ja" ? `（AI呼び出し失敗: ${msg}）` : `(AI call failed: ${msg})`);
      }
    } finally {
      if (myRunId === runIdRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    const input = text.trim();

    if (input.length < 12) {
      try {
        abortRef.current?.abort();
      } catch {
        // noop
      }
      abortRef.current = null;

      queueRef.current = [];
      streamDoneRef.current = true;
      stopPump();

      setAi("");
      setLoading(false);

      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      run(input);
    }, 520);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, lang, endpoint]);

  useEffect(() => {
    return () => {
      try {
        abortRef.current?.abort();
      } catch {
        // noop
      }
      stopPump();
      stopCursor();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">{title}</div>
        <div className="card-chip" aria-hidden>
          {loading ? "THINKING" : "LIVE"}
        </div>
      </div>

      <textarea
        className="card-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={6}
      />

      <div className="ai-preview" aria-live="polite">
        <div className="ai-label">AI</div>

        <div className="ai-text">
          {ai ? ai : ""}

          {loading ? (
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: "0.9em",
                marginLeft: "0.15em",
                opacity: cursorOn ? 0.95 : 0.1,
                transform: "translateY(-0.02em)",
              }}
            >
              ●
            </span>
          ) : null}

          {!ai && !loading ? (
            <span style={{ opacity: 0.78 }}>
              {lang === "ja"
                ? "（一定以上の入力で、AIが静かに応答します）"
                : "(With enough input, AI responds quietly.)"}
            </span>
          ) : null}
        </div>
      </div>

      {/* ✅ ログイン後用 mode="chat" では、ここから下を出さない */}
      {mode === "demo" ? (
        <div className="card-grid">
          <div className="card-box">
            <div className="box-title">{a}</div>
            <ul className="box-list">
              {(points.length
                ? points
                : [lang === "ja" ? "ここに要点が生成されます" : "Key points appear here"]
              ).map((s, i) => (
                <li key={i} className="box-item">
                  <span className="dot" aria-hidden />
                  <span className="box-text">{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-box">
            <div className="box-title">{b}</div>
            <div className="pill-row">
              {(keywords.length ? keywords : [lang === "ja" ? "キーワード" : "keywords"]).map(
                (k, i) => (
                  <span key={i} className="pill">
                    {k}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="card-box card-box-wide">
            <div className="box-title">{c}</div>
            <div className="memory-shape" aria-hidden>
              <div className="node n1" />
              <div className="node n2" />
              <div className="node n3" />
              <div className="node n4" />
              <div className="node n5" />
              <div className="edge e1" />
              <div className="edge e2" />
              <div className="edge e3" />
              <div className="edge e4" />
            </div>
            <p className="memory-note">
              {lang === "ja" ? "文章は消えても、構造は残る。" : "Text fades. Structure remains."}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
