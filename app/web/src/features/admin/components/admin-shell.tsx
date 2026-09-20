"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { adminAuthClient } from "@/lib/admin-auth/client";
import type { AdminIdentity } from "@/features/admin/types";
import { notifyAdminSessionEnded, useAdminQueryControl } from "./admin-query-provider";
import styles from "./admin.module.css";

const navigation: ReadonlyArray<{ href: string; label: string; glyph: string; child?: boolean }> = [
  { href: "/admin", label: "전체 현황", glyph: "●" },
  { href: "/admin/analytics", label: "접속·재방문", glyph: "↗" },
  { href: "/admin/engagement", label: "레이스·소셜", glyph: "⌁" },
  { href: "/admin/users", label: "사용자 관리", glyph: "◎" },
  { href: "/admin/audit", label: "관리 이력", glyph: "└", child: true },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  if (href === "/admin/users") return pathname.startsWith("/admin/users");
  return pathname.startsWith(href);
}

function NavLinks({ pathname, mobile = false }: { pathname: string; mobile?: boolean }) {
  return navigation.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
      className={`${styles.navLink} ${item.child && !mobile ? styles.navChild : ""} ${isActive(pathname, item.href) ? styles.navLinkActive : ""}`}
    >
      {!mobile && <span className={styles.navGlyph} aria-hidden="true">{item.glyph}</span>}
      {item.label}
    </Link>
  ));
}

export function AdminShell({ admin, children }: { admin: AdminIdentity; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { purge } = useAdminQueryControl();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      const result = await adminAuthClient.signOut();
      if (result.error) throw new Error("Sign-out failed");
      await purge();
      notifyAdminSessionEnded();
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setSignOutError("로그아웃하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
      setSigningOut(false);
    }
  }

  useEffect(() => {
    const verifySession = () => {
      void adminAuthClient.getSession().then(({ data }) => {
        if (!data) void purge().finally(() => router.replace("/admin/login"));
      }).catch(() => void purge().finally(() => router.replace("/admin/login")));
    };
    const handlePageHide = () => {
      void purge();
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      void purge().then(() => adminAuthClient.getSession()).then(({ data }) => {
        if (!data) router.replace("/admin/login");
        else router.refresh();
      }).catch(() => router.replace("/admin/login"));
    };
    window.addEventListener("focus", verifySession);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("focus", verifySession);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [purge, router]);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/admin" className={styles.brand}>
          <span className={styles.brandEyebrow}>Tap to Home</span>
          <span className={styles.brandTitle}>운영 노트</span>
        </Link>
        <nav className={styles.nav} aria-label="관리자 메뉴">
          <NavLinks pathname={pathname} />
        </nav>
        <div className={styles.sidebarFooter}>
          <span className={styles.adminName} title={admin.username}>{admin.name} · {admin.username}</span>
          <button className={styles.logoutButton} type="button" onClick={signOut} disabled={signingOut}>
            {signingOut ? "정리하는 중…" : "관리자 로그아웃"}
          </button>
        </div>
      </aside>

      <div>
        <header className={styles.mobileHeader}>
          <div className={styles.mobileBrand}>
            <Link href="/admin" className={styles.brandTitle}>운영 노트</Link>
            <button className={styles.logoutButton} type="button" onClick={signOut} disabled={signingOut}>로그아웃</button>
          </div>
          <nav className={`${styles.nav} ${styles.mobileNav}`} aria-label="관리자 메뉴">
            <NavLinks pathname={pathname} mobile />
          </nav>
        </header>
        <main className={styles.content}>
          {signOutError && <p className={styles.error} role="alert">{signOutError}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}
