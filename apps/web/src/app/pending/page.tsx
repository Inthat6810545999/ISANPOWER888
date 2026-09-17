import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/session";
import { hasInternalAccess, sessionHome } from "@/lib/session-types";
import { SignOut } from "@/components/workspace/SignOut";
import styles from "@/components/workspace/workspace.module.css";
export default async function PendingPage() {
  const user = await sessionUser();
  if (!user) redirect("/login");
  if (hasInternalAccess(user)) redirect(sessionHome(user));
  return <main className={styles.loginPage}><section className={styles.loginCard}>
    <div className={styles.dialogHeader}><p className={styles.eyebrow}>MEMBERSHIP / PENDING</p><h1>Waiting for approval</h1>
      <p>You are signed in as {user.email}.</p></div>
    <div className={styles.requestForm}><p>Your identity has been verified. Your lab membership and internal role have not been assigned yet.</p>
      <p>You can explore Open House while you wait. Contact the lab team if you need help with access.</p>
      <Link className={styles.secondaryButton} href="/open-house">Explore Open House</Link>
      <a className={styles.secondaryButton} href="/pending">Check membership status</a>
      <SignOut />
    </div>
  </section></main>;
}
