"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MarkerButton } from "@/components/marker-button";
import { TextField } from "@/components/text-field";
import { signIn } from "@/lib/auth/client";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await signIn.username({ username: username.trim(), password });
    setPending(false);
    if (error) {
      setError("아이디 또는 비밀번호가 틀렸어요");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
      <TextField
        label="아이디"
        autoComplete="username"
        autoCapitalize="none"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <TextField
        label="비밀번호"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error ?? undefined}
        required
      />
      <MarkerButton type="submit" disabled={pending} className="mt-2">
        {pending ? "들어가는 중…" : "들어가기"}
      </MarkerButton>
    </form>
  );
}
