"use client";

import { unstable_rethrow } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { updateNotifyAction } from "../actions";

type Props = { notifySignal: boolean; notifySettlement: boolean };

/**
 * 알림 수신 설정. 체크를 바꾸면 곧바로 저장한다 — 저장 버튼을 따로 두면 안 누르고 나간다.
 * 인앱 토스트와 진입 다이얼로그는 이 설정과 무관하다 (앱을 켜 둔 화면이다).
 *
 * 저장에 실패하면 체크를 원래대로 되돌린다. 켜진 채로 두면 "껐다" 고 믿는데 알림이 계속
 * 오는 상태가 되고, 사용자는 앱이 설정을 무시한다고 여긴다 — 알림 설정에서 제일 나쁜 실패다.
 */
export function NotifySwitches({ notifySignal, notifySettlement }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function save() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    // 되돌릴 때 쓸 직전 상태. FormData 는 체크된 것만 담는다
    const sent = {
      notifySignal: data.get("notifySignal") === "on",
      notifySettlement: data.get("notifySettlement") === "on",
    };

    setFailed(false);
    startTransition(async () => {
      try {
        await updateNotifyAction(data);
      } catch (error) {
        // 세션이 끊겼으면 액션이 redirect("/login") 을 던진다. 그건 실패가 아니라 이동이므로
        // 삼키면 안 된다 — Next 가 처리하도록 그대로 올려보낸다.
        unstable_rethrow(error);
        setFailed(true);
        const signal = form.elements.namedItem("notifySignal");
        const settlement = form.elements.namedItem("notifySettlement");
        if (signal instanceof HTMLInputElement) signal.checked = !sent.notifySignal;
        if (settlement instanceof HTMLInputElement) settlement.checked = !sent.notifySettlement;
      }
    });
  }

  return (
    <form ref={formRef} className="mt-4 flex flex-col gap-2" onChange={save}>
      <label className="flex items-center justify-between font-ui text-xl font-bold">
        퇴근 신호 알림
        <input
          type="checkbox"
          name="notifySignal"
          defaultChecked={notifySignal}
          disabled={pending}
          className="size-5 accent-marker"
        />
      </label>
      <label className="flex items-center justify-between font-ui text-xl font-bold">
        정산 결과 알림
        <input
          type="checkbox"
          name="notifySettlement"
          defaultChecked={notifySettlement}
          disabled={pending}
          className="size-5 accent-marker"
        />
      </label>
      {failed && (
        <p role="alert" className="font-note text-base text-margin">
          설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요
        </p>
      )}
      <p className="font-note text-base text-pencil-soft">
        앱을 켜 두었을 때 보이는 화면은 이 설정과 상관없이 나와요
      </p>
    </form>
  );
}
