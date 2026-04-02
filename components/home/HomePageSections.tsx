// /components/home/HomePageSections.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useLang } from "@/components/site/LangProvider";
import styles from "./HomePageSections.module.css";

export default function HomePageSections() {
  const { uiLang2 } = useLang();
  const isJa = uiLang2 === "ja";
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    function applySignedOut() {
      if (!mounted) return;
      setIsSignedIn(false);
    }

    function applySession(session: any) {
      if (!mounted) return;
      const hasUser = Boolean(session?.user?.email || session?.user?.id);
      setIsSignedIn(hasUser);
    }

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!data?.session) {
          applySignedOut();
          return;
        }

        applySession(data.session);
      } catch {
        applySignedOut();
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        applySignedOut();
        return;
      }
      applySession(session);
    });

    return () => {
      mounted = false;
      try {
        sub?.subscription?.unsubscribe();
      } catch {}
    };
  }, []);

  const ctaHref = isSignedIn ? "/chat" : "/signin";
  const ctaLabel = isJa
    ? isSignedIn
      ? "チャットへ進む"
      : "サインインしてはじめる"
    : isSignedIn
      ? "Go to Chat"
      : "Sign in to get started";

  return (
    <>
      <section aria-labelledby="about-hopy" className={styles.narrowSection}>
        <div className={`${styles.stack16} ${styles.centered}`}>
          <h2 id="about-hopy" className={styles.sectionTitle}>
            {isJa ? "HOPYとは" : "What is HOPY?"}
          </h2>
          <p className={styles.sectionBody}>
            {isJa
              ? "HOPYは、ただ答えを返すためのAIではありません。今の気持ちや考えの流れを受け取り、理解し、気づきを深め、次の方向へつなげるための存在です。"
              : "HOPY is not just an AI that gives answers. It listens to the flow of your thoughts and feelings, helps you understand them, deepen awareness, and move toward your next direction."}
          </p>
        </div>
      </section>

      <section aria-labelledby="what-hopy-can-do" className={styles.section}>
        <div className={styles.stack24}>
          <div className={styles.sectionHeader}>
            <h2 id="what-hopy-can-do" className={styles.sectionTitle}>
              {isJa ? "HOPYができること" : "What HOPY can do"}
            </h2>
          </div>

          <div className={styles.grid3}>
            <article className={styles.card}>
              <h3 className={styles.cardTitle}>
                {isJa
                  ? "今の考えを整理する"
                  : "Organize what you are thinking now"}
              </h3>
              <p className={styles.cardBody}>
                {isJa
                  ? "頭の中で重なっていることを、ひとつずつ言葉にしていきます。"
                  : "It helps turn overlapping thoughts in your mind into words, one by one."}
              </p>
            </article>

            <article className={styles.card}>
              <h3 className={styles.cardTitle}>
                {isJa
                  ? "自分でも気づいていない傾向に気づく"
                  : "Notice patterns you may not see yet"}
              </h3>
              <p className={styles.cardBody}>
                {isJa
                  ? "会話の流れから、続いている迷いや大切にしていることを見つけます。"
                  : "Through conversation, it finds ongoing uncertainty and what truly matters to you."}
              </p>
            </article>

            <article className={styles.card}>
              <h3 className={styles.cardTitle}>
                {isJa
                  ? "次に何をすればいいかを見つける"
                  : "Find what to do next"}
              </h3>
              <p className={styles.cardBody}>
                {isJa
                  ? "受け止めるだけで終わらず、次の一歩までやさしく整えます。"
                  : "It does not stop at understanding. It gently helps shape your next step."}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section aria-labelledby="five-stages" className={styles.section}>
        <div className={styles.stack24}>
          <div className={styles.sectionHeader}>
            <h2 id="five-stages" className={styles.sectionTitle}>
              {isJa
                ? "HOPYは、思考の流れを5つの段階で見つめます"
                : "HOPY sees the flow of thought in five stages"}
            </h2>
          </div>

          <div className={styles.grid5}>
            <article className={styles.card}>
              <div className={styles.stateHead}>
                <span
                  aria-hidden="true"
                  className={`${styles.stateDot} ${styles.phase1}`}
                />
                <h3 className={styles.stateTitle}>
                  {isJa ? "混線" : "Entangled"}
                </h3>
              </div>
              <p className={styles.stateBody}>
                {isJa
                  ? "考えや気持ちが重なっている状態"
                  : "A state where thoughts and feelings overlap"}
              </p>
            </article>

            <article className={styles.card}>
              <div className={styles.stateHead}>
                <span
                  aria-hidden="true"
                  className={`${styles.stateDot} ${styles.phase2}`}
                />
                <h3 className={styles.stateTitle}>
                  {isJa ? "模索" : "Searching"}
                </h3>
              </div>
              <p className={styles.stateBody}>
                {isJa
                  ? "まだ答えを探している状態"
                  : "A state of still searching for an answer"}
              </p>
            </article>

            <article className={styles.card}>
              <div className={styles.stateHead}>
                <span
                  aria-hidden="true"
                  className={`${styles.stateDot} ${styles.phase3}`}
                />
                <h3 className={styles.stateTitle}>
                  {isJa ? "整理" : "Organizing"}
                </h3>
              </div>
              <p className={styles.stateBody}>
                {isJa
                  ? "少しずつ輪郭が見え始めた状態"
                  : "A state where the outline starts to appear"}
              </p>
            </article>

            <article className={styles.card}>
              <div className={styles.stateHead}>
                <span
                  aria-hidden="true"
                  className={`${styles.stateDot} ${styles.phase4}`}
                />
                <h3 className={styles.stateTitle}>
                  {isJa ? "収束" : "Converging"}
                </h3>
              </div>
              <p className={styles.stateBody}>
                {isJa
                  ? "大事なことがまとまり始めた状態"
                  : "A state where important things begin to come together"}
              </p>
            </article>

            <article className={styles.card}>
              <div className={styles.stateHead}>
                <span
                  aria-hidden="true"
                  className={`${styles.stateDot} ${styles.phase5}`}
                />
                <h3 className={styles.stateTitle}>
                  {isJa ? "決定" : "Deciding"}
                </h3>
              </div>
              <p className={styles.stateBody}>
                {isJa
                  ? "次に進む方向が見えてきた状態"
                  : "A state where the next direction becomes visible"}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="compass-meaning"
        className={styles.narrowSection}
      >
        <div className={`${styles.stack16} ${styles.centered}`}>
          <h2 id="compass-meaning" className={styles.sectionTitle}>
            {isJa
              ? "Compassが北を指すように"
              : "Just as a compass points north"}
          </h2>
          <p className={styles.sectionBody}>
            {isJa
              ? "現実のCompassが北を指すように、HOPYは、今のあなたにとっての次の方向を見つけていきます。"
              : "Just as a real compass points north, HOPY helps you find the next direction that matters to you now."}
          </p>
        </div>
      </section>

      <section aria-labelledby="plans" className={styles.section}>
        <div className={styles.stack24}>
          <div className={styles.sectionHeader}>
            <h2 id="plans" className={styles.sectionTitle}>
              {isJa
                ? "あなたに合った深さで、HOPYを"
                : "HOPY at the depth that fits you"}
            </h2>
          </div>

          <div className={styles.grid3}>
            <article className={styles.card}>
              <div className={styles.planCardInner}>
                <div>
                  <h3 className={styles.planTitle}>Free</h3>
                  <p className={styles.planLead}>
                    {isJa
                      ? "はじめてのHOPY体験に"
                      : "For your first HOPY experience"}
                  </p>
                </div>

                <p className={styles.planText}>
                  {isJa
                    ? "今の考えや気持ちの流れを、やさしく言葉にします。"
                    : "Gently puts your current thoughts and feelings into words."}
                </p>

                <div className={styles.planTags}>
                  <span className={styles.planTag}>
                    {isJa ? "【いまの状態】" : "[Current state]"}
                  </span>
                </div>
              </div>
            </article>

            <article className={styles.card}>
              <div className={styles.planCardInner}>
                <div>
                  <h3 className={styles.planTitle}>Plus</h3>
                  <p className={styles.planLead}>
                    {isJa
                      ? "流れを見渡し、意味に気づく"
                      : "See the flow and notice its meaning"}
                  </p>
                </div>

                <p className={styles.planText}>
                  {isJa
                    ? "今の状態に加えて、その意味や背景をより深く受け取れます。"
                    : "Along with your current state, you can receive its meaning and background more deeply."}
                </p>

                <div className={styles.planTags}>
                  <span className={styles.planTag}>
                    {isJa ? "【いまの状態】" : "[Current state]"}
                  </span>
                  <span className={styles.planTag}>
                    {isJa ? "【学問的解釈】" : "[Academic interpretation]"}
                  </span>
                  <span className={styles.planTag}>
                    {isJa ? "【あなたへ】" : "[For you]"}
                  </span>
                </div>
              </div>
            </article>

            <article className={styles.card}>
              <div className={styles.planCardInner}>
                <div>
                  <h3 className={styles.planTitle}>Pro</h3>
                  <p className={styles.planLead}>
                    {isJa
                      ? "より深く、自分を理解する"
                      : "Understand yourself more deeply"}
                  </p>
                </div>

                <p className={styles.planText}>
                  {isJa
                    ? "複数の視点から今の自分を見つめ、次の方向までつなげます。"
                    : "Look at yourself from multiple perspectives and connect that understanding to your next direction."}
                </p>

                <div className={styles.planTags}>
                  <span className={styles.planTag}>
                    {isJa ? "【いまの状態】" : "[Current state]"}
                  </span>
                  <span className={styles.planTag}>
                    {isJa ? "【学問的解釈】" : "[Academic interpretation]"}
                  </span>
                  <span className={styles.planTag}>
                    {isJa ? "【占い的解釈】" : "[Fortune-style interpretation]"}
                  </span>
                  <span className={styles.planTag}>
                    {isJa ? "【あなたへ】" : "[For you]"}
                  </span>
                  <span className={styles.planTag}>
                    {isJa
                      ? "【創業者より、あなたへ】"
                      : "[From the founder, to you]"}
                  </span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section aria-labelledby="final-cta" className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 id="final-cta" className={styles.sectionTitle}>
            {isJa
              ? "迷いの中にも、進むための方向はあります"
              : "Even in uncertainty, there is a direction forward"}
          </h2>
          <p className={styles.sectionBody}>
            {isJa
              ? "HOPYは、その方向を静かに、やさしく、一緒に見つけていきます。"
              : "HOPY quietly and gently helps you find that direction together."}
          </p>
          <a href={ctaHref} className={styles.ctaButton}>
            {ctaLabel}
          </a>
        </div>
      </section>
    </>
  );
}