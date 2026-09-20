import type { ReactNode } from "react";
import { Note } from "@/components/paper";

/** 시행일. 내용을 고치면 이 날짜도 함께 올린다. */
export const TERMS_EFFECTIVE_DATE = "2026년 9월 20일";

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

/** 이용약관 본문. 제목은 호출하는 페이지가 그린다 */
export function TermsBody() {
  return (
    <>
      <Note className="mt-2">시행일 {TERMS_EFFECTIVE_DATE}</Note>

      <Section title="1. 이 약관은">
        <p>
          Tap to Home(이하 &ldquo;서비스&rdquo;)을 쓰는 데 필요한 약속을 담고 있어요. 서비스에
          가입하면 이 약관에 동의한 것으로 봅니다.
        </p>
      </Section>

      <Section title="2. 서비스가 하는 일">
        <p>
          서비스는 하루 동안 &ldquo;퇴근하고 싶다&rdquo; 버튼을 누른 횟수를 기록하고, 친구와
          그 횟수를 견주어 보여주며, 하루가 끝나면 칭호를 드려요. 재미로 만든 서비스이고
          기록이 실제 근무 시간이나 성과를 뜻하지는 않아요.
        </p>
      </Section>

      <Section title="3. 계정">
        <p>
          아이디와 비밀번호로 가입해요. 비밀번호를 다른 사람에게 알려 주지 마세요. 계정으로
          일어난 일은 그 계정의 주인에게 책임이 있어요.
        </p>
        <p>
          닉네임과 아이디에 다른 사람을 괴롭히거나 오해하게 만드는 표현은 쓸 수 없어요.
        </p>
      </Section>

      <Section title="4. 하면 안 되는 일">
        <p>
          자동화 도구로 버튼을 대신 누르거나, 서비스를 망가뜨리려 하거나, 다른 사람의 계정에
          몰래 들어가려 하면 안 돼요. 이런 경우 계정 이용을 제한할 수 있어요.
        </p>
      </Section>

      <Section title="5. 서비스 변경과 중단">
        <p>
          개인이 만들어 운영하는 서비스라 기능이 바뀌거나 서비스가 멈출 수 있어요. 미리 알려
          드리도록 노력하지만, 예기치 못한 사정으로 그러지 못할 수도 있어요.
        </p>
      </Section>

      <Section title="6. 책임의 한계">
        <p>
          서비스는 있는 그대로 제공돼요. 기록이 사라지거나 알림이 늦게 도착해서 생긴 손해에
          대해 서비스는 법이 정한 범위 밖에서는 책임지지 않아요.
        </p>
      </Section>

      <Section title="7. 탈퇴">
        <p>
          마이페이지에서 언제든 탈퇴할 수 있어요. 탈퇴하면 로그인할 수 없고, 친구 목록과
          랭킹에서 사라져요. 같은 아이디로는 다시 가입할 수 없어요.
        </p>
      </Section>

      <Section title="8. 문의">
        <p>서비스에 대한 문의는 개인정보 처리방침에 적힌 연락처로 보내 주세요.</p>
      </Section>
    </>
  );
}
