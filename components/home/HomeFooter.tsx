// /components/home/HomeFooter.tsx
import Image from "next/image";
import Link from "next/link";
import styles from "./HomeFooter.module.css";

export default function HomeFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer aria-label="Site footer" className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <div className={styles.brand}>
            <Image
              src="/brand/hopy-icon-master.svg"
              alt=""
              className={styles.brandIcon}
              width={20}
              height={20}
              aria-hidden="true"
              priority
            />
            <span className={styles.brandText}>HOPY</span>
          </div>

          <nav aria-label="Footer links" className={styles.links}>
            <Link href="/terms" className={styles.link}>
              Terms
            </Link>
            <Link href="/privacy" className={styles.link}>
              Privacy
            </Link>
            <Link href="/commerce" className={styles.link}>
              Commerce
            </Link>
            <Link href="/contact" className={styles.link}>
              Contact
            </Link>
          </nav>
        </div>

        <div className={styles.bottomRow}>
          <small className={styles.copy}>© {currentYear} HOPY</small>
          <div aria-hidden="true" className={styles.trailing} />
        </div>
      </div>
    </footer>
  );
}

/* /components/home/HomeFooter.tsx */
/* 【今回このファイルで修正したこと】
存在しない HopyCompassIcon の import と使用をやめ、
正式なブランド画像 /brand/hopy-icon-master.svg を next/image で表示する形へ戻しました。
*/
/* このファイルの正式役割
サイト下部のフッターを表示するファイルです。
ブランド表示、フッターリンク、コピーライト表示だけを担います。
*/