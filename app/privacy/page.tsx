// /app/privacy/page.tsx
"use client";

import HomeHeader from "@/components/home/HomeHeader";
import HomeFooter from "@/components/home/HomeFooter";
import { useLang } from "@/components/site/LangProvider";
import styles from "../contact/page.module.css";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const { uiLang2 } = useLang();
  const isJa = uiLang2 === "ja";

  return (
    <div className={styles.page}>
      <HomeHeader />

      <main>
        <div className={styles.inner}>
          <header className={styles.header} aria-label="Privacy overview">
            <h1 className={styles.title}>
              {isJa ? "プライバシーポリシー" : "Privacy Policy"}
            </h1>

            <p className={styles.lead}>
              {isJa
                ? "HOPY（以下「当サービス」）は、ユーザーが安心して利用できる対話体験を大切にしています。本プライバシーポリシーは、当サービスが取得する情報、その利用目的、管理方法、ユーザーの権利その他プライバシーに関する基本方針を定めるものです。"
                : "HOPY (the “Service”) values a conversational experience that users can rely on with confidence. This Privacy Policy explains the types of information the Service may collect, the purposes for which it is used, how it is managed, and the rights of users regarding privacy."}
            </p>

            <p className={styles.lead}>
              {isJa
                ? "当サービスは、必要最小限の情報を、明確な目的の範囲で、適切かつ安全に取り扱うことを基本方針とします。Googleアカウント等の外部認証を利用したログインや、匿名寄りの利用形態を含む実運用を前提として、適用される法令や地域ごとの保護ルールにも配慮しながら運営します。"
                : "The Service follows a basic policy of handling only the minimum necessary information within clear purposes, in an appropriate and secure manner. The Service is operated with practical use cases in mind, including login via third-party authentication such as Google accounts and usage patterns that may be closer to anonymous use, while taking into account applicable laws and region-specific privacy protections."}
            </p>

            <p className={styles.answer}>
              {isJa ? "制定日：2026年3月10日" : "Effective date: March 10, 2026"}
            </p>
          </header>

          <section className={styles.nextSection} aria-label="Scope">
            <h2 className={styles.sectionTitle}>
              {isJa ? "1. 適用範囲" : "1. Scope"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "本ポリシーは、当サービスのウェブサイト、アプリケーション、対話機能、関連サポート、お問い合わせ対応その他当サービスに関連して取得される情報に適用されます。"
                : "This Policy applies to information collected in connection with the Service’s website, applications, conversational features, related support, inquiry handling, and other Service-related activities."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "当サービスが外部サービスと連携する場合、当該外部サービスにおける情報の取扱いには、それぞれの提供元が定めるポリシーや利用条件が適用されることがあります。"
                : "Where the Service integrates with third-party services, the handling of information by those services may be governed by the policies and terms established by their respective providers."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Information we collect">
            <h2 className={styles.sectionTitle}>
              {isJa ? "2. 取得する情報" : "2. Information We Collect"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、以下のような情報を取得する場合があります。"
                : "The Service may collect information such as the following."}
            </p>
            <div className={styles.faqSection}>
              <div className={styles.card}>
                <p className={styles.answer}>
                  {isJa
                    ? "・表示名、メールアドレス、プロフィール画像、外部認証に必要な識別情報その他アカウント作成や認証に必要な情報"
                    : "• Display name, email address, profile image, authentication identifiers required for third-party sign-in, and other information necessary for account creation or authentication"}
                </p>
                <p className={styles.answer}>
                  {isJa
                    ? "・チャット内容、入力テキスト、添付データ、設定情報、保存した会話やメモなど、ユーザーが当サービスに提供する情報"
                    : "• Chat content, input text, attached data, settings, saved conversations or notes, and other information provided by users to the Service"}
                </p>
                <p className={styles.answer}>
                  {isJa
                    ? "・利用日時、アクセス元情報、端末種別、ブラウザ情報、OS、言語設定、IPアドレス、クッキー、ローカルストレージその他利用環境に関する情報"
                    : "• Usage date and time, access source information, device type, browser information, operating system, language settings, IP address, cookies, local storage, and other information about the usage environment"}
                </p>
                <p className={styles.answer}>
                  {isJa
                    ? "・有料機能または有料プランを提供する場合における購入情報、契約情報、請求に関連する情報"
                    : "• Purchase information, subscription or contract information, and billing-related information where paid features or plans are offered"}
                </p>
                <p className={styles.answer}>
                  {isJa
                    ? "・お問い合わせ時に提供される内容、連絡先、やりとりの履歴"
                    : "• Inquiry details, contact information, and communication history provided when contacting the Service"}
                </p>
                <p className={styles.answer}>
                  {isJa
                    ? "・障害調査、不正利用防止、品質改善、安全対策のために必要なログ情報"
                    : "• Log information necessary for incident investigation, misuse prevention, quality improvement, and security measures"}
                </p>
              </div>
            </div>
          </section>

          <section className={styles.nextSection} aria-label="How we collect information">
            <h2 className={styles.sectionTitle}>
              {isJa ? "3. 取得方法" : "3. How We Collect Information"}
            </h2>
            <div className={styles.card}>
              <p className={styles.answer}>
                {isJa
                  ? "・ユーザーが登録、入力、送信、保存、設定変更または問い合わせを行うことにより直接提供する方法"
                  : "• Directly from users when they register, enter, send, save, change settings, or make inquiries"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・当サービスの利用に伴って自動的に生成・収集されるログや技術情報による方法"
                  : "• Through logs and technical information automatically generated and collected through use of the Service"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・認証、決済、分析、ホスティング等で連携する外部サービスから適法に提供される方法"
                  : "• Lawfully from third-party services used for authentication, payment, analytics, hosting, and similar functions"}
              </p>
            </div>
          </section>

          <section className={styles.nextSection} aria-label="Purposes of use">
            <h2 className={styles.sectionTitle}>
              {isJa ? "4. 利用目的" : "4. Purposes of Use"}
            </h2>
            <div className={styles.card}>
              <p className={styles.answer}>
                {isJa
                  ? "・当サービスの提供、運営、維持、保守および改善のため"
                  : "• To provide, operate, maintain, support, and improve the Service"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・ユーザー認証、アカウント管理、本人確認および不正利用防止のため"
                  : "• For user authentication, account management, identity verification, and misuse prevention"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・チャット機能、保存機能、表示最適化その他ユーザーが求める体験を提供するため"
                  : "• To provide chat features, saving functions, display optimization, and other experiences requested by users"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・安全性、安定性、レスポンシブ性、軽量性その他サービス品質を向上させるため"
                  : "• To improve safety, stability, responsiveness, efficiency, and overall service quality"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・バグ調査、障害対応、監査、セキュリティ対策のため"
                  : "• For bug investigation, incident response, auditing, and security measures"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・サポート対応、問い合わせ対応、重要なお知らせの送付のため"
                  : "• For support handling, inquiry handling, and sending important notices"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・法令遵守、権利保護、紛争対応その他正当な運営上必要な対応のため"
                  : "• For legal compliance, rights protection, dispute response, and other legitimate operational needs"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・統計的な分析や傾向把握を行い、個人を直接特定しない形でサービス改善に活かすため"
                  : "• To conduct statistical analysis and trend review in a way that does not directly identify individuals, and to use those insights to improve the Service"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・有料機能または有料プランを提供する場合において、決済処理、請求管理、不正決済防止、返金対応その他取引管理を行うため"
                  : "• Where paid features or plans are offered, to process payments, manage billing, prevent fraudulent payments, handle refunds, and manage related transactions"}
              </p>
            </div>
          </section>

          <section className={styles.nextSection} aria-label="AI and conversation handling">
            <h2 className={styles.sectionTitle}>
              {isJa ? "5. AI応答と会話データの取扱い" : "5. AI Responses and Conversation Data"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、対話機能を提供するため、ユーザーが入力した内容およびそれに対する応答を処理、保存または参照する場合があります。"
                : "To provide conversational features, the Service may process, store, or refer to user input and the responses generated in relation to that input."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "会話データは、ユーザー体験の継続性、安全性の確保、品質改善、不正利用防止、障害調査、サポート対応のために必要な範囲で利用されることがあります。"
                : "Conversation data may be used to the extent necessary for continuity of user experience, safety, quality improvement, misuse prevention, incident investigation, and support handling."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、会話内容に個人情報や機微な内容が含まれる可能性があることを認識し、必要以上に広い目的で利用しないこと、過剰に長期間保持しないこと、安全に管理することを重視します。"
                : "The Service recognizes that conversations may contain personal or sensitive information, and places importance on avoiding overly broad use, avoiding excessive retention, and managing such information securely."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Legal basis">
            <h2 className={styles.sectionTitle}>
              {isJa ? "6. 処理の法的根拠" : "6. Legal Basis for Processing"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、適用される法令に応じて、契約の履行、正当な利益、法令上の義務の履行、ユーザーの同意その他適法な根拠に基づいて個人情報を処理します。"
                : "Depending on applicable law, the Service processes personal information on lawful grounds such as performance of a contract, legitimate interests, compliance with legal obligations, user consent, or other valid legal bases."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "具体的な法的根拠は、ユーザーの居住地域、利用機能、提供される情報の内容によって異なる場合があります。"
                : "The specific legal basis may vary depending on the user’s place of residence, the features used, and the nature of the information provided."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Sharing of information">
            <h2 className={styles.sectionTitle}>
              {isJa ? "7. 第三者提供および共有" : "7. Sharing and Disclosure"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、以下の場合を除き、ユーザーの情報を第三者へ販売せず、また法令上許されない形で提供しません。"
                : "Except in the following cases, the Service does not sell user information to third parties and does not disclose it in ways not permitted by law."}
            </p>
            <div className={styles.card}>
              <p className={styles.answer}>
                {isJa
                  ? "・ユーザーの同意がある場合"
                  : "• Where the user has given consent"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・認証、決済、ホスティング、分析、通信、サポート等のために必要な委託先または連携先に提供する場合"
                  : "• Where disclosure is necessary to service providers or partners for authentication, payment, hosting, analytics, communications, support, or similar functions"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・有料機能または有料プランの提供に関連して、決済処理事業者、請求管理事業者その他取引に必要な事業者へ必要な範囲で提供する場合"
                  : "• Where paid features or plans are offered, disclosure to payment processors, billing managers, or other providers necessary for the transaction"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・法令に基づく開示要請に応じる場合"
                  : "• Where disclosure is required by law"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・人の生命、身体または財産の保護のために必要であり、本人の同意を得ることが困難な場合"
                  : "• Where necessary to protect life, body, or property and obtaining the individual’s consent is difficult"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・権利侵害、不正利用、セキュリティ上の重大な問題に対応するため必要な場合"
                  : "• Where necessary to address rights violations, misuse, or major security issues"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "・事業承継、合併、事業譲渡、組織再編等に伴って情報が承継される場合"
                  : "• Where information is transferred in connection with a business succession, merger, business transfer, or organizational restructuring"}
              </p>
            </div>
          </section>

          <section className={styles.nextSection} aria-label="International data transfers">
            <h2 className={styles.sectionTitle}>
              {isJa ? "8. 国際的なデータ移転" : "8. International Data Transfers"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、クラウドインフラや外部サービスの利用に伴い、ユーザーの情報を日本国外で保管または処理する場合があります。"
                : "Due to the use of cloud infrastructure or third-party services, the Service may store or process user information outside Japan."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "その場合、適用法令に従い、契約上の保護措置、運用上の安全管理、委託先の審査その他合理的な保護措置を講じます。"
                : "In such cases, the Service will implement reasonable safeguards in accordance with applicable law, including contractual protections, operational security management, and due diligence of service providers."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Data retention">
            <h2 className={styles.sectionTitle}>
              {isJa ? "9. 保存期間" : "9. Retention Period"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、情報を、取得目的の達成に必要な期間、法令上必要な期間、紛争対応や安全管理に合理的に必要な期間の範囲で保持します。"
                : "The Service retains information for the period necessary to achieve the purposes of collection, the period required by law, and the period reasonably necessary for dispute response and security management."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "保存の必要がなくなった情報については、適用法令および技術上の制約を踏まえつつ、削除、匿名化または安全な方法による消去を行います。"
                : "When information is no longer needed, the Service will delete, anonymize, or securely erase it, taking into account applicable law and technical constraints."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Cookies and tracking">
            <h2 className={styles.sectionTitle}>
              {isJa ? "10. クッキー等の利用" : "10. Cookies and Similar Technologies"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、ログイン状態の維持、設定の保存、表示最適化、利用状況の把握、障害分析、安全対策等のために、クッキー、ローカルストレージその他類似技術を利用する場合があります。"
                : "The Service may use cookies, local storage, and similar technologies to maintain login status, save settings, optimize display, understand usage patterns, analyze incidents, and implement security measures."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "ユーザーは、ブラウザ設定等によりクッキーを無効化できる場合がありますが、その場合、一部機能が正しく利用できないことがあります。"
                : "Users may be able to disable cookies through browser settings, but doing so may cause some functions not to work properly."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Security">
            <h2 className={styles.sectionTitle}>
              {isJa ? "11. 安全管理措置" : "11. Security Measures"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、個人情報への不正アクセス、漏えい、滅失、改ざんその他のリスクに対し、アクセス制御、認証管理、通信保護、ログ監視、委託先管理、必要な運用ルールの整備など、合理的な安全管理措置を講じます。"
                : "The Service implements reasonable security measures against unauthorized access, leakage, loss, alteration, and similar risks involving personal information, including access controls, authentication management, communication protection, log monitoring, provider management, and necessary operational rules."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "ただし、インターネット上の送受信や電子的保存の完全な安全性を保証することはできないため、ユーザーにも適切な認証情報管理や端末管理をお願いします。"
                : "However, complete security of internet transmission and electronic storage cannot be guaranteed, so users are also asked to manage authentication information and devices appropriately."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Children">
            <h2 className={styles.sectionTitle}>
              {isJa ? "12. 未成年者の情報" : "12. Information Relating to Minors"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、適用法令に従い、未成年者のプライバシー保護に配慮します。未成年者が当サービスを利用する場合は、必要に応じて親権者その他の法定代理人の同意のもとで利用してください。"
                : "The Service takes care to protect the privacy of minors in accordance with applicable law. If a minor uses the Service, they should do so with the consent of a parent or other legal guardian where required."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="User rights">
            <h2 className={styles.sectionTitle}>
              {isJa ? "13. ユーザーの権利" : "13. User Rights"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "適用法令に基づき、ユーザーは、自己に関する情報について、開示、訂正、追加、削除、利用停止、処理制限、異議申立て、データポータビリティその他の権利を有する場合があります。"
                : "Under applicable law, users may have rights regarding their personal information, including access, correction, addition, deletion, suspension of use, restriction of processing, objection, data portability, and other rights."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、本人確認その他必要な手続きを経たうえで、法令に従って合理的な範囲で対応します。"
                : "The Service will respond within a reasonable scope in accordance with applicable law after identity verification and other necessary procedures."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Region specific rights">
            <h2 className={styles.sectionTitle}>
              {isJa ? "14. 地域別の補足" : "14. Region-Specific Notes"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、日本の個人情報保護法その他適用法令に加え、ユーザーの居住地域に応じて、GDPR、UK GDPR、CCPA/CPRAその他の関連法令上認められる権利や要件に可能な限り配慮します。"
                : "In addition to Japan’s Act on the Protection of Personal Information and other applicable laws, the Service seeks, where possible, to take into account rights and requirements recognized under GDPR, UK GDPR, CCPA/CPRA, and other relevant laws depending on the user’s region."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "ただし、具体的な法的評価や地域別対応の詳細は、提供地域、サービス規模、機能内容、法改正等に応じて見直されることがあります。"
                : "However, the specific legal assessment and details of region-specific handling may be reviewed depending on service regions, service scale, feature scope, and legal changes."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Changes to policy">
            <h2 className={styles.sectionTitle}>
              {isJa ? "15. 本ポリシーの変更" : "15. Changes to This Policy"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは、法令改正、機能変更、運営上の必要性その他合理的な理由により、本ポリシーを変更することがあります。"
                : "The Service may revise this Policy due to legal changes, feature changes, operational needs, or other reasonable reasons."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "重要な変更を行う場合は、当サービス上での表示その他合理的な方法により周知します。変更後のポリシーは、別途定める場合を除き、掲載時または周知時から効力を生じます。"
                : "If material changes are made, the Service will provide notice through posting within the Service or by other reasonable means. Unless otherwise specified, the revised Policy becomes effective upon posting or notice."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Contact">
            <h2 className={styles.sectionTitle}>
              {isJa ? "16. お問い合わせ" : "16. Contact"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "本ポリシーまたは当サービスにおける個人情報の取扱いに関するお問い合わせは、当サービス内のお問い合わせ導線、または当サービスが別途案内する問い合わせ窓口をご利用ください。"
                : "For inquiries regarding this Policy or the handling of personal information by the Service, please use the inquiry path within the Service or the separate contact channel provided by the Service."}
            </p>
          </section>
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}