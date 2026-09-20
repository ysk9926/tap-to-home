import { redirect } from "next/navigation";

/** 도감은 마이페이지 아래로 옮겼다 */
export default function CollectionPage() {
  redirect("/my/collection");
}
