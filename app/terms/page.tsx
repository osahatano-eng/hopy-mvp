// /app/terms/page.tsx
"use client";

import HomeHeader from "@/components/home/HomeHeader";
import HomeFooter from "@/components/home/HomeFooter";
import { useLang } from "@/components/site/LangProvider";
import styles from "../contact/page.module.css";

export const dynamic = "force-dynamic";

export default function TermsPage() {
  const { uiLang2 } = useLang();
  const isJa = uiLang2 === "ja";

  return (
    <div className={styles.page}>
      <HomeHeader />

      <main>
        <div className={styles.inner}>
          <header className={styles.header} aria-label="Terms overview">
            <h1 className={styles.title}>
              {isJa ? "利用規約" : "Terms of Service"}
            </h1>

            <p className={styles.lead}>
              {isJa
                ? "本利用規約（以下「本規約」）は、HOPY（以下「当サービス」）の利用条件を定めるものです。当サービスをご利用いただく方（以下「ユーザー」）は、本規約に同意のうえで当サービスを利用するものとします。"
                : "These Terms of Service (the “Terms”) set forth the conditions for using HOPY (the “Service”). By using the Service, you agree to these Terms."}
            </p>

            <p className={styles.lead}>
              {isJa
                ? "当サービスは、考えを整理し、前へ進むための対話体験を提供することを目指しています。一方で、AIによる応答には限界があり、すべての情報・判断・結果を保証するものではありません。ご利用の際は、この性質をご理解いただいたうえでご利用ください。"
                : "The Service aims to provide a conversational experience that helps users organize their thoughts and move forward. However, AI-generated responses have limitations and do not guarantee the accuracy, completeness, or outcomes of any information, judgment, or result."}
            </p>

            <p className={styles.answer}>
              {isJa ? "制定日：2026年3月10日" : "Effective date: March 10, 2026"}
            </p>
          </header>

          <section className={styles.nextSection} aria-label="Acceptance of terms">
            <h2 className={styles.sectionTitle}>
              {isJa ? "1. 適用" : "1. Scope"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "本規約は、当サービスの提供条件および当サービスの利用に関する当サービスとユーザーとの間の権利義務関係を定めるものです。"
                : "These Terms govern the conditions of the Service and the rights and obligations between the Service and its users regarding use of the Service."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "当サービス上で別途案内されるルール、ガイドライン、ポリシー等は、本規約の一部を構成するものとします。"
                : "Any separate rules, guidelines, or policies posted on the Service form part of these Terms."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "ユーザーの居住地域において強行法規により追加の保護や権利が認められる場合、それらは本規約によって制限されません。"
                : "If mandatory laws in your place of residence grant additional protections or rights, those rights are not limited by these Terms."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Eligibility">
            <h2 className={styles.sectionTitle}>
              {isJa ? "2. 利用資格" : "2. Eligibility"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "ユーザーは、自己の責任において当サービスを利用するものとし、適用される法令のもとで当サービスを利用する資格を有していなければなりません。"
                : "You use the Service at your own responsibility and must be legally eligible to use the Service under applicable law."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "未成年者が当サービスを利用する場合は、必要に応じて親権者その他の法定代理人の同意を得たうえで利用してください。"
                : "If you are a minor, please use the Service with the consent of a parent or legal guardian where required."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Accounts">
            <h2 className={styles.sectionTitle}>
              {isJa ? "3. アカウント" : "3. Accounts"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスの一部機能は、ログインまたはアカウント登録を必要とする場合があります。"
                : "Some features of the Service may require login or account registration."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "ユーザーは、登録情報を正確かつ最新の状態に保つ責任を負います。また、アカウントの管理不備、第三者による使用、認証情報の漏えい等により生じた不利益について、ユーザー自身が責任を負うものとします。"
                : "You are responsible for keeping your registration information accurate and up to date. You are also responsible for disadvantages caused by poor account management, third-party use, or credential leakage."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "ユーザーは、自己のアカウントを第三者に譲渡、貸与、共有または販売してはなりません。"
                : "You may not transfer, lend, share, or sell your account to any third party."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Service description">
            <h2 className={styles.sectionTitle}>
              {isJa ? "4. サービスの内容" : "4. Description of the Service"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、ユーザーとの対話を通じて、考えの整理、情報の見通しづけ、行動のきっかけづくり等を支援する機能を提供します。"
                : "The Service provides features intended to support thought organization, perspective building, and action discovery through conversation with users."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、医療、法律、税務、投資、緊急対応その他高度な専門判断が必要な場面において、専門家による助言や公的機関の案内に代わるものではありません。"
                : "The Service does not replace professional advice or official guidance in areas such as medical, legal, tax, investment, emergency, or other high-stakes matters requiring expert judgment."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、必要に応じて機能追加、仕様変更、改善、停止または終了されることがあります。"
                : "The Service may add features, change specifications, improve, suspend, or terminate functions as needed."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="AI limitations">
            <h2 className={styles.sectionTitle}>
              {isJa ? "5. AI応答の性質と注意事項" : "5. Nature and Limits of AI Responses"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスにはAIによる自動生成応答が含まれます。AIの応答は、常に正確、完全、最新、適切であることを保証するものではありません。"
                : "The Service includes AI-generated responses. AI responses are not guaranteed to be accurate, complete, current, or appropriate at all times."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "ユーザーは、重要な判断、契約、申請、医療行為、法的対応、投資判断、生命・身体・財産に関わる意思決定を行う際には、必ず一次情報、公的情報、または適切な専門家の助言を確認してください。"
                : "When making important decisions involving contracts, applications, medical matters, legal matters, investments, or matters affecting life, body, or property, you must verify primary sources, official information, or appropriate professional advice."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、ユーザーの不安や迷いに寄り添うことを目指しますが、緊急対応、危機介入、診断、治療、確定的判断を保証するものではありません。"
                : "The Service aims to support users through uncertainty, but it does not provide emergency response, crisis intervention, diagnosis, treatment, or definitive judgment."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="User content">
            <h2 className={styles.sectionTitle}>
              {isJa ? "6. ユーザー入力とコンテンツ" : "6. User Input and Content"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "ユーザーは、当サービスに入力、送信、投稿、保存または提供する文章、画像、指示、データその他一切のコンテンツについて、自ら適法な権利を有するか、または適法に利用できることを保証するものとします。"
                : "You represent that you hold lawful rights to, or may lawfully use, any text, images, instructions, data, or other content you input, send, post, save, or provide to the Service."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "ユーザーは、当サービスの提供、維持、改善、安全性確保、不正利用防止、サポート対応のために必要な範囲で、当サービスがユーザーコンテンツを取り扱うことに同意するものとします。"
                : "You agree that the Service may handle your content to the extent necessary for providing, maintaining, improving, securing, protecting against misuse, and supporting the Service."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "ユーザーは、他者の権利、名誉、プライバシー、知的財産権その他の利益を侵害する内容を入力してはなりません。"
                : "You may not input content that infringes the rights, reputation, privacy, intellectual property, or other interests of others."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Prohibited conduct">
            <h2 className={styles.sectionTitle}>
              {isJa ? "7. 禁止事項" : "7. Prohibited Conduct"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "ユーザーは、当サービスの利用にあたり、以下の行為を行ってはなりません。"
                : "You must not engage in any of the following conduct when using the Service."}
            </p>
            <div className={styles.card}>
              <p className={styles.answer}>
                {isJa
                  ? "・法令または公序良俗に違反する行為"
                  : "• Conduct that violates laws or public order and morals"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・犯罪行為、詐欺、脅迫、嫌がらせ、差別、誹謗中傷に関する行為"
                  : "• Conduct involving crime, fraud, threats, harassment, discrimination, or defamation"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・第三者の権利、プライバシー、名誉、信用、知的財産権を侵害する行為"
                  : "• Conduct that infringes third-party rights, privacy, reputation, credit, or intellectual property"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・不正アクセス、過度な負荷、スクレイピング、リバースエンジニアリングその他サービス運営を妨げる行為"
                  : "• Unauthorized access, excessive load, scraping, reverse engineering, or other interference with operation of the Service"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・マルウェア、スパム、フィッシング、虚偽情報の拡散等に利用する行為"
                  : "• Use involving malware, spam, phishing, or the spread of false information"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・自傷、他害、違法行為、危険行為その他重大な危害につながる用途で利用する行為"
                  : "• Use involving self-harm, harm to others, illegal acts, dangerous acts, or other serious harm"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・当サービスの出力を、誤解を招く形で人間による確定判断や公式見解であるかのように表示する行為"
                  : "• Presenting Service output in a misleading way as if it were definitive human judgment or an official view"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・当サービスの趣旨に照らして不適切と当サービスが合理的に判断する行為"
                  : "• Any conduct the Service reasonably considers inappropriate in light of its purpose"}
              </p>
            </div>
          </section>

          <section className={styles.nextSection} aria-label="Fees">
            <h2 className={styles.sectionTitle}>
              {isJa ? "8. 料金と有料機能" : "8. Fees and Paid Features"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスの一部は、将来的に有料で提供される場合があります。その場合、料金、支払方法、更新条件、解約条件その他必要な事項は、別途当サービス上で表示または案内します。"
                : "Some parts of the Service may be offered for a fee in the future. In that case, fees, payment methods, renewal conditions, cancellation conditions, and other necessary matters will be displayed or provided separately within the Service."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "法令上必要な表示については、特定商取引法に基づく表記その他のページにおいて案内します。"
                : "Legally required disclosures will be provided on the Commerce page and other relevant pages as applicable."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Intellectual property">
            <h2 className={styles.sectionTitle}>
              {isJa ? "9. 知的財産権" : "9. Intellectual Property"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスに関するソフトウェア、デザイン、文章、構成、ロゴ、商標、画面表示その他の権利は、当サービスまたは正当な権利者に帰属します。"
                : "Rights related to the Service, including software, design, text, structure, logos, trademarks, screen displays, and other materials, belong to the Service or the legitimate rights holders."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "ユーザーは、法令により認められる範囲を超えて、当サービスのコンテンツを複製、改変、配布、公衆送信、販売、再許諾等してはなりません。"
                : "You may not reproduce, modify, distribute, publicly transmit, sell, sublicense, or otherwise use Service content beyond the scope permitted by law."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Third party services">
            <h2 className={styles.sectionTitle}>
              {isJa ? "10. 外部サービス" : "10. Third-Party Services"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、認証、決済、分析、ホスティングその他の目的で第三者サービスと連携する場合があります。"
                : "The Service may integrate with third-party services for authentication, payments, analytics, hosting, and other purposes."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "これらの外部サービスの利用には、各提供元の利用条件やポリシーが適用されることがあります。"
                : "Use of such third-party services may be subject to the terms and policies of their respective providers."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Service interruption">
            <h2 className={styles.sectionTitle}>
              {isJa ? "11. 停止・中断・変更" : "11. Suspension, Interruption, and Changes"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、システム保守、障害対応、通信環境、外部サービス障害、災害、法令対応その他やむを得ない事由により、当サービスの全部または一部を停止または中断することがあります。"
                : "The Service may suspend or interrupt all or part of the Service due to system maintenance, incident response, network conditions, third-party outages, disasters, legal compliance, or other unavoidable reasons."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、合理的に必要と判断した場合、サービス内容の変更、追加、削除または終了を行うことがあります。"
                : "The Service may modify, add, remove, or terminate Service content when reasonably necessary."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Disclaimer">
            <h2 className={styles.sectionTitle}>
              {isJa ? "12. 保証の否認" : "12. Disclaimer of Warranties"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、現状有姿で提供されるものであり、明示または黙示を問わず、正確性、完全性、有用性、継続性、特定目的適合性、権利非侵害等について保証するものではありません。"
                : "The Service is provided on an “as is” basis and makes no express or implied warranties regarding accuracy, completeness, usefulness, continuity, fitness for a particular purpose, or non-infringement."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、ユーザーの目的達成、成果、問題解決、期待どおりの結果を保証するものではありません。"
                : "The Service does not guarantee achievement of your goals, outcomes, problem resolution, or expected results."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Limitation of liability">
            <h2 className={styles.sectionTitle}>
              {isJa ? "13. 責任の制限" : "13. Limitation of Liability"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、当サービスの利用または利用不能に関連してユーザーに生じた損害について、当サービスに故意または重過失がある場合を除き、責任を負わないものとします。"
                : "The Service is not liable for damages arising from use of, or inability to use, the Service, except where caused by the Service’s intentional misconduct or gross negligence."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "また、当サービスが責任を負う場合であっても、適用法令上許される限り、特別損害、間接損害、結果的損害、逸失利益については責任を負いません。"
                : "Even where liability applies, the Service is not liable, to the fullest extent permitted by applicable law, for special, indirect, consequential damages, or lost profits."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "なお、消費者保護法その他の強行法規により本条の一部が適用されない場合、その範囲では当該法令が優先されます。"
                : "If part of this section is unenforceable under consumer protection law or other mandatory law, such law prevails to that extent."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Suspension and termination">
            <h2 className={styles.sectionTitle}>
              {isJa ? "14. 利用停止・終了" : "14. Suspension and Termination"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "ユーザーが本規約に違反した場合、または当サービスの安全性・信頼性・運営上の観点から必要と合理的に判断される場合、当サービスは事前通知なく、当該ユーザーによる利用を制限、停止または終了できるものとします。"
                : "If you violate these Terms, or if reasonably necessary from the standpoint of safety, reliability, or operation of the Service, the Service may restrict, suspend, or terminate your use without prior notice."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "ユーザーは、当サービス所定の方法により、自己の利用を終了することができます。"
                : "You may stop using the Service in accordance with the procedures specified by the Service."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Changes to terms">
            <h2 className={styles.sectionTitle}>
              {isJa ? "15. 本規約の変更" : "15. Changes to These Terms"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、必要に応じて本規約を変更することがあります。重要な変更を行う場合は、当サービス上での表示その他合理的な方法により周知します。"
                : "The Service may revise these Terms as necessary. Material changes will be announced through posting within the Service or by other reasonable means."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "変更後の本規約は、別途定める場合を除き、当サービス上に掲載された時点または周知時点から効力を生じます。"
                : "Unless otherwise stated, revised Terms become effective when posted within the Service or otherwise notified."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Governing law">
            <h2 className={styles.sectionTitle}>
              {isJa ? "16. 準拠法および管轄" : "16. Governing Law and Jurisdiction"}
            </h2>
            <p className={styles.answer}>
              {isJa ? "本規約は、日本法を準拠法とします。" : "These Terms are governed by the laws of Japan."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "本規約または当サービスに関連して紛争が生じた場合、当サービス運営者の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。"
                : "In the event of a dispute relating to these Terms or the Service, the court having jurisdiction over the location of the Service operator shall be the court of exclusive jurisdiction for the first instance."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "ただし、ユーザーに適用される強行法規により別途保護が認められる場合、その範囲では当該法令が優先されます。"
                : "However, if mandatory laws applicable to you provide otherwise, such laws prevail to that extent."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Contact">
            <h2 className={styles.sectionTitle}>
              {isJa ? "17. お問い合わせ" : "17. Contact"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "本規約に関するお問い合わせは、当サービスが別途案内する窓口または案内ページをご利用ください。"
                : "For inquiries regarding these Terms, please use the contact channel or guidance page separately provided by the Service."}
            </p>
          </section>
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}