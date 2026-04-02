import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.wrap}>
      <div className={styles.inner}>
        <div className={styles.left}>
          © {new Date().getFullYear()} HOPY
        </div>
        <div className={styles.right}>
          No clutter. Just thinking.
        </div>
      </div>
    </footer>
  );
}
