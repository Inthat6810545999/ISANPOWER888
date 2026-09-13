"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { displayPerson } from "@/lib/session-types";
import { SignOut } from "@/components/workspace/SignOut";
import { useRequests } from "@/features/requests/RequestsProvider";
import { Icon } from "@/components/workspace/Icon";
import styles from "@/components/workspace/workspace.module.css";

/** The server layout and API independently enforce the TA role. */
export function TaShell({ children }: { children: ReactNode }) {
  const { user, requests, notice, dismissNotice } = useRequests();
  const person = displayPerson(user);
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
        <Link href="/ta/queue" aria-current="page"><Icon name="queue" /> TA Queue <span className={styles.navCount}>{requests.length}</span></Link>
      </nav>
      <div className={styles.sidebarNote}><small>US-3 / DEMO</small><p>A clear queue.<br />A shared view.<br />A next step.</p><span /></div>
      <div className={styles.profile}><span className={styles.avatar}>{person.initials}</span>
        <div><strong>{person.name}</strong><small>Teaching Assistant</small></div>
      </div>
    </aside>
    <div className={styles.mainColumn}>
      <header className={styles.topbar}><span>TA Console <span className={styles.separator}>/</span><strong>Request queue</strong></span>
        <div className={styles.topbarRight}><span className={styles.demoLabel}>TA session</span><span className={styles.avatar}>{person.initials}</span></div>
      </header>
      <main id="ta-content" className={styles.content}>
        {notice && <div className={styles.notice} role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={dismissNotice}><Icon name="close" /></button></div>}
        <div className={styles.sessionBar}><span>{user.email}</span><SignOut /></div>
        {children}
        <footer className={styles.footer}><span>ISANPOWER Lab · TA Console</span><span>Shared requests · Saved locally</span></footer>
      </main>
    </div>
  </div>;
}
