import Link from "next/link";
import { Icon } from "./Icon";
import styles from "./workspace.module.css";

export function PageHeading({ title, description, showNewRequest = true }: { title: string; description: string; showNewRequest?: boolean }) {
  return <div className={styles.pageHeading}>
    <div><p className={styles.eyebrow}>YOUR LAB, A LITTLE MORE CONNECTED</p><h1>{title}</h1><p>{description}</p></div>
    {showNewRequest && <Link href="/workspace/requests/new" className={styles.primaryButton}><Icon name="plus" /> New request</Link>}
  </div>;
}
