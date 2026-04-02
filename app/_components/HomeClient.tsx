// /app/_components/HomeClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "../page.module.css";

import { useLang } from "@/components/site/LangProvider";
import SiteFooter from "@/components/site/SiteFooter";
import TopHeader from "@/components/site/TopHeader";

type DemoItem = {
  title: string;
  user: string;
  hopy: string;
};

export default function HomeClient() {
  const { uiLang2 } = useLang();
  const router = useRouter();

  const copy = useMemo(() => {
    const ja = uiLang2 === "ja";

    return {
      openChat: ja ? "HOPYをはじめる" : "Start HOPY",
      explore: ja ? "HOPYについて見る" : "Explore HOPY",
      viewSafety: ja ? "安心して使うために" : "Why it feels safe",

      heroEyebrow: "HOPY",
      heroTitle: ja ? "会話だけで終わらない。あなたの状態が見えてくる。" : "More than conversation. See your state more clearly.",
      heroSub: ja
        ? "HOPYは、考えを整理する対話に加えて、そのときの自分の状態を色で見つめられる場所です。落ち込み、迷い、整理、前進の流れをひと目でつかみながら、自分の変化を静かに確認できます。"
        : "HOPY is a space where conversation helps you think clearly, while color helps you see your current state. It lets you notice whether you are overwhelmed, searching, organizing, or moving forward—and quietly recognize your own changes over time.",

      chipA: ja ? "状態を色で見える化" : "State shown in color",
      chipB: ja ? "振り返りまでつながる" : "Built for reflection",
      chipC: ja ? "Googleで安全にログイン" : "Safe Google sign-in",
      chipsAria: ja ? "HOPYの特徴" : "What makes HOPY different",

      heroDemoTitle: ja ? "HOPYとの対話イメージ" : "A glimpse of talking with HOPY",

      demoCard1Title: ja ? "疲れたとき" : "When you're tired",
      demoCard1User: ja ? "今日は疲れたなぁ" : "I'm really tired today.",
      demoCard1Hopy: ja
        ? "それだけ頑張ってきたということですね。今日は、ひとつだけ軽くできそうなことからで大丈夫です。"
        : "That also means you've been carrying a lot. Today, it's enough to start with just one light thing.",

      demoCard2Title: ja ? "やることが多いとき" : "When too much is on your plate",
      demoCard2User: ja ? "やることが多すぎて、何から手をつければいいかわからない" : "I have too much to do and don't know where to start.",
      demoCard2Hopy: ja
        ? "全部を一度に持たなくて大丈夫です。まずは、今日やらないと困るものだけ分けてみましょうか。"
        : "You don't have to hold everything at once. Let's separate only the things that truly need today first.",

      demoCard3Title: ja ? "気持ちが落ちるとき" : "When your mood drops",
      demoCard3User: ja ? "なんか気持ちが落ちる" : "I don't know, I just feel low.",
      demoCard3Hopy: ja
        ? "理由を急いで決めなくても大丈夫です。いま感じていることを、そのまま少しずつ置いていきましょう。"
        : "You don't need to decide the reason right away. We can place what you're feeling here, little by little, as it is.",

      youLabel: ja ? "YOU" : "YOU",
      hopyLabel: "HOPY",

      introTitle: ja ? "HOPYとは" : "What is HOPY",
      introBody: ja
        ? "HOPYは、ただ話して終わるための場所ではありません。会話を通して考えを整理しながら、自分が今どんな状態にいるのかを見つめ、変化を少しずつ確認していくためのサービスです。"
        : "HOPY is not just a place to talk and leave. It is designed to help you think more clearly through conversation, notice the state you are in, and gradually see how that state changes over time.",

      introCard1Title: ja ? "状態を色で見つめられる" : "See your state in color",
      introCard1Body: ja
        ? "会話の内容だけでなく、そのときの自分の状態を色で把握できます。感覚だけで終わらず、見える形で受け止められます。"
        : "Beyond the conversation itself, HOPY helps you recognize your current state through color. It turns vague feelings into something you can notice more clearly.",

      introCard2Title: ja ? "タイトルごとに変化がわかる" : "Track change by conversation title",
      introCard2Body: ja
        ? "ログイン後は、各タイトルごとに状態の色がつきます。どのテーマで整理できているのか、どこで迷いが続いているのかを見返しやすくなります。"
        : "After signing in, each conversation title carries its own color state. This makes it easier to look back and notice where you are gaining clarity and where you may still be stuck.",

      introCard3Title: ja ? "会話の先に振り返りがある" : "Reflection goes beyond the chat",
      introCard3Body: ja
        ? "その場の対話だけでなく、あとから自分の流れを見返せることを大切にしています。考えの整理が、変化の確認につながっていきます。"
        : "HOPY values what happens after the conversation too. Organizing your thoughts can lead to reflection, and reflection can help you recognize your progress.",

      founderTitle: ja ? "開発者の想い" : "Why HOPY exists",
      founderBody: ja
        ? "みんなの役に立ちたい。成功のきっかけをつかんでほしい。恩返しがしたい。HOPYは、その想いを土台に、会話のやさしさだけでなく、変化を見える形で支えられる存在を目指して育てています。"
        : "HOPY is built on a simple intention: to help people, give them a chance to move toward success, and give something meaningful back—not only through kind conversation, but by making change easier to see.",

      sceneTitle: ja ? "HOPYならではの価値" : "What makes HOPY different",
      sceneBody: ja
        ? "対話の心地よさだけではなく、自分の状態や流れを見返せることがHOPYの大きな特徴です。"
        : "What makes HOPY distinct is not only the calm conversation, but the ability to look back and understand your own state and momentum.",

      sceneCard1Title: ja ? "いまの自分を把握しやすい" : "Easier to understand where you are",
      sceneCard1Body: ja
        ? "話しているうちに、自分が混線しているのか、整理できてきたのかを見失いにくくなります。"
        : "As you talk, it becomes easier to notice whether you are tangled, searching, organizing, or starting to move forward.",

      sceneCard2Title: ja ? "1週間・1か月で振り返れる" : "Reflect across weeks and months",
      sceneCard2Body: ja
        ? "今後は、1週間・1か月単位で状態をまとめて振り返れる形へ広げていきます。短い変化も、長い流れも見えるようにしていきます。"
        : "HOPY is planned to grow into a place where you can reflect on your state across a week or a month—so both short shifts and longer patterns become easier to see.",

      sceneCard3Title: ja ? "グラフやチャートで見えてくる" : "Made clearer with charts",
      sceneCard3Body: ja
        ? "今後のダッシュボードでは、状態の流れをグラフやチャートで確認できるようにしていく予定です。感覚だけでなく、視覚でも変化を受け取れます。"
        : "Future dashboard features are planned to show your state through graphs and charts, so change can be recognized visually—not only felt internally.",

      safetyTitle: ja ? "安心して使うために" : "Why it feels safe",
      safetyBody: ja
        ? "HOPYは、はじめやすさと安心感の両方を大切にしています。Googleアカウントでシンプルにログインでき、落ち着いて使い始められる設計を目指しています。"
        : "HOPY is designed to feel both easy to start and safe to use. With simple Google sign-in, it aims to make beginning feel smooth, familiar, and reassuring.",

      safetyCard1Title: ja ? "Googleでかんたんに始められる" : "Easy to start with Google",
      safetyCard1Body: ja
        ? "新しく複雑な登録をしなくても、Googleアカウントでスムーズに使い始められます。"
        : "You can begin smoothly with your Google account, without needing a complicated new signup flow.",

      safetyCard2Title: ja ? "ログイン後は振り返りやすい" : "More useful after sign-in",
      safetyCard2Body: ja
        ? "ログイン後は、タイトルごとの色表示を通して、自分の状態の流れを見返しやすくなります。"
        : "After signing in, color indicators on each conversation title make it easier to look back on how your state has been shifting.",

      safetyCard3Title: ja ? "自分のペースで向き合える" : "Move at your own pace",
      safetyCard3Body: ja
        ? "急がされることなく、必要なときに必要なだけ使える。そうした静かな使いやすさを大切にしています。"
        : "HOPY is meant to be there when you need it, for as much as you need—without pressure, noise, or urgency.",

      finalTitle: ja ? "話すだけではなく、変化まで見つめたい人へ。" : "For people who want to see more than just a conversation.",
      finalBody: ja
        ? "HOPYは、考えを整理したいときにも、自分の状態の流れを見つめたいときにも使える場所です。これから先は、ダッシュボードや週・月ごとのまとめを通して、あなた自身の変化がもっと見えやすくなっていきます。"
        : "HOPY is a place for both organizing your thoughts and noticing the flow of your own state. Over time, planned dashboard features and weekly or monthly summaries are meant to make those changes even easier to understand.",
    };
  }, [uiLang2]);

  const demos = useMemo<DemoItem[]>(
    () => [
      {
        title: copy.demoCard1Title,
        user: copy.demoCard1User,
        hopy: copy.demoCard1Hopy,
      },
      {
        title: copy.demoCard2Title,
        user: copy.demoCard2User,
        hopy: copy.demoCard2Hopy,
      },
      {
        title: copy.demoCard3Title,
        user: copy.demoCard3User,
        hopy: copy.demoCard3Hopy,
      },
    ],
    [
      copy.demoCard1Hopy,
      copy.demoCard1Title,
      copy.demoCard1User,
      copy.demoCard2Hopy,
      copy.demoCard2Title,
      copy.demoCard2User,
      copy.demoCard3Hopy,
      copy.demoCard3Title,
      copy.demoCard3User,
    ],
  );

  const [demoIndex, setDemoIndex] = useState(0);
  const [typedUser, setTypedUser] = useState("");
  const [typedHopy, setTypedHopy] = useState("");
  const [showHopy, setShowHopy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const current = demos[demoIndex];
    const userChars = Array.from(current.user);
    const hopyChars = Array.from(current.hopy);

    setTypedUser("");
    setTypedHopy("");
    setShowHopy(false);

    const run = async () => {
      for (let i = 0; i < userChars.length; i += 1) {
        if (cancelled) return;
        await new Promise((resolve) => window.setTimeout(resolve, 42));
        if (cancelled) return;
        setTypedUser(userChars.slice(0, i + 1).join(""));
      }

      await new Promise((resolve) => window.setTimeout(resolve, 340));
      if (cancelled) return;

      setShowHopy(true);

      for (let i = 0; i < hopyChars.length; i += 1) {
        if (cancelled) return;
        await new Promise((resolve) => window.setTimeout(resolve, 24));
        if (cancelled) return;
        setTypedHopy(hopyChars.slice(0, i + 1).join(""));
      }

      await new Promise((resolve) => window.setTimeout(resolve, 2200));
      if (cancelled) return;

      setDemoIndex((prev) => (prev + 1) % demos.length);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [demoIndex, demos]);

  const goToChat = (e?: React.MouseEvent) => {
    e?.preventDefault();

    try {
      window.location.assign("/chat");
      return;
    } catch {}

    try {
      router.push("/chat");
      return;
    } catch {}
  };

  const activeDemo = demos[demoIndex];

  return (
    <div className={styles.page}>
      <TopHeader />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className="container">
            <div className={styles.heroShell}>
              <div className={styles.heroLeft}>
                <div className={styles.kicker}>{copy.heroEyebrow}</div>
                <h1 className={styles.h1}>{copy.heroTitle}</h1>
                <p className={styles.lead}>{copy.heroSub}</p>

                <div className={styles.btnRow}>
                  <a
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    href="/chat"
                    onClick={goToChat}
                    aria-label={copy.openChat}
                  >
                    {copy.openChat}
                  </a>

                  <a className={styles.btn} href="#intro" aria-label={copy.explore}>
                    {copy.explore}
                  </a>
                </div>

                <div className={styles.trustRow} aria-label={copy.chipsAria}>
                  <div className={styles.trustChip}>{copy.chipA}</div>
                  <div className={styles.trustChip}>{copy.chipB}</div>
                  <div className={styles.trustChip}>{copy.chipC}</div>
                </div>
              </div>

              <aside className={styles.heroDemo} aria-label={copy.heroDemoTitle}>
                <div className={styles.heroDemoFrame}>
                  <div className={styles.heroDemoMeta}>{activeDemo.title}</div>

                  <div className={styles.heroDemoStream}>
                    <div className={`${styles.heroBubble} ${styles.heroBubbleUser}`}>
                      <div className={styles.heroBubbleLabel}>{copy.youLabel}</div>
                      <div className={styles.heroBubbleText}>
                        {typedUser}
                        <span className={styles.heroCaret} aria-hidden="true" />
                      </div>
                    </div>

                    <div
                      className={`${styles.heroBubble} ${styles.heroBubbleHopy} ${
                        showHopy ? styles.heroBubbleVisible : styles.heroBubbleHidden
                      }`}
                    >
                      <div className={styles.heroBubbleLabel}>{copy.hopyLabel}</div>
                      <div className={styles.heroBubbleText}>
                        {typedHopy}
                        {showHopy ? <span className={styles.heroCaret} aria-hidden="true" /> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section id="intro" className={styles.section}>
          <div className="container">
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>{copy.introTitle}</h2>
              <p className={styles.p}>{copy.introBody}</p>
            </div>

            <div className={styles.grid3}>
              <div className={`${styles.surface} ${styles.tile}`}>
                <div className={styles.tileTitle}>{copy.introCard1Title}</div>
                <div className={styles.tileText}>{copy.introCard1Body}</div>
              </div>
              <div className={`${styles.surface} ${styles.tile}`}>
                <div className={styles.tileTitle}>{copy.introCard2Title}</div>
                <div className={styles.tileText}>{copy.introCard2Body}</div>
              </div>
              <div className={`${styles.surface} ${styles.tile}`}>
                <div className={styles.tileTitle}>{copy.introCard3Title}</div>
                <div className={styles.tileText}>{copy.introCard3Body}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="founder" className={styles.section}>
          <div className="container">
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>{copy.founderTitle}</h2>
              <p className={styles.p}>{copy.founderBody}</p>
            </div>
          </div>
        </section>

        <section id="scene" className={styles.section}>
          <div className="container">
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>{copy.sceneTitle}</h2>
              <p className={styles.p}>{copy.sceneBody}</p>
            </div>

            <div className={styles.grid3}>
              <div className={`${styles.surface} ${styles.tile}`}>
                <div className={styles.tileTitle}>{copy.sceneCard1Title}</div>
                <div className={styles.tileText}>{copy.sceneCard1Body}</div>
              </div>
              <div className={`${styles.surface} ${styles.tile}`}>
                <div className={styles.tileTitle}>{copy.sceneCard2Title}</div>
                <div className={styles.tileText}>{copy.sceneCard2Body}</div>
              </div>
              <div className={`${styles.surface} ${styles.tile}`}>
                <div className={styles.tileTitle}>{copy.sceneCard3Title}</div>
                <div className={styles.tileText}>{copy.sceneCard3Body}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="safety" className={styles.section}>
          <div className="container">
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>{copy.safetyTitle}</h2>
              <p className={styles.p}>{copy.safetyBody}</p>
            </div>

            <div className={styles.grid3}>
              <div className={`${styles.surface} ${styles.tile}`}>
                <div className={styles.tileTitle}>{copy.safetyCard1Title}</div>
                <div className={styles.tileText}>{copy.safetyCard1Body}</div>
              </div>
              <div className={`${styles.surface} ${styles.tile}`}>
                <div className={styles.tileTitle}>{copy.safetyCard2Title}</div>
                <div className={styles.tileText}>{copy.safetyCard2Body}</div>
              </div>
              <div className={`${styles.surface} ${styles.tile}`}>
                <div className={styles.tileTitle}>{copy.safetyCard3Title}</div>
                <div className={styles.tileText}>{copy.safetyCard3Body}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="cta" className={styles.section}>
          <div className="container">
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>{copy.finalTitle}</h2>
              <p className={styles.p}>{copy.finalBody}</p>
            </div>

            <div className={styles.sectionCta}>
              <a
                className={`${styles.btn} ${styles.btnPrimary}`}
                href="/chat"
                onClick={goToChat}
                aria-label={copy.openChat}
              >
                {copy.openChat}
              </a>
              <a className={styles.btn} href="#safety" aria-label={copy.viewSafety}>
                {copy.viewSafety}
              </a>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </div>
  );
}