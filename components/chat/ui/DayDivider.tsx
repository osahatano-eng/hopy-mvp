"use client";

import React from "react";
import styles from "./DayDivider.module.css";

function DayDividerBase({ label }: { label: string }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.line} />
      <div className={styles.label}>{label}</div>
      <div className={styles.line} />
    </div>
  );
}

const DayDivider = React.memo(DayDividerBase, (p, n) => p.label === n.label);

export default DayDivider;
