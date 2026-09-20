"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminAuthClient } from "@/lib/admin-auth/client";
import { useAdminQueryControl } from "./admin-query-provider";
import styles from "./admin.module.css";

export function AdminLoginForm() {
  const router = useRouter();
  const { purge } = useAdminQueryControl();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await adminAuthClient.signIn.username({ username: username.trim(), password });
      if (result.error) {
        const status = result.error.status ?? 0;
        if (status === 429) setError("로그인 시도가 많아요. 1분 뒤 다시 시도해 주세요.");
        else if (status === 503) setError("관리자 계정 준비가 필요해요. 서버 초기화 상태를 확인해 주세요.");
        else if (status >= 500 || status === 0) setError("서버에서 로그인 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
        else if (status === 400 || status === 401 || status === 403) setError("아이디 또는 비밀번호를 확인해 주세요.");
        else setError("로그인 요청을 완료하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
        return;
      }
      await purge();
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("연결이 원활하지 않아요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.loginForm} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="admin-username">마스터 아이디</label>
        <input
          id="admin-username"
          className={styles.input}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          minLength={3}
          maxLength={30}
          required
          autoFocus
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="admin-password">비밀번호</label>
        <input
          id="admin-password"
          className={styles.input}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          minLength={12}
          maxLength={128}
          required
        />
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "운영 노트 여는 중…" : "관리자 로그인"}
      </button>
    </form>
  );
}
