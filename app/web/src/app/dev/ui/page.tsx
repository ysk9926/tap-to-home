import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BackLink } from "@/components/back-link";
import { BottomNav } from "@/components/bottom-nav";
import { Highlight } from "@/components/highlight";
import { BellIcon, CrownIcon, HouseIcon } from "@/components/icons";
import { MarkerBox } from "@/components/marker-box";
import { MarkerButton } from "@/components/marker-button";
import { Note, Paper, ScreenTitle } from "@/components/paper";
import { SignalToast } from "@/components/signal-toast";
import { SpeechBubble } from "@/components/speech-bubble";
import { TextField } from "@/components/text-field";
import { TitleBadge } from "@/components/title-badge";
import { StageLandmark } from "@/features/race/components/stage-landmark";
import { STAGES } from "@/features/race/stages";
import { RaceDemo, RaceSceneSheet, StickmanSheet, TapDemo } from "./demos";
import { ExampleScreens } from "./screens";

/**
 * 디자인 시스템 레퍼런스. 개발 환경에서만 열린다.
 * 기준 문서는 docs/design.md. 여기 보이는 것이 곧 컴포넌트의 실제 출력이다.
 */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <Paper marginLeft={40} className="min-h-full flex-1">
      <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-8">
        <header className="mb-8 flex flex-wrap items-end gap-x-8 gap-y-3">
          <h1 className="text-[40px] font-bold leading-none tracking-tight">
            Tap to Home UI
            <span className="ml-2.5 font-note text-2xl font-normal text-pencil-soft">
              줄노트 + 혼합 선 · /dev/ui
            </span>
          </h1>
          <div className="flex flex-wrap gap-5 font-note text-xl text-pencil">
            <span className="inline-flex items-center gap-2">
              <i className="inline-block w-9 border-t-[3px] border-marker" />
              UI 프레임 · 매직 3px
            </span>
            <span className="inline-flex items-center gap-2">
              <i className="inline-block w-9 border-t-[1.5px] border-pencil" />
              졸라맨 · 연필 1.7px
            </span>
            <span className="inline-flex items-center gap-2">
              <i className="inline-block h-2.5 w-9 bg-hilite-2 opacity-90" />
              형광펜 · 강조 하나
            </span>
          </div>
        </header>

        <nav className="mb-10 flex flex-wrap gap-x-4 gap-y-1 font-note text-xl text-pencil">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="underline decoration-line underline-offset-4 hover:decoration-pencil">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-14">
          <Section id="tokens" title="색 토큰" lead="종이·연필·매직 3톤. 강조는 형광펜 하나만.">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {TOKENS.map((t) => (
                <div key={t.name} className="flex items-center gap-2.5 text-[15px]">
                  <i
                    className="h-9 w-9 shrink-0 rounded-sketch-sm border-2 border-marker"
                    style={{ background: `var(${t.cssVar})` }}
                  />
                  <span>
                    {t.name}
                    <code className="block font-mono text-[11px] text-pencil-soft">
                      {t.tw} · {t.hex}
                    </code>
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section id="type" title="타이포" lead="Gaegu 가 제목·본문·수치, Nanum Pen Script 가 말풍선·메모. 둘 다 next/font 로 셀프호스팅.">
            <div className="flex flex-col gap-2">
              <TypeRow spec="ScreenTitle · Gaegu 700 · 26px">
                <ScreenTitle>오늘 퇴근하고 싶은 횟수</ScreenTitle>
              </TypeRow>
              <TypeRow spec="큰 수치 · Gaegu 700 · 88px · tabular">
                <span className="tabular text-[88px] font-bold leading-[.9] tracking-tight">23</span>
              </TypeRow>
              <TypeRow spec="본문 · Gaegu 400 · 18px">
                <p>버튼을 누를수록 내 졸라맨이 회사에서 집으로 먼저 퇴근한다.</p>
              </TypeRow>
              <TypeRow spec="Note · Nanum Pen Script · 20px · pencil-soft">
                <Note>9월 19일 금요일 · 아직 회사</Note>
              </TypeRow>
              <TypeRow spec="Highlight · 형광펜은 한 화면에 한 군데">
                <p className="text-[30px] font-bold">
                  <Highlight>마음만 이미 집에 있음</Highlight>
                </p>
              </TypeRow>
            </div>
          </Section>

          <Section id="frames" title="종이와 프레임" lead="Paper 가 줄노트 바탕, MarkerBox 가 매직 프레임. 테두리만 흔들림 필터를 받아 글자는 또렷하다.">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
              <MarkerBox className="p-4">
                <b>MarkerBox</b>
                <Note className="text-lg">variant=&quot;box&quot; · 기본 카드</Note>
              </MarkerBox>
              <MarkerBox lifted className="p-4">
                <b>lifted</b>
                <Note className="text-lg">종이 그림자. 떠 있는 카드에만</Note>
              </MarkerBox>
              <MarkerBox variant="pill" className="px-5 py-4 text-center">
                <b>pill</b>
                <Note className="text-lg">버튼·태그</Note>
              </MarkerBox>
              <MarkerBox variant="dashed" className="bg-transparent p-4 text-pencil-soft">
                <b>dashed</b>
                <Note className="text-lg">잠금 · 비활성 · 정산 후</Note>
              </MarkerBox>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <SpeechBubble>거의 다 왔어!</SpeechBubble>
              <SpeechBubble tail="bottom-right">아직 멀어…</SpeechBubble>
              <SpeechBubble tail="none">tail=&quot;none&quot;</SpeechBubble>
              <span className="ml-2 inline-flex items-center gap-3 text-marker">
                <HouseIcon size={26} />
                <BellIcon size={28} />
                <CrownIcon size={20} />
                <span className="font-note text-lg text-pencil-soft">HouseIcon · BellIcon · CrownIcon</span>
              </span>
            </div>
          </Section>

          <Section id="buttons" title="버튼" lead="TapButton 은 pointerdown 에 반응한다. 누르면 찌그러지고 형광펜이 칠해지며, 정산 후엔 점선이 된다.">
            <TapDemo />
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <MarkerButton>도감 전체 보기</MarkerButton>
              <MarkerButton variant="ghost">공유</MarkerButton>
              <MarkerButton size="sm">작은 버튼</MarkerButton>
              <MarkerButton size="sm" variant="ghost">
                작은 ghost
              </MarkerButton>
              <MarkerButton disabled>disabled</MarkerButton>
            </div>
          </Section>

          <Section id="inputs" title="입력칸" lead="줄 한 칸 높이의 밑줄. 오류는 여백선 색으로.">
            <div className="grid max-w-[320px] gap-4">
              <TextField label="아이디" hint="영문·숫자·_ 3~20자" placeholder="tap_to_home" />
              <TextField label="비밀번호" type="password" defaultValue="12345678" />
              <TextField label="닉네임" defaultValue="민경" error="이미 쓰는 아이디예요" />
            </div>
          </Section>

          <Section id="nav" title="길찾기" lead="하단 탭의 활성 탭은 매직 밑줄. 세부 화면은 제목 위에 BackLink 를 두고, 돌아갈 화면 이름을 라벨로 쓴다.">
            <div className="flex flex-wrap items-start gap-10">
              <div className="relative h-16 w-[360px] [&_nav]:absolute">
                <BottomNav />
              </div>
              <div className="flex flex-col items-start">
                <BackLink href="#nav" label="마이페이지" />
                <ScreenTitle>퇴근 도감</ScreenTitle>
              </div>
            </div>
          </Section>

          <Section id="stickman" title="졸라맨" lead="포즈 7개, 프레임 2개. F1-1 임계값과 포즈의 대응은 features/race/stages.ts 가 갖는다.">
            <StickmanSheet />
          </Section>

          <Section id="landmarks" title="구간 랜드마크" lead="트랙 위에 서는 손그림 표지. 연필 1.7px, 직선 대신 살짝 휜 곡선. 집만 매직 HouseIcon.">
            <div className="flex flex-wrap items-end gap-6">
              {STAGES.map((s) => (
                <div key={s.key} className="flex flex-col items-center gap-1 text-center font-note text-lg text-pencil">
                  <div className="flex h-[64px] items-end text-pencil">
                    <StageLandmark stage={s.key} size={s.key === "home" ? 60 : 56} className={s.key === "home" ? "text-marker" : undefined} />
                  </div>
                  <div>{s.label}</div>
                  <div className="text-sm text-pencil-soft">
                    {s.threshold}회 <code className="font-mono text-[11px]">{s.key}</code>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-end gap-4 text-pencil-soft">
              {STAGES.map((s) => (
                <StageLandmark key={s.key} stage={s.key} size={18} />
              ))}
              <span className="font-note text-lg">size=18 · RaceLane 트랙 눈금 크기</span>
            </div>
          </Section>

          <Section id="race-scenes" title="구간별 대기와 출발" lead="탭할 때만 달리고, 800ms 쉬면 현재 구간에서 기다린다. 집에서는 침대에 눕는다.">
            <RaceSceneSheet />
          </Section>
          <Section id="race" title="레이스 레인" lead="RaceLane 높이 64px 은 줄노트 두 칸. 배경 줄과 발이 맞물린다.">
            <RaceDemo />
          </Section>

          <Section id="signals" title="퇴근 신호 토스트" lead="F2 연타 등급. urgent 부터 형광펜 바탕.">
            <div className="grid max-w-[520px] gap-2">
              <SignalToast level="normal" meta="1연타">
                수현이도 퇴근하고 싶어 해요
              </SignalToast>
              <SignalToast level="strong" meta="5연타">
                수현이 <b>강하게</b> 퇴근하고 싶어 해요
              </SignalToast>
              <SignalToast level="urgent" meta="10연타 · 방금">
                <b>민경</b>이 긴급 퇴근 신호를 보냈어요!
              </SignalToast>
              <SignalToast level="rescue" meta="30연타">
                <b>민경</b>이 구조 요청을 보냈어요!!
              </SignalToast>
            </div>
          </Section>

          <Section id="badges" title="칭호 뱃지" lead="도감 한 칸. 미획득은 실루엣과 힌트만 (F3-2).">
            <div className="grid max-w-[420px] grid-cols-3 gap-2">
              <TitleBadge name="마음만 이미 집에 있음" pose="lie" isNew />
              <TitleBadge name="퇴근 1시간 전 폭주형" pose="run" />
              <TitleBadge name="오늘은 버틸 만했던 자" pose="stand" />
              <TitleBadge name="" pose="subway" locked hint="힌트: 지하철" />
            </div>
          </Section>

          <Section id="screens" title="화면 예시" lead="세 화면이 같은 카운트를 공유한다. 메인에서 누르면 레이스의 내 레인도 움직인다.">
            <ExampleScreens />
          </Section>

          <Section id="rules" title="쓰는 규칙" lead="">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
              <MarkerBox className="p-4">
                <b className="text-xl">이렇게</b>
                <ul className="mt-1.5 list-disc pl-5 text-[17px]">
                  <li>색은 토큰 클래스(<code className="font-mono text-sm">bg-paper text-pencil</code>)만. 임의 hex 금지</li>
                  <li>형광펜은 한 화면에 한 군데</li>
                  <li>전환은 <code className="font-mono text-sm">steps(2~3)</code>. 부드러운 tween 금지</li>
                  <li>줄 간격 32px 배수로 높이를 맞춘다</li>
                  <li>졸라맨은 Stickman 만. 이모지·이미지 대체 금지</li>
                </ul>
              </MarkerBox>
              <MarkerBox variant="dashed" className="bg-transparent p-4">
                <b className="text-xl text-pencil-soft">이렇게 말고</b>
                <ul className="mt-1.5 list-disc pl-5 text-[17px] text-pencil-soft">
                  <li>그라데이션, 유리 효과, 둥근 그림자 카드</li>
                  <li>회색 계열 두 번째 강조색</li>
                  <li>모든 블록을 MarkerBox 로 감싸기</li>
                  <li>정보 없는 번호 매기기·구분선</li>
                </ul>
              </MarkerBox>
            </div>
          </Section>
        </div>
      </div>
    </Paper>
  );
}

const SECTIONS: Array<[string, string]> = [
  ["tokens", "색 토큰"],
  ["type", "타이포"],
  ["frames", "종이와 프레임"],
  ["buttons", "버튼"],
  ["inputs", "입력칸"],
  ["nav", "길찾기"],
  ["stickman", "졸라맨"],
  ["landmarks", "구간 랜드마크"],
  ["race-scenes", "대기와 출발"],
  ["race", "레이스 레인"],
  ["signals", "신호 토스트"],
  ["badges", "칭호 뱃지"],
  ["screens", "화면 예시"],
  ["rules", "규칙"],
];

const TOKENS = [
  { name: "종이", cssVar: "--paper", tw: "paper", hex: "#fffdf5" },
  { name: "종이 (보드)", cssVar: "--paper-2", tw: "paper-2", hex: "#fbf7e8" },
  { name: "잉크 (텍스트)", cssVar: "--ink", tw: "ink", hex: "#2b2b2b" },
  { name: "가로줄", cssVar: "--line", tw: "line", hex: "#c9d6ea" },
  { name: "여백선", cssVar: "--margin", tw: "margin", hex: "#f4a3a3" },
  { name: "연필", cssVar: "--pencil", tw: "pencil", hex: "#3a3a3a" },
  { name: "연필 연함", cssVar: "--pencil-soft", tw: "pencil-soft", hex: "#8a8a86" },
  { name: "매직", cssVar: "--marker", tw: "marker", hex: "#1f1f1f" },
  { name: "형광펜", cssVar: "--hilite", tw: "hilite", hex: "#fff3a3" },
  { name: "형광펜 진함", cssVar: "--hilite-2", tw: "hilite-2", hex: "#ffe86b" },
];

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-[28px] font-bold leading-none">{title}</h2>
      {lead && <p className="mb-4 mt-1 max-w-[62ch] font-note text-xl text-pencil">{lead}</p>}
      {!lead && <div className="mb-4" />}
      {children}
    </section>
  );
}

function TypeRow({ spec, children }: { spec: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-baseline gap-x-6 border-b border-dashed border-line pb-2 sm:grid-cols-[1fr_260px]">
      <div>{children}</div>
      <code className="font-mono text-[12px] text-pencil-soft">{spec}</code>
    </div>
  );
}
