// /components/site/SiteFooter.tsx
import React from "react";
import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer} role="contentinfo" aria-label="HOPY footer">
      <div className={styles.inner}>© {year} HOPY</div>
    </footer>
  );
}