import Link from "next/link";
import { Note, ScreenTitle } from "@/components/paper";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <>
      <ScreenTitle>아이디 만들기</ScreenTitle>
      <Note>친구는 이 아이디로 나를 찾아요</Note>
      <SignupForm />
      <p className="mt-6 font-note text-xl text-pencil">
        이미 있어요?{" "}
        <Link href="/login" className="underline decoration-pencil underline-offset-4">
          들어가기
        </Link>
      </p>
    </>
  );
}
