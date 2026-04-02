// /app/commerce/page.tsx
"use client";

import HomeHeader from "@/components/home/HomeHeader";
import HomeFooter from "@/components/home/HomeFooter";
import { useLang } from "@/components/site/LangProvider";
import styles from "../contact/page.module.css";

export const dynamic = "force-dynamic";

export default function CommercePage() {
  const { uiLang2 } = useLang();
  const isJa = uiLang2 === "ja";

  return (
    <div className={styles.page}>
      <HomeHeader />

      <main>
        <div className={styles.inner}>
          <header className={styles.header} aria-label="Commerce overview">
            <h1 className={styles.title}>
              {isJa
                ? "特定商取引法に基づく表記"
                : "Commerce Disclosure"}
            </h1>

            <p className={styles.lead}>
              {isJa
                ? "本ページは、HOPYにおける有料機能または有料プランの提供を行う場合を想定し、特定商取引法に基づく必要事項を案内するためのページです。"
                : "This page is intended to provide the disclosures required under applicable commerce-related rules in the event that HOPY offers paid features or paid plans."}
            </p>

            <p className={styles.lead}>
              {isJa
                ? "現時点で有料提供の内容が未確定の項目については、今後の正式提供開始に合わせて更新します。実際の申込み画面、料金画面、決済画面に表示される条件が優先して適用される場合があります。"
                : "Items whose paid offering details are not yet finalized will be updated when formal paid offerings begin. Terms shown on the actual application, pricing, and payment screens may take precedence where applicable."}
            </p>

            <p className={styles.answer}>
              {isJa ? "制定日：2026年3月10日" : "Effective date: March 10, 2026"}
            </p>
          </header>

          <section className={styles.nextSection} aria-label="Seller information">
            <h2 className={styles.sectionTitle}>
              {isJa ? "事業者情報" : "Seller Information"}
            </h2>

            <div className={styles.card}>
              <p className={styles.answer}>
                {isJa ? "販売事業者名：HOPY" : "Seller name: HOPY"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "運営責任者：【運営責任者名を記載】"
                  : "Responsible operator: [Insert operator name]"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "所在地：ご請求をいただいた場合には、遅滞なく電子メールにて開示いたします。"
                  : "Address: Will be disclosed without delay by email upon request."}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "電話番号：ご請求をいただいた場合には、遅滞なく電子メールにて開示いたします。"
                  : "Phone number: Will be disclosed without delay by email upon request."}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "お問い合わせ先：【問い合わせメールアドレス または 問い合わせフォームURLを記載】"
                  : "Contact: [Insert contact email address or inquiry form URL]"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "受付時間：【お問い合わせ受付時間を記載】"
                  : "Support hours: [Insert inquiry hours]"}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "サイトURL：【https://ご自身の正式ドメインを記載】"
                  : "Site URL: [Insert your official domain]"}
              </p>
            </div>
          </section>

          <section className={styles.nextSection} aria-label="Price and fees">
            <h2 className={styles.sectionTitle}>
              {isJa ? "販売価格・追加費用" : "Pricing and Additional Fees"}
            </h2>

            <div className={styles.card}>
              <p className={styles.answer}>
                {isJa
                  ? "販売価格：各有料プラン、各機能、各申込み画面に表示された金額とします。月額、年額、買い切りその他の提供形態に応じて、申込み前に明示します。"
                  : "Price: The amount displayed for each paid plan, feature, or application screen applies. Monthly, annual, one-time, or other pricing models will be shown before purchase."}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "商品代金以外の必要料金：インターネット接続料金、通信料金、振込手数料その他、当サービス利用や支払のために必要となる費用は、ユーザーの負担となります。"
                  : "Additional fees: Internet connection fees, communication fees, transfer fees, and other costs required to use or pay for the Service are borne by the user."}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "送料：デジタルサービスのため、原則として送料は発生しません。"
                  : "Shipping: As this is a digital service, shipping fees generally do not apply."}
              </p>
            </div>
          </section>

          <section className={styles.nextSection} aria-label="Payment">
            <h2 className={styles.sectionTitle}>
              {isJa ? "支払方法・支払時期" : "Payment Method and Timing"}
            </h2>

            <div className={styles.card}>
              <p className={styles.answer}>
                {isJa
                  ? "支払方法：クレジットカード、アプリ内課金、外部決済サービスその他、当サービスが申込み画面で定める方法によります。"
                  : "Payment method: Credit card, in-app purchase, external payment services, or other methods specified by the Service on the application screen."}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "支払時期：単発購入の場合は申込み時または決済時、サブスクリプションの場合は初回申込み時および以後の更新日に課金されます。詳細は各決済画面の表示に従います。"
                  : "Payment timing: For one-time purchases, payment is charged at the time of application or settlement. For subscriptions, payment is charged at initial signup and on each renewal date thereafter. Details follow the applicable payment screen."}
              </p>
            </div>
          </section>

          <section className={styles.nextSection} aria-label="Delivery timing">
            <h2 className={styles.sectionTitle}>
              {isJa ? "提供時期" : "Timing of Service Delivery"}
            </h2>

            <div className={styles.card}>
              <p className={styles.answer}>
                {isJa
                  ? "サービス提供時期：決済手続完了後、特段の表示がない限り、直ちにまたは当サービス所定の開始時点から利用可能となります。システム都合、審査、メンテナンスその他の理由により開始まで時間を要する場合は、申込み画面または別途案内で明示します。"
                  : "Service availability: Unless otherwise stated, the service becomes available immediately after payment completion or from the start time specified by the Service. If activation takes time due to system reasons, review, maintenance, or other causes, that will be shown on the application screen or separately communicated."}
              </p>
            </div>
          </section>

          <section
            className={styles.nextSection}
            aria-label="Cancellation and refunds"
          >
            <h2 className={styles.sectionTitle}>
              {isJa ? "返品・キャンセル・解約・返金" : "Returns, Cancellation, Termination, and Refunds"}
            </h2>

            <div className={styles.card}>
              <p className={styles.answer}>
                {isJa
                  ? "返品・キャンセル：デジタルサービスの性質上、購入手続完了後の返品またはキャンセルは、法令上認められる場合または当サービスが別途認める場合を除き、原則としてお受けしません。"
                  : "Returns and cancellation: Due to the nature of digital services, returns or cancellations after purchase completion are generally not accepted except where required by law or otherwise expressly permitted by the Service."}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "サブスクリプションの解約：定期課金型サービスを提供する場合、ユーザーは次回更新日までに当サービス所定の方法で解約手続を行うことで、次回以降の更新を停止できます。すでに支払済みの期間については、法令上必要な場合を除き、日割り返金は行いません。"
                  : "Subscription cancellation: Where recurring billing services are provided, users may stop future renewals by completing cancellation through the Service’s designated method before the next renewal date. Prorated refunds are not provided for already-paid periods unless required by law."}
              </p>
              <p className={styles.answer}>
                {isJa
                  ? "返金：当サービス側の重大な不具合、二重課金、法令上必要な場合その他当サービスが相当と判断した場合を除き、原則として返金は行いません。返金可否と方法は、個別事情、決済手段、適用法令に応じて判断します。"
                  : "Refunds: Refunds are generally not provided except in cases such as major service defects, duplicate charges, circumstances required by law, or other cases the Service determines appropriate. Refund eligibility and method depend on the individual case, payment method, and applicable law."}
              </p>
            </div>
          </section>

          <section className={styles.nextSection} aria-label="System requirements">
            <h2 className={styles.sectionTitle}>
              {isJa ? "動作環境" : "Recommended Environment"}
            </h2>

            <div className={styles.card}>
              <p className={styles.answer}>
                {isJa
                  ? "推奨環境：最新の主要ブラウザおよび一般的なスマートフォン・PC環境を推奨します。一部機能は、端末性能、ブラウザ設定、通信環境、外部サービス状況により正常に動作しない場合があります。"
                  : "Recommended environment: Current major browsers and standard smartphone or PC environments are recommended. Some features may not function properly depending on device performance, browser settings, network conditions, or external service status."}
              </p>
            </div>
          </section>

          <section className={styles.nextSection} aria-label="Special notes">
            <h2 className={styles.sectionTitle}>
              {isJa ? "特記事項" : "Special Notes"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "当サービスは対話型AIサービスを含みます。表示内容、応答品質、提供機能、利用条件は、改善や安全対策のため変更されることがあります。"
                : "The Service includes conversational AI features. Displayed content, response quality, provided functions, and terms of use may change for improvement or safety reasons."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "実際の有料提供を開始する際には、申込みページにおいて、価格、更新条件、解約条件、課金単位その他必要事項を、ユーザーが申込み内容を確認しやすい形で明示します。"
                : "When paid offerings officially begin, the application page will clearly display price, renewal conditions, cancellation conditions, billing units, and other required matters in a way that users can easily review."}
            </p>
          </section>

          <section className={styles.nextSection} aria-label="Important notice">
            <h2 className={styles.sectionTitle}>
              {isJa ? "ご確認ください" : "Please Note"}
            </h2>
            <p className={styles.answer}>
              {isJa
                ? "このページは、HOPYで有料機能または有料プランを提供する際に必要となる法定表示の土台です。"
                : "This page is the base disclosure page to be used when HOPY offers paid features or paid plans."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "本ページの【運営責任者名】【問い合わせ先】【受付時間】【正式ドメイン】は、実運営情報に差し替えて公開してください。"
                : "Before publishing, replace [operator name], [contact], [support hours], and [official domain] on this page with actual operating information."}
            </p>
            <p className={styles.answer}>
              {isJa
                ? "また、実際の申込み画面では、価格、支払時期、更新条件、解約条件、確認導線などを、ユーザーが見落としにくい形で明示してください。"
                : "Also, the actual application screen should clearly display price, payment timing, renewal conditions, cancellation conditions, confirmation flow, and similar matters in a way users are unlikely to miss."}
            </p>
          </section>
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}