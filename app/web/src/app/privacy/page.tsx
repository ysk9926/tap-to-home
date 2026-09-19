import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Note, Paper, ScreenTitle } from "@/components/paper";

export const metadata: Metadata = {
  title: "개인정보 처리방침 · Tap to Home",
  description: "Tap to Home 이 수집하는 개인정보와 처리 방식",
};

/** 시행일. 내용을 고치면 이 날짜도 함께 올린다. */
const EFFECTIVE_DATE = "2026년 9월 19일";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-ui text-[19px] font-bold leading-snug">{title}</h2>
      <div className="mt-2 space-y-2 font-note text-lg leading-relaxed text-pencil-soft">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <Paper className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-[420px] px-3 pt-10 pb-16">
        <ScreenTitle>개인정보 처리방침</ScreenTitle>
        <Note className="mt-2">시행일 {EFFECTIVE_DATE}</Note>

        <Section title="1. 무엇을 모으나요">
          <p>
            Tap to Home 은 서비스에 꼭 필요한 것만 받습니다. 이메일 주소와 전화번호는 받지 않습니다.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>아이디</b> — 가입할 때 직접 정합니다. 친구가 나를 찾을 때 쓰는 검색어입니다.
            </li>
            <li>
              <b>비밀번호</b> — 되돌릴 수 없는 형태로 바꿔 저장합니다. 원래 값은 저장하지 않습니다.
            </li>
            <li>
              <b>닉네임</b> — 레이스 화면과 친구 목록에 보이는 이름입니다.
            </li>
            <li>
              <b>탭 기록</b> — 버튼을 누른 시각과 횟수. 졸라맨을 움직이고 하루 칭호를 정하는 데 씁니다.
            </li>
            <li>
              <b>친구 관계</b> — 내가 등록한 친구와 나를 등록한 친구 목록.
            </li>
            <li>
              <b>퇴근 신호</b> — 친구에게 보내거나 받은 신호의 시각과 읽음 여부.
            </li>
            <li>
              <b>접속 기록</b> — 로그인 상태를 유지하기 위해 접속 IP 주소와 브라우저 정보를 세션에
              함께 보관합니다.
            </li>
          </ul>
          <p>
            가입할 때 내부적으로 아이디를 이용한 형식상의 주소를 만들어 쓰지만, 실제 메일함과
            연결되지 않으며 화면에 나타나지 않습니다.
          </p>
        </Section>

        <Section title="2. 어디에 쓰나요">
          <p>
            모은 정보는 아래 목적에만 씁니다. 광고를 붙이거나 이용자를 추적하지 않고, 다른 회사의
            추적 도구를 심지 않습니다.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>로그인 상태를 유지하고 본인을 확인합니다.</li>
            <li>아이디로 친구를 찾아 서로 등록합니다.</li>
            <li>탭 횟수에 따라 캐릭터를 움직이고 친구와의 순위를 보여 줍니다.</li>
            <li>하루가 끝나면 그날의 기록으로 칭호를 정해 도감에 쌓습니다.</li>
            <li>친구가 보낸 퇴근 신호를 전달합니다.</li>
          </ul>
        </Section>

        <Section title="3. 누구에게 보이나요">
          <p>
            내 닉네임과 오늘의 탭 횟수, 캐릭터 위치는 <b>내가 등록한 친구에게만</b> 보입니다. 모르는
            사람에게 공개되는 정보는 없습니다.
          </p>
          <p>
            아이디는 친구를 찾는 검색어이므로, 상대가 내 아이디를 정확히 알고 있으면 나를 검색해
            등록할 수 있습니다.
          </p>
          <p>
            법령에 따른 요청이 없는 한 어떤 정보도 제3자에게 팔거나 넘기지 않습니다.
          </p>
        </Section>

        <Section title="4. 어디에 보관하나요">
          <p>
            정보는 Supabase 가 운영하는 데이터베이스에 저장되고, 서비스는 Vercel 에서 실행됩니다. 두
            곳 모두 서비스를 돌리기 위한 기반 시설이며, 저장된 내용을 자기 목적으로 쓰지 않습니다.
          </p>
          <p>기기와 서버 사이의 통신은 모두 암호화된 연결로 주고받습니다.</p>
        </Section>

        <Section title="5. 얼마나 갖고 있나요">
          <p>
            계정이 살아 있는 동안 보관하고, 계정을 지우면 탭 기록, 친구 관계, 신호, 칭호까지 함께
            지워집니다. 따로 사본을 남기지 않습니다.
          </p>
        </Section>

        <Section title="6. 내 정보를 어떻게 하나요">
          <p>
            열람, 수정, 삭제를 요청할 수 있습니다. 아래 주소로 아이디와 함께 알려 주시면 처리한 뒤
            회신합니다.
          </p>
        </Section>

        <Section title="7. 어린이의 개인정보">
          <p>
            만 14세 미만 어린이를 대상으로 하지 않으며, 해당 연령의 정보를 의도적으로 모으지
            않습니다. 확인되면 지우겠습니다.
          </p>
        </Section>

        <Section title="8. 바뀔 때">
          <p>
            내용이 바뀌면 이 쪽의 시행일을 고쳐 알립니다. 중요한 변경은 앱 안에서 따로 알려
            드립니다.
          </p>
        </Section>

        <Section title="9. 문의">
          <p>
            <a
              className="underline decoration-dotted underline-offset-4"
              href="mailto:pooolingai7@proton.me"
            >
              pooolingai7@proton.me
            </a>
          </p>
        </Section>

        <div className="mt-10">
          <Link
            href="/"
            className="font-note text-lg underline decoration-dotted underline-offset-4"
          >
            ← 돌아가기
          </Link>
        </div>
      </div>
    </Paper>
  );
}
