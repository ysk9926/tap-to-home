"use client";

import { unstable_rethrow } from "next/navigation";
import { useId, useOptimistic, useState, useTransition } from "react";
import { updateRaceDisplayAction } from "../actions";

type Props = {
  showTopFriendRails: boolean;
  saveAction?: (formData: FormData) => Promise<void>;
};

export function FriendRailsSwitch({ showTopFriendRails, saveAction = updateRaceDisplayAction }: Props) {
  const descriptionId = useId();
  const [visible, setVisible] = useOptimistic(showTopFriendRails);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function save(next: boolean) {
    const data = new FormData();
    if (next) data.set("showTopFriendRails", "on");
    setFailed(false);
    startTransition(async () => {
      setVisible(next);
      try {
        await saveAction(data);
      } catch (error) {
        unstable_rethrow(error);
        setFailed(true);
        // useOptimistic restores the saved value when the transition ends.
      }
    });
  }

  return (
    <div className="border-b-[1.5px] border-dashed border-pencil-soft py-3.5">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 font-ui text-xl font-bold">
        <span>친구 TOP2 레일 표시</span>
        <span className="flex shrink-0 items-center gap-2">
          <span aria-hidden="true" className="font-note text-lg font-normal text-pencil-soft">
            {visible ? "켜짐" : "꺼짐"}
          </span>
          <input
            type="checkbox"
            role="switch"
            name="showTopFriendRails"
            checked={visible}
            disabled={pending}
            aria-describedby={descriptionId}
            onChange={(event) => save(event.currentTarget.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-7 w-12 rounded-sketch border-2 border-marker bg-paper peer-checked:bg-marker peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-marker peer-disabled:opacity-50"
          >
            <span className={`absolute top-1 block size-4 rounded-full ${visible ? "right-1 bg-paper" : "left-1 bg-pencil-soft"}`} />
          </span>
        </span>
      </label>
      <p id={descriptionId} className="font-note text-base text-pencil-soft">
        메인 화면에 친구 상위 두 명의 레일을 보여줘요
      </p>
      {pending && <p role="status" className="font-note text-base text-pencil-soft">저장 중…</p>}
      {failed && (
        <p role="alert" className="font-note text-base text-margin">
          설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요
        </p>
      )}
    </div>
  );
}
