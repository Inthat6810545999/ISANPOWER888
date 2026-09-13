import { LoginForm } from "./LoginForm";
import styles from "@/components/workspace/workspace.module.css";

export default function LoginPage() {
  return <main className={styles.loginPage}><section className={styles.loginCard}>
    <div className={styles.dialogHeader}><p className={styles.eyebrow}>ISANPOWER / LAB WORKSPACE</p><h1>Welcome to your lab.</h1><p>Sign in with your assigned account.</p></div>
    <LoginForm />
    <p className={styles.loginNote}>Your account determines your workspace and permissions. Local presentation accounts are for demonstration only.</p>
  </section></main>;
}
