import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/features/admin/components/admin-login-form";
import styles from "@/features/admin/components/admin.module.css";
import { getAdmin } from "@/lib/admin-auth/current-admin";

export default async function AdminLoginPage() {
  const admin = await getAdmin(await headers());
  if (admin) redirect("/admin");

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard} aria-labelledby="admin-login-title">
        <p className={styles.eyebrow}>Tap to Home · 관리자</p>
        <h1 id="admin-login-title" className={styles.loginTitle}>오늘의 운영 노트</h1>
        <p className={styles.loginNote}>마스터 계정으로만 열 수 있어요.</p>
        <AdminLoginForm />
      </section>
    </main>
  );
}
