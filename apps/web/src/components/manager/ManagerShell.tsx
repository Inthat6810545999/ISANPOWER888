"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRequests } from "@/features/requests/RequestsProvider";
import { displayPerson } from "@/lib/session-types";
import { SignOut } from "@/components/workspace/SignOut";
import styles from "@/components/workspace/workspace.module.css";

export function ManagerShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { user, notice, dismissNotice } = useRequests();
  const person = displayPerson(user);
  return <div className={`${styles.workspace} ${styles.managerWorkspace}`}>
    <a className={styles.skipLink} href="#manager-content">Skip to content</a>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/manager"><span className={styles.logo}>IP</span><span><strong>ISANPOWER</strong><small>LAB / MANAGER</small></span></Link>
      <div className={styles.labCard}><span className={styles.labMark}>LM</span><div><strong>Lab Manager</strong><small>Review and oversight</small></div></div>
      <p className={styles.navLabel}>MANAGEMENT</p>
      <nav className={styles.nav} aria-label="Lab Manager navigation">
        <Link href="/manager/approvals" aria-current={path === "/manager/approvals" ? "page" : undefined}>Request approvals</Link>
        <Link href="/manager/reports" aria-current={path === "/manager/reports" ? "page" : undefined}>Dashboard / Reports</Link>
      </nav>
      <div className={styles.sidebarNote}><small>REVIEW WITH CONTEXT</small><p>Clear decisions.<br />Recorded reasons.<br />A shared direction.</p><span /></div>
      <div className={styles.profile}><span className={styles.avatar}>{person.initials}</span><div><strong>{person.name}</strong><small>Lab Manager</small></div></div>
    </aside>
    <div className={styles.mainColumn}>
      <header className={styles.topbar}><strong>Lab Manager / {path.endsWith("reports") ? "Dashboard & Reports" : "Approvals"}</strong><span>Manager session</span></header>
      <main id="manager-content" className={styles.content}>
        <div className={styles.sessionBar}><span>{user.email}</span><SignOut /></div>
        {notice && <div className={styles.notice} role="status"><span>{notice}</span><button onClick={dismissNotice} aria-label="Dismiss notification">×</button></div>}
        {children}
        <footer className={styles.footer}><span>ISANPOWER Lab · Review and oversight</span><span>Work assignments remain with TAs</span></footer>
      </main>
    </div>
  </div>;
}
