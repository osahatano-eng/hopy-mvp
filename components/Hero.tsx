"use client";

import styles from "./Hero.module.css";

export default function Hero({
  tag,
  headlineA,
  headlineB,
  sub,
  hint,
}: {
  tag: string;
  headlineA: string;
  headlineB: string;
  sub: string;
  hint: string;
}) {
  return (
    <section className={styles.hero} aria-label="Hero">
      <div className={styles.heroInner}>
        <div className={styles.heroLeft}>
          <div className={styles.heroTag}>{tag}</div>

          <h1 className={styles.heroHead}>
            <span className={styles.heroHeadA}>{headlineA}</span>
            <span className={styles.heroHeadB}>{headlineB}</span>
          </h1>

          <p className={styles.heroSub}>{sub}</p>

          <div className={styles.heroHint}>
            <span className={styles.hintLine} aria-hidden />
            <span className={styles.hintText}>{hint}</span>
          </div>
        </div>

        <div className={styles.heroRight} aria-hidden>
          <div className={styles.vmark}>
            <span>H</span>
            <span>O</span>
            <span>P</span>
            <span>Y</span>
          </div>
        </div>
      </div>

      <div className={styles.heroScrollfade} aria-hidden />
    </section>
  );
}