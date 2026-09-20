"use client";

import { useRef } from "react";
import { updateNotifyAction } from "../actions";

type Props = { notifySignal: boolean; notifySettlement: boolean };

/**
 * 알림 수신 설정. 체크를 바꾸면 곧바로 저장한다 — 저장 버튼을 따로 두면 안 누르고 나간다.
 * 인앱 토스트와 진입 다이얼로그는 이 설정과 무관하다 (앱을 직접 열었을 때의 화면이다).
 */
export function NotifySwitches({ notifySignal, notifySettlement }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={updateNotifyAction}
      className="mt-4 flex flex-col gap-2"
      onChange={() => formRef.current?.requestSubmit()}
    >
      <label className="flex items-center justify-between font-ui text-xl font-bold">
        퇴근 신호 알림
        <input type="checkbox" name="notifySignal" defaultChecked={notifySignal} className="size-5 accent-marker" />
      </label>
      <label className="flex items-center justify-between font-ui text-xl font-bold">
        정산 결과 알림
        <input type="checkbox" name="notifySettlement" defaultChecked={notifySettlement} className="size-5 accent-marker" />
      </label>
      <p className="font-note text-base text-pencil-soft">
        앱을 켜 두었을 때 보이는 화면은 이 설정과 상관없이 나와요
      </p>
    </form>
  );
}
