import { redirect } from "next/navigation";

/**
 * 정산이 자정 자동으로 바뀌면서 이 화면은 /records 로 합쳐졌다 (ADR 0008).
 * 옛 푸시 알림과 북마크가 여기로 들어올 수 있어 리다이렉트만 남긴다.
 */
export default function TodayPage() {
  redirect("/records");
}
