import Link from "next/link";
import styles from "@/components/workspace/workspace.module.css";
export default function OpenHousePage() {
  return <main className={styles.loginPage}><section className={styles.loginCard}>
    <div className={styles.dialogHeader}><p className={styles.eyebrow}>ISANPOWER / OPEN HOUSE</p><h1>Welcome, curious minds.</h1><p>A public introduction to our lab. No account required.</p></div>
    <div className={styles.requestForm}>
      <h2>Explore the lab</h2><p>Learn how lab members, teaching assistants, and lab managers coordinate equipment, shared spaces, and research support.</p>
      <h2>Plan your visit</h2><p>Open House dates and activities will be published here when available.</p>
      <p>Guest access is limited to public content. Internal requests and workspaces require approved lab membership.</p>
      <Link className={styles.secondaryButton} href="/">Explore our public website</Link>
      <Link className={styles.primaryButton} href="/login">Sign in to the lab</Link>
    </div>
  </section></main>;
}
