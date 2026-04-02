// /app/legal/page.tsx
import TopHeader from "@/components/site/TopHeader";
import SiteFooter from "@/components/site/SiteFooter";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function LegalPage() {
  return (
    <div className={styles.page}>
      <TopHeader />

      <main className={styles.main}>
        <div className={styles.content}>
          <div className="container">
            <section className={styles.headerBlock} aria-label="Company overview">
              <h1 className={styles.title}>会社情報</h1>

              <div style={{ height: 24 }} />

              <p className={styles.lead}>
                HOPYは、考えを静かに整理し、前へ進むための判断のきっかけを支える対話サービスです。
              </p>

              <div style={{ height: 12 }} />

              <p className={styles.lead}>
                一時的な派手さよりも、安定して長く使えることを大切にしながら、世界のユーザーが安心して利用できる体験を目指して開発を進めています。
              </p>
            </section>

            <section className={`${styles.section} ${styles.narrow}`} aria-label="Founder message">
              <h2 className={styles.sectionTitle}>開発者の想い</h2>

              <p className={styles.sectionBody}>
                みんなの役に立ちたい。成功のきっかけをつかんでほしい。恩返しがしたい。
              </p>

              <p className={styles.sectionBody}>
                HOPYは、その想いを土台に、支配せず、断定しすぎず、包み込むように支えながら前へ進める存在を目指しています。
              </p>
            </section>

            <section className={`${styles.section} ${styles.narrow}`} aria-label="Guidance">
              <h2 className={styles.sectionTitle}>ご案内</h2>

              <p className={styles.sectionBody}>HOPYに関する大切な情報は、以下のページから確認できます。</p>

              <div className={styles.cardList}>
                <a href="/terms" className={styles.cardLink}>
                  <div className={styles.cardTitle}>利用規約</div>
                  <div className={styles.cardBody}>
                    HOPYの利用条件、AI応答の性質、禁止事項などの基本ルールを案内します。
                  </div>
                </a>

                <a href="/commerce" className={styles.cardLink}>
                  <div className={styles.cardTitle}>特定商取引法に基づく表記</div>
                  <div className={styles.cardBody}>
                    有料機能や有料プランを提供する場合の法定表示、支払方法、解約条件、お問い合わせ先などを案内します。
                  </div>
                </a>

                <a href="/privacy" className={styles.cardLink}>
                  <div className={styles.cardTitle}>プライバシーポリシー</div>
                  <div className={styles.cardBody}>
                    アカウント情報、会話データ、利用環境情報などの取り扱い方針を案内します。
                  </div>
                </a>
              </div>
            </section>

            <section id="contact-ai" className={`${styles.section} ${styles.narrow}`} aria-label="Q and A">
              <h2 className={styles.sectionTitle}>Q&amp;A</h2>

              <p className={styles.sectionBody}>
                HOPYに関するご質問や確認したいことは、AIチャットからもたどれるよう整えていきます。
              </p>

              <p className={styles.sectionBody}>
                サービス内容、利用方法、考え方などを落ち着いて確認したいときは、対話の入口としてご利用ください。
              </p>

              <div className={styles.ctaRow}>
                <a href="/chat" className={styles.ctaButton}>
                  AIチャットを見る
                </a>
              </div>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}