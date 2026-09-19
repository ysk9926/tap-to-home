import Link from "next/link";
import { Note, ScreenTitle } from "@/components/paper";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <>
      <ScreenTitle>퇴근 레이스에 들어가기</ScreenTitle>
      <Note>아이디와 비밀번호만 있으면 돼요</Note>
      <LoginForm />
      <p className="mt-6 font-note text-xl text-pencil">
        처음이에요?{" "}
        <Link href="/signup" className="underline decoration-pencil underline-offset-4">
          아이디 만들기
        </Link>
      </p>
    </>
  );
}
