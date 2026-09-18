import { requireUser } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { SignOut } from "@/components/workspace/SignOut";
import { UserForm, type ManagedUser } from "./UserForm";
import styles from "./admin.module.css";

export default async function AdminPage() {
  const actor = await requireUser("admin");
  const { data: users } = await apiFetch<{ data: ManagedUser[] }>("/admin/users");
  return <main className={styles.page}>
    <header className={styles.header}><div><span>ISANPOWER / ADMINISTRATION</span><h1>User management</h1><p>Create accounts, assign roles and manage access to the lab.</p></div><div><p>{actor.name} · {actor.email}</p><SignOut /></div></header>
    <div className={styles.stats}><strong>{users.length} accounts</strong><span>{users.filter(u => u.active).length} active</span><span>{users.filter(u => !u.active).length} inactive</span></div>
    <div className={styles.columns}><section className={styles.card}><h2>Create account</h2><UserForm /></section>
    <section><h2>Accounts</h2><p>Role changes and deactivation sign the user out. Email addresses stay fixed to preserve request ownership.</p>
    {users.map(user => <details key={`${user.id}-${user.role}-${user.active}-${user.name}`} className={styles.card}>
      <summary><strong>{user.name}{user.id === actor.id ? " (you)" : ""}</strong><span>{user.email}</span><span>{user.role.replaceAll("_", " ")} · {user.active ? "Active" : "Inactive"}</span></summary>
      <UserForm user={user} self={user.id === actor.id} />
    </details>)}</section></div>
  </main>;
}
