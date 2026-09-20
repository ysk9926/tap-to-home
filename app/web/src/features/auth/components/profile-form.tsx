"use client";

import { useActionState } from "react";
import { MarkerButton } from "@/components/marker-button";
import { TextField } from "@/components/text-field";
import { NAME_MAX, NAME_MIN, updateNameAction, type ActionState } from "../actions";

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateNameAction, {});

  return (
    <form action={action} className="mt-4">
      <TextField
        label="닉네임"
        hint={`${NAME_MIN}~${NAME_MAX}자`}
        name="name"
        defaultValue={name}
        maxLength={NAME_MAX}
        error={state.error}
      />
      {state.ok && <p className="mt-1 font-note text-base text-pencil-soft">저장했어요</p>}
      <MarkerButton type="submit" size="sm" className="mt-2" disabled={pending}>
        {pending ? "저장 중…" : "닉네임 저장"}
      </MarkerButton>
    </form>
  );
}
