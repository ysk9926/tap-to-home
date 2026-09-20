import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminQueryProvider } from "@/features/admin/components/admin-query-provider";
import styles from "@/features/admin/components/admin.module.css";

export const metadata: Metadata = {
  title: "운영 노트 | Tap to Home",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.adminRoot}>
      <AdminQueryProvider>{children}</AdminQueryProvider>
    </div>
  );
}
