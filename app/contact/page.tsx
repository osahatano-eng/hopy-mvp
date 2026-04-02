// /app/contact/page.tsx
"use client";

import Link from "next/link";
import HomeHeader from "@/components/home/HomeHeader";
import HomeFooter from "@/components/home/HomeFooter";
import { useLang } from "@/components/site/LangProvider";
import styles from "./page.module.css";

export default function ContactPage() {
  const { uiLang2 } = useLang();
  const isJa = uiLang2 === "ja";

  return (
    <main className={styles.page}>
      <HomeHeader />

      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.title}>{isJa ? "Contact" : "Contact"}</h1>

          <p className={styles.lead}>
            {isJa ? (
              <>
                まずは、よくあるご質問をご確認ください。
                <br />
                すぐに解決できる内容は、こちらでご案内しています。
              </>
            ) : (
              <>
                Please review the frequently asked questions first.
                <br />
                Quick answers are provided here for common questions.
              </>
            )}
          </p>
        </header>

        <section aria-labelledby="contact-faq" className={styles.faqSection}>
          <h2 id="contact-faq" className={styles.sectionTitle}>
            {isJa ? "Q&A" : "Q&A"}
          </h2>

          <div className={styles.card}>
            <h3 className={styles.question}>
              {isJa
                ? "Q. HOPYはどんなサービスですか？"
                : "Q. What kind of service is HOPY?"}
            </h3>
            <p className={styles.answer}>
              {isJa
                ? "HOPYは、考えを整理し、気づきを深め、次の方向を見つけるためのAIです。"
                : "HOPY is an AI designed to help you organize your thoughts, deepen your insights, and find your next direction."}
            </p>
          </div>

          <div className={styles.card}>
            <h3 className={styles.question}>
              {isJa
                ? "Q. まず何をすればいいですか？"
                : "Q. What should I do first?"}
            </h3>
            <p className={styles.answer}>
              {isJa
                ? "まずは今の気持ちや考えを、そのまま言葉にしてみてください。HOPYが流れを受け取り、整理のお手伝いをします。"
                : "Start by putting your current feelings or thoughts into words as they are. HOPY will take in that flow and help you sort it out."}
            </p>
          </div>

          <div className={styles.card}>
            <h3 className={styles.question}>
              {isJa
                ? "Q. 解決しない場合はどうすればいいですか？"
                : "Q. What should I do if this does not solve my problem?"}
            </h3>
            <p className={styles.answer}>
              {isJa
                ? "今後、このページからAIチャットによるご案内へ進める形を予定しています。現在はQ&Aを先にご確認いただく構成です。"
                : "This page is planned to lead into AI chat guidance in the future. For now, it is structured so you can review the Q&A first."}
            </p>
          </div>
        </section>

        <section aria-labelledby="contact-next" className={styles.nextSection}>
          <h2 id="contact-next" className={styles.sectionTitle}>
            {isJa ? "Next" : "Next"}
          </h2>

          <p className={styles.answer}>
            {isJa
              ? "解決しない場合のために、今後はAIチャットで質問できる導線をここに整えていきます。"
              : "For cases where the Q&A does not resolve the issue, this page will later provide a path to ask questions through AI chat."}
          </p>

          <div className={styles.ctaWrap}>
            <Link href="/chat" className={styles.ctaLink}>
              {isJa ? "Go to Chat" : "Go to Chat"}
            </Link>
          </div>
        </section>
      </div>

      <HomeFooter />
    </main>
  );
}