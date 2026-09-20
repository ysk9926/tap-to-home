"use client";

import { useState } from "react";
import { MarkerButton } from "@/components/marker-button";
import { TextField } from "@/components/text-field";
import { authErrorMessage, NETWORK_ERROR, type AuthErrorMessage } from "@/lib/auth/auth-error";
import { authClient } from "@/lib/auth/client";

const MIN_LENGTH = 8;

/**
 * 비밀번호 변경. better-auth 가 현재 비밀번호를 요구한다.
 * 다른 기기 세션은 유지한다 — 혼자 쓰는 앱이라 강제 로그아웃은 과하다.
 */
export function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<AuthErrorMessage | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const current = String(data.get("currentPassword") ?? "");
    const next = String(data.get("newPassword") ?? "");
    const confirm = String(data.get("confirmPassword") ?? "");

    setFailure(null);
    setDone(false);

    if (next.length < MIN_LENGTH) {
      setFailure({ field: "password", message: `새 비밀번호는 ${MIN_LENGTH}자 이상이어야 해요` });
      return;
    }
    if (next !== confirm) {
      setFailure({ field: "password", message: "새 비밀번호가 서로 달라요" });
      return;
    }

    setPending(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: false,
      });
      if (error) {
        setFailure(authErrorMessage(error));
        return;
      }
      form.reset();
      setDone(true);
    } catch {
      // 연결이 끊기면 fetch 가 응답 없이 그대로 throw 한다
      setFailure(NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <TextField
        label="지금 비밀번호"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        error={failure?.field === "password" ? failure.message : undefined}
        required
      />
      <TextField
        label="새 비밀번호"
        hint={`${MIN_LENGTH}자 이상`}
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
      />
      <TextField label="새 비밀번호 확인" name="confirmPassword" type="password" autoComplete="new-password" required />
      {failure && failure.field === null && (
        <p role="alert" className="font-note text-base text-margin">
          {failure.message}
        </p>
      )}
      {done && <p className="font-note text-base text-pencil-soft">비밀번호를 바꿨어요</p>}
      <MarkerButton type="submit" size="sm" disabled={pending}>
        {pending ? "바꾸는 중…" : "비밀번호 변경"}
      </MarkerButton>
    </form>
  );
}
