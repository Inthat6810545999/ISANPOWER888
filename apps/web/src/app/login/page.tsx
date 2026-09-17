import Link from "next/link";
import { LoginForm } from "./LoginForm";
import styles from "@/components/workspace/workspace.module.css";
const errors: Record<string, string> = {
  google_unavailable: "Google sign-in is not available yet. Please try again later.",
  google_failed: "Google sign-in could not be verified. Please start again.",
  google_cancelled: "Google sign-in was cancelled. You can try again or continue as a guest.",
  google_expired: "Your sign-in attempt expired. Please start again.",
  google_link: "This email already has an account. Contact the lab team to link Google securely.",
  account_inactive: "This account is inactive. Please contact the lab team.",
};
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className={styles.loginPage}><section className={styles.loginCard}>
    <div className={styles.dialogHeader}><p className={styles.eyebrow}>ISANPOWER / LAB WORKSPACE</p><h1>Welcome to your lab.</h1><p>For Lab Members, Teaching Assistants, and Lab Managers.</p></div>
    <div className={styles.requestForm}>
      {error && errors[error] && <p className={styles.error} role="alert">{errors[error]}</p>}
      <a className={styles.primaryButton} href="/auth/google/start">Sign in with Google</a>
      <Link className={styles.secondaryButton} href="/open-house">Continue as Guest</Link>
      <p className={styles.helper}>New accounts wait for lab membership approval. Guests can explore Open House and public content.</p>
    </div>
    {process.env.NODE_ENV !== "production" && <details className={styles.localLogin}><summary>Local demo account</summary><LoginForm /></details>}
  </section></main>;
}
