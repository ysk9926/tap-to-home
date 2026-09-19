"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MarkerButton } from "@/components/marker-button";
import { TextField } from "@/components/text-field";
import { authErrorMessage, NETWORK_ERROR, type AuthErrorMessage } from "@/lib/auth/auth-error";
import { signIn } from "@/lib/auth/client";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<AuthErrorMessage | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFailure(null);
    setPending(true);
    try {
      const { error } = await signIn.username({ username: username.trim(), password });
      if (error) {
        setFailure(authErrorMessage(error));
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      // 연결이 끊기면 fetch 가 응답 없이 그대로 throw 한다
      setFailure(NETWORK_ERROR);
    } finally {
      // 실패해도 버튼은 반드시 돌아온다 (F0-1)
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
      <TextField
        label="아이디"
        autoComplete="username"
        autoCapitalize="none"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={failure?.field === "username" ? failure.message : undefined}
        required
      />
      <TextField
        label="비밀번호"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={failure?.field === "password" ? failure.message : undefined}
        required
      />
      {failure && failure.field === null && (
        <p role="alert" className="font-note text-base text-margin">
          {failure.message}
        </p>
      )}
      <MarkerButton type="submit" disabled={pending} className="mt-2">
        {pending ? "들어가는 중…" : "들어가기"}
      </MarkerButton>
    </form>
  );
}
