import styles from "./landing.module.css";

/** One shared coordinate system keeps the steam attached to the flask on every screen. */
export function LabScene() {
  return (
    <div className={styles.sceneFrame} aria-hidden="true">
      <svg className={styles.labScene} viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient id="steam-fade" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#91816b" stopOpacity=".65" />
            <stop offset="65%" stopColor="#91816b" stopOpacity=".45" />
            <stop offset="100%" stopColor="#91816b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <image href="/images/landing/lab-hero.webp" width="1536" height="1024" />
        <g fill="none" stroke="url(#steam-fade)" strokeWidth="2.5" strokeLinecap="round">
          <path className={styles.steam} d="M1200 601 C1185 576 1221 560 1204 534 C1183 504 1175 485 1197 460 C1221 432 1216 417 1203 397" />
          <path className={`${styles.steam} ${styles.steamTwo}`} d="M1200 601 C1216 574 1189 555 1196 532 C1205 509 1235 493 1221 466 C1209 442 1188 426 1200 397" />
          <path className={`${styles.steam} ${styles.steamThree}`} d="M1200 601 C1192 581 1208 558 1217 536 C1227 511 1195 490 1190 466 C1185 444 1206 419 1200 397" />
        </g>
      </svg>
    </div>
  );
}
