// /components/home/HomeFooter.tsx
import Link from "next/link";
import HopyCompassIcon from "@/components/icons/HopyCompassIcon";
import styles from "./HomeFooter.module.css";

export default function HomeFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer aria-label="Site footer" className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <div className={styles.brand}>
            <HopyCompassIcon
              className={styles.mark}
              width={18}
              height={18}
              aria-hidden="true"
              title=""
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