"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { displayPerson } from "@/lib/session-types";
import { SignOut } from "./SignOut";
import { useRequests } from "@/features/requests/RequestsProvider";
import { Icon } from "./Icon";
import styles from "./workspace.module.css";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const isNew = path.endsWith("/new");

  const { user, requests, notice, dismissNotice } = useRequests();
  const person = displayPerson(user);
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
          <Icon name="requests" /> My requests <span className={styles.navCount}>{requests.filter((r) => r.requester.id === user.email).length}</span>
        </Link>
        <Link href="/workspace/requests/new" aria-current={isNew ? "page" : undefined}>
          <Icon name="plus" /> New request
        </Link>
      </nav>
      <div className={styles.sidebarNote}><small>ITERATION 02</small><p>One place for<br />your<br />lab’s next steps.</p><span /></div>
      <div className={styles.profile}><span className={styles.avatar}>{person.initials}</span>
        <div><strong>{person.name}</strong><small>Lab Member</small></div>
      </div>
    </aside>
    <div className={styles.mainColumn}>
      <header className={styles.topbar}><span>Workspace <span className={styles.separator}>/</span> <strong>{title}</strong></span>
        <div className={styles.topbarRight}><span className={styles.demoLabel}>Member session</span><span className={styles.avatar}>{person.initials}</span></div>
      </header>
      <main id="workspace-content" className={styles.content}>
        {notice && <div className={styles.notice} role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={dismissNotice}><Icon name="close" /></button></div>}
        <div className={styles.sessionBar}><span>{user.email}</span><SignOut /></div>
        {children}
        <footer className={styles.footer}><span>ISANPOWER Lab · Make every request count.</span><span>Shared requests · Saved locally</span></footer>
      </main>
    </div>
  </div>;
}
