import Link from "next/link";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.wrap}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="HOPY Home">
          HOPY AI
        </Link>

        <nav className={styles.right} aria-label="top actions">
          <span className={styles.lang} aria-label="Language">
            <button className={`${styles.langBtn} ${styles.langActive}`} type="button">
              EN
            </button>
            <span className={styles.langSep} aria-hidden="true">
              /
            </span>
            <button className={styles.langBtn} type="button">
              JP
            </button>
          </span>

          <Link href="/chat" className={styles.cta}>
            Enter
            <span className={styles.arrow} aria-hidden="true">
              →
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
