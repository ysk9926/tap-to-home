"use client";

import { MarkerButton } from "@/components/marker-button";
import { MarkerDialog } from "@/components/marker-dialog";
import { Note } from "@/components/paper";
import type { FoundUser } from "../server/friends";

export type PendingConfirm = { kind: "remove" | "block"; user: FoundUser };

const COPY = {
  remove: {
    title: "친구를 삭제할까요?",
    body: (name: string) => `${name} 님이 레이스에서 사라져요. 나중에 다시 요청할 수 있어요.`,
    confirm: "삭제",
  },
  block: {
    title: "이 사람을 차단할까요?",
    body: (name: string) => `${name} 님은 나를 검색할 수 없고 요청도 보낼 수 없어요.`,
    confirm: "차단",
  },
} as const;

type Props = {
  pending: PendingConfirm | null;
  onCancel: () => void;
  onConfirm: (pending: PendingConfirm) => void;
};

/** 되돌릴 수 없는 삭제·차단 확인 (F0-4) */
export function ConfirmFriendDialog({ pending, onCancel, onConfirm }: Props) {
  const copy = pending ? COPY[pending.kind] : null;
  return (
    <MarkerDialog
      open={pending !== null}
      onClose={onCancel}
      title={copy?.title ?? ""}
      actions={
        <>
          <MarkerButton size="sm" variant="ghost" onClick={onCancel}>
            그만두기
          </MarkerButton>
          <MarkerButton size="sm" onClick={() => pending && onConfirm(pending)}>
            {copy?.confirm ?? ""}
          </MarkerButton>
        </>
      }
    >
      <Note>{pending && copy ? copy.body(pending.user.name) : ""}</Note>
    </MarkerDialog>
  );
}
