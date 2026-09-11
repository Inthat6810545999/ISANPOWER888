"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MOCK_MEMBER } from "@/features/requests/mock-data";
import { useRequests } from "@/features/requests/RequestsProvider";
import { Icon } from "./Icon";
import styles from "./workspace.module.css";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const isNew = path.endsWith("/new");
  const person = MOCK_MEMBER;
  const { requests, notice, dismissNotice } = useRequests();
  const title = isNew ? "Create a request" : "My requests";

  return <div className={styles.workspace}>
    <a className={styles.skipLink} href="#workspace-content">Skip to content</a>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/workspace"><span className={styles.logo}>IP</span>
        <span><strong>ISANPOWER</strong><small>LAB / SHARED WORKSPACE</small></span>
      </Link>
      <div className={styles.labCard}><span className={styles.labMark}>IL</span>
        <div><strong>ISANPOWER Lab</strong><small>Shared workspace</small></div>
      </div>
      <p className={styles.navLabel}>WORKSPACE</p>
      <nav aria-label="Workspace navigation" className={styles.nav}>
        <Link href="/workspace/my-requests" aria-current={!isNew ? "page" : undefined}>
          <Icon name="requests" /> My requests <span className={styles.navCount}>{requests.filter((r) => r.requester.id === MOCK_MEMBER.id).length}</span>
        </Link>
        <Link href="/workspace/requests/new" aria-current={isNew ? "page" : undefined}>
          <Icon name="plus" /> New request
        </Link>
      </nav>
      <div className={styles.sidebarNote}><small>ITERATION 02</small><p>One place for<br />your<br />lab’s next steps.</p><span /></div>
      <div className={styles.profile}><span className={styles.avatar}>{person.initials}</span>
        <div><strong>{person.name}</strong><small>Lab Member · Demo</small></div>
      </div>
    </aside>
    <div className={styles.mainColumn}>
      <header className={styles.topbar}><span>Workspace <span className={styles.separator}>/</span> <strong>{title}</strong></span>
        <div className={styles.topbarRight}><span className={styles.demoLabel}>● Demo workspace</span><span className={styles.avatar}>{person.initials}</span></div>
      </header>
      <main id="workspace-content" className={styles.content}>
        {notice && <div className={styles.notice} role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={dismissNotice}><Icon name="close" /></button></div>}
        {children}
        <footer className={styles.footer}><span>ISANPOWER Lab · Make every request count.</span><span>Sample data · Resets on refresh</span></footer>
      </main>
    </div>
  </div>;
}
