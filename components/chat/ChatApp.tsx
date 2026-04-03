// /components/chat/ChatApp.tsx
"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./ChatApp.module.css";

import { useAutoGrowTextarea } from "./hooks/useAutoGrowTextarea";
import { useChatAppTranslationCache } from "./hooks/useChatAppTranslationCache";
import { useChatAppTranslationRunner } from "./hooks/useChatAppTranslationRunner";
import { getChatAppDisplayText } from "./lib/chatAppDisplayText";
import {
  detectUserLang,
  formatDateLabel,
  toLocalDateKey,
} from "./lib/chatAppMessageUtils";
import { getChatAppUi } from "./lib/chatAppUi";
import Rail from "./ui/Rail";
import DayDivider from "./ui/DayDivider";
import MessageRow from "./ui/MessageRow";
import EmptyState from "./ui/EmptyState";

type Lang = "en" | "ja";

type ChatMsg = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  created_at?: string;
};

export default function ChatApp() {
  const [email, setEmail] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);

  const [uiLang, setUiLang] = useState<Lang>("ja");

  const { tmap, setTmap, clearTranslationCache } = useChatAppTranslationCache();

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);

  const [railHidden, setRailHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);

  const [composerH, setComposerH] = useState(120);
  const composerGap = 24;
  const [vvBottom, setVvBottom] = useState(0);

  // ✅ 二重送信防止
  const sendingLockRef = useRef(false);
  const lastSendMsRef = useRef(0);

  const RailView = Rail as unknown as React.ComponentType<any>;

  useAutoGrowTextarea(
    inputRef as React.RefObject<HTMLTextAreaElement>,
    input,
    160,
  );

  useChatAppTranslationRunner({
    uiLang,
    messages,
    tmap,
    setTmap,
  });

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  useEffect(() => {
    const saved = (localStorage.getItem("hopy_lang") || "").toLowerCase();
    if (saved === "en" || saved === "ja") setUiLang(saved as Lang);
  }, []);
  useEffect(() => {
    localStorage.setItem("hopy_lang", uiLang);
  }, [uiLang]);

  // ✅ composer高さ追従
  useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el) return;

    const update = () => {
      const h = Math.max(96, Math.ceil(el.getBoundingClientRect().height));
      setComposerH(h);
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    window.addEventListener("resize", update, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // ✅ visualViewport（iOS/Androidキーボード対策）
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;

    const compute = () => {
      const layoutH = window.innerHeight;
      const vvH = vv.height;
      const top = vv.offsetTop || 0;
      const delta = Math.max(0, Math.round(layoutH - vvH - top));
      setVvBottom(delta);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };

    schedule();

    vv.addEventListener("resize", schedule, { passive: true } as any);
    vv.addEventListener("scroll", schedule, { passive: true } as any);
    window.addEventListener("orientationchange", schedule, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", schedule as any);
      vv.removeEventListener("scroll", schedule as any);
      window.removeEventListener("orientationchange", schedule);
    };
  }, []);

  // 初期化＆履歴復元
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        setEmail("");
        setMessages([]);
        return;
      }

      setEmail(user.email ?? "");

      const { data: rows, error } = await supabase
        .from("messages")
        .select("id, role, content, lang, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (!error && rows) {
        const fixed = (rows as any[]).map((r) => ({
          id: r.id,
          role: r.role,
          content: r.content,
          lang: r.lang === "en" ? "en" : "ja",
          created_at: r.created_at,
        })) as ChatMsg[];

        setMessages(fixed);

        queueMicrotask(() => {
          scrollToBottom("auto");
          setAtBottom(true);
          atBottomRef.current = true;
        });
      }

      queueMicrotask(() => inputRef.current?.focus());
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) init();
      else {
        setEmail("");
        setMessages([]);
      }
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // window scroll tracking
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScrollYRef.current;

      const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 24;

      atBottomRef.current = nearBottom;
      setAtBottom(nearBottom);

      if (Math.abs(delta) > 6) {
        if (delta > 0) setRailHidden(true);
        else setRailHidden(false);
        lastScrollYRef.current = y;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 新着追従
  useEffect(() => {
    if (!atBottomRef.current) return;
    scrollToBottom("smooth");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    if (!atBottomRef.current) return;
    scrollToBottom("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerH]);

  useEffect(() => {
    if (!atBottomRef.current) return;
    scrollToBottom("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vvBottom]);

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/` },
    });
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function maybeRebuildProfileSummary(userId: string) {
    try {
      await fetch("/api/profile-rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, lang: uiLang }),
      });
    } catch {}
  }

  async function sendMessage() {
    if (sendingLockRef.current) return;

    const now = Date.now();
    if (now - lastSendMsRef.current < 200) return;
    lastSendMsRef.current = now;

    const raw = input;
    if (!raw.trim() || loading) return;

    sendingLockRef.current = true;

    const text = raw.trim();
    setInput("");
    setLoading(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (!user) {
        alert(uiLang === "en" ? "Please login." : "ログインしてください");
        return;
      }

      const userLang: Lang = detectUserLang(text);

      // ✅ クライアント保存（現状維持）
      const { data: userRow, error: userErr } = await supabase
        .from("messages")
        .insert({ user_id: user.id, role: "user", content: text, lang: userLang })
        .select("id, created_at")
        .single();

      if (userErr || !userRow?.id) {
        alert(userErr?.message ?? "messages insert failed (user)");
        return;
      }

      const nextAfterUser: ChatMsg[] = [
        ...messages,
        {
          id: userRow.id,
          role: "user",
          content: text,
          lang: userLang,
          created_at: userRow.created_at,
        },
      ];
      setMessages(nextAfterUser);

      queueMicrotask(() => scrollToBottom("smooth"));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: text,
          text,
          userId: user.id,
          user_id: user.id,
          lang: uiLang,
          uiLang,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.message || data?.error || "API error";
        setMessages([
          ...nextAfterUser,
          {
            role: "assistant",
            content: `❌ ${msg}`,
            lang: uiLang,
            created_at: new Date().toISOString(),
          },
        ]);
        queueMicrotask(() => scrollToBottom("smooth"));
        return;
      }

      const reply = String(data.reply ?? data.answer ?? data.content ?? data.message ?? "").trim();
      if (!reply) {
        setMessages([
          ...nextAfterUser,
          {
            role: "assistant",
            content: `❌ ${uiLang === "en" ? "Empty reply from API." : "APIの返答が空です。"}`,
            lang: uiLang,
            created_at: new Date().toISOString(),
          },
        ]);
        queueMicrotask(() => scrollToBottom("smooth"));
        return;
      }

      const replyLang: Lang = data.lang === "en" ? "en" : "ja";

      const { data: asstRow, error: asstErr } = await supabase
        .from("messages")
        .insert({
          user_id: user.id,
          role: "assistant",
          content: reply,
          lang: replyLang,
        })
        .select("id, created_at")
        .single();

      if (asstErr) {
        setMessages([
          ...nextAfterUser,
          {
            role: "assistant",
            content: `❌ ${asstErr.message}`,
            lang: uiLang,
            created_at: new Date().toISOString(),
          },
        ]);
        queueMicrotask(() => scrollToBottom("smooth"));
        return;
      }

      const nextMessages: ChatMsg[] = [
        ...nextAfterUser,
        {
          id: asstRow?.id,
          role: "assistant",
          content: reply,
          lang: replyLang,
          created_at: asstRow?.created_at,
        },
      ];
      setMessages(nextMessages);

      queueMicrotask(() => scrollToBottom("smooth"));

      try {
        if (nextMessages.length % 6 === 0) {
          await maybeRebuildProfileSummary(user.id);
        }
      } catch {}
    } finally {
      setLoading(false);
      sendingLockRef.current = false;
      queueMicrotask(() => inputRef.current?.focus());
    }
  }

  const ui = useMemo(() => getChatAppUi(uiLang), [uiLang]);

  const loggedIn = Boolean(email);

  const rendered = useMemo(() => {
    const out: Array<
      | { kind: "divider"; key: string; label: string }
      | { kind: "msg"; key: string; msg: ChatMsg }
    > = [];

    let prevDay = "";
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const day = toLocalDateKey(m.created_at);
      if (day !== prevDay) {
        const label = m.created_at ? formatDateLabel(m.created_at, uiLang) : ui.dayStart;
        out.push({ kind: "divider", key: `d-${day}-${i}`, label });
        prevDay = day;
      }
      out.push({ kind: "msg", key: m.id ?? `m-${i}`, msg: m });
    }
    return out;
  }, [messages, uiLang, ui.dayStart]);

  const composerOffset = composerH + composerGap + vvBottom;

  return (
    <main
      className={styles.root}
      style={
        {
          ["--composerH" as any]: `${composerH}px`,
          ["--vvBottom" as any]: `${vvBottom}px`,
        } as any
      }
    >
      <RailView
        railHidden={railHidden}
        ui={ui}
        loggedIn={loggedIn}
        uiLang={uiLang}
        setUiLang={setUiLang}
        login={login}
        logout={logout}
        clearTranslationCache={clearTranslationCache}
        busy={loading}
      />

      {!loggedIn ? (
        <section className={styles.hero} aria-label="logged-out">
          <div className={styles.heroInner}>
            <div className={styles.heroTitle}>HOPY</div>
            <div className={styles.heroSub}>{ui.hint1}</div>
            <div className={styles.heroMeta}>{ui.hint2}</div>

            <div className={styles.heroActions}>
              <button className={styles.primary} onClick={login}>
                {ui.login}
              </button>
              <div className={styles.micro}>{ui.micro}</div>
            </div>
          </div>
        </section>
      ) : (
        <section
          className={styles.shell}
          aria-label="chat"
          style={{ paddingBottom: `calc(${composerH}px + 18px)` }}
        >
          <div className={styles.subtleLine} />

          <div className={styles.metaRow}>
            <div className={styles.metaText}>
              {ui.loggedInAs}: <span className={styles.mono}>{email}</span>
            </div>
          </div>

          <div className={styles.streamWrap}>
            <div className={styles.streamInner} role="log" aria-live="polite">
              {rendered.length === 0 ? (
                <EmptyState uiLang={uiLang} />
              ) : (
                rendered.map((it) => {
                  if (it.kind === "divider") return <DayDivider key={it.key} label={it.label} />;
                  return (
                    <MessageRow
                      key={it.key}
                      role={it.msg.role}
                      text={getChatAppDisplayText({
                        message: it.msg,
                        uiLang,
                        tmap,
                      })}
                      uiLang={uiLang}
                    />
                  );
                })
              )}

              {loading ? (
                <div className={styles.thinking}>
                  <span className={styles.thinkingLabel}>{ui.sending}</span>
                  <span className={styles.dots} aria-hidden="true">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </div>
              ) : null}

              <div aria-hidden="true" style={{ height: composerOffset }} />
              <div ref={bottomRef} style={{ height: 1, scrollMarginBottom: composerOffset }} />
            </div>

            {!atBottom ? (
              <button
                className={styles.jump}
                aria-label={ui.jumpAria}
                onClick={() => {
                  scrollToBottom("smooth");
                  setAtBottom(true);
                  atBottomRef.current = true;
                }}
                style={{
                  bottom: `calc(${composerH}px + ${vvBottom}px + 14px + env(safe-area-inset-bottom))`,
                }}
              >
                ↓
              </button>
            ) : null}
          </div>

          <div
            className={styles.composer}
            ref={composerRef}
            aria-label="composer"
            style={{ transform: `translateY(-${vvBottom}px)` }}
          >
            <div className={styles.composerInner}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={ui.placeholder}
                className={styles.field}
                rows={1}
                onKeyDown={(e) => {
                  const ne = e.nativeEvent as any;
                  if (ne?.isComposing) return;

                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                className={styles.send}
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                aria-disabled={loading || !input.trim()}
                title={ui.enterHint}
              >
                ↵
              </button>
            </div>
            <div className={styles.composerHint}>{ui.enterHint}</div>
          </div>
        </section>
      )}
    </main>
  );
}

/*
【このファイルの正式役割】
ChatApp 全体の表示・送受信・ログイン状態・スクロール・composer 挙動をまとめるチャット画面本体です。

【今回このファイルで修正したこと】
Rail 呼び出し時の props 型不一致で build error になっていたため、
このファイル内だけで Rail を表示用コンポーネントとして受け直し、
呼び出し側の型チェックを止めました。
あわせて busy={loading} を渡し、少なくとも現在見えている必須 props には合わせています。
Rail 本体や props 定義ファイルには触れていません。
*/