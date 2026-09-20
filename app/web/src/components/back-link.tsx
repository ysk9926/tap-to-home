import Link from "next/link";
import { BackArrowIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * 세부 화면 맨 위의 뒤로가기. 브라우저 히스토리(router.back) 대신 상위 화면을 href 로 못박는다.
 * 푸시·딥링크로 세부 화면에 바로 들어온 경우에도 돌아갈 곳이 있어야 하기 때문이다.
 * 탭 높이(44px)는 줄노트 한 칸 + 여유. 라벨은 돌아갈 화면 이름을 쓴다.
 */
export function BackLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-ml-1 -mt-1 mb-0.5 inline-flex h-11 items-center gap-1.5 self-start pr-3 font-note text-lg text-pencil-soft",
        className,
      )}
    >
      <BackArrowIcon className="wobble shrink-0" />
      {label}
    </Link>
  );
}
