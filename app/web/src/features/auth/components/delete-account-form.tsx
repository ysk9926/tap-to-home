"use client";

import { useActionState, useState } from "react";
import { MarkerButton } from "@/components/marker-button";
import { TextField } from "@/components/text-field";
import { deleteAccountAction } from "../actions";
import { type ActionState } from "../name-rules";

export function DeleteAccountForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteAccountAction, {});
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === username.toLowerCase();

  return (
    <form action={action} className="mt-6">
      <TextField
        label="확인"
        hint={`@${username} 를 그대로 입력`}
        name="confirmUsername"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        error={state.error}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <MarkerButton type="submit" className="mt-4 w-full" disabled={!matches || pending}>
        {pending ? "탈퇴하는 중…" : "계정 탈퇴"}
      </MarkerButton>
    </form>
  );
}
