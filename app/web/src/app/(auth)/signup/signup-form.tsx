"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MarkerButton } from "@/components/marker-button";
import { TextField } from "@/components/text-field";
import { signUp } from "@/lib/auth/client";
import { placeholderEmail } from "@/lib/auth/placeholder-email";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/i;

type FieldErrors = { username?: string; name?: string; password?: string };

function validate(username: string, name: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!USERNAME_PATTERN.test(username)) errors.username = "영문·숫자·_ 로 3~20자";
  if (name.length < 1 || name.length > 12) errors.name = "1~12자";
  if (password.length < 8) errors.password = "8자 이상";
  return errors;
}

export function SignupForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedName = name.trim();
    const next = validate(trimmedUsername, trimmedName, password);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    const { error } = await signUp.email({
      email: placeholderEmail(trimmedUsername),
      password,
      name: trimmedName,
      username: trimmedUsername,
      displayUsername: trimmedUsername,
    });
    setPending(false);
    if (error) {
      setErrors({
        username:
          error.code === "USERNAME_IS_ALREADY_TAKEN" ? "이미 쓰는 아이디예요" : (error.message ?? "가입에 실패했어요"),
      });
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
      <TextField
        label="아이디"
        hint="영문·숫자·_ 3~20자"
        autoComplete="username"
        autoCapitalize="none"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={errors.username}
        required
      />
      <TextField
        label="닉네임"
        hint="레이스에서 보이는 이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        required
      />
      <TextField
        label="비밀번호"
        hint="8자 이상"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        required
      />
      <MarkerButton type="submit" disabled={pending} className="mt-2">
        {pending ? "만드는 중…" : "만들고 시작하기"}
      </MarkerButton>
    </form>
  );
}
