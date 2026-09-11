import Link from "next/link";
import type { ReactNode } from "react";
import { MOCK_TA, MOCK_REQUESTS } from "@/features/requests/mock-data";
import { Icon } from "@/components/workspace/Icon";
import styles from "@/components/workspace/workspace.module.css";

/** Separate TA demo shell. Add real session/role checks in the TA server layout later. */
export function TaShell({ children }: { children: ReactNode }) {
  return <div className={`${styles.workspace} ${styles.taWorkspace}`}>
    <a className={styles.skipLink} href="#ta-content">Skip to content</a>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/ta"><span className={styles.logo}>IP</span>
        <span><strong>ISANPOWER</strong><small>LAB / TA CONSOLE</small></span>
      </Link>
      <div className={styles.labCard}><span className={styles.labMark}><Icon name="shield" /></span>
        <div><strong>TA workspace</strong><small>Request management</small></div>
      </div>
      <p className={styles.navLabel}>MANAGEMENT</p>
      <nav aria-label="TA navigation" className={styles.nav}>
        <Link href="/ta/queue" aria-current="page"><Icon name="queue" /> TA Queue <span className={styles.navCount}>{MOCK_REQUESTS.length}</span></Link>
      </nav>
      <div className={styles.sidebarNote}><small>US-3 / DEMO</small><p>A clear queue.<br />A shared view.<br />A next step.</p><span /></div>
      <div className={styles.profile}><span className={styles.avatar}>{MOCK_TA.initials}</span>
        <div><strong>{MOCK_TA.name}</strong><small>Teaching Assistant · Demo</small></div>
      </div>
    </aside>
    <div className={styles.mainColumn}>
      <header className={styles.topbar}><span>TA Console <span className={styles.separator}>/</span><strong>Request queue</strong></span>
        <div className={styles.topbarRight}><span className={styles.demoLabel}>● Demo console</span><span className={styles.avatar}>{MOCK_TA.initials}</span></div>
      </header>
      <main id="ta-content" className={styles.content}>
        {children}
        <footer className={styles.footer}><span>ISANPOWER Lab · TA Console</span><span>Sample data · Preview only</span></footer>
      </main>
    </div>
  </div>;
}
