"use client";

import { useState } from "react";
import { Highlight } from "@/components/highlight";
import { MarkerBox } from "@/components/marker-box";
import { MarkerButton } from "@/components/marker-button";
import { Note, ScreenTitle } from "@/components/paper";
import { SignalToast } from "@/components/signal-toast";
import { Stickman } from "@/components/stickman";
import { TapButton } from "@/components/tap-button";
import { TitleBadge } from "@/components/title-badge";
import { RaceLane } from "@/features/race/components/race-lane";
import { StageStrip } from "@/features/race/components/stage-strip";
import { stageOf } from "@/features/race/stages";
import { PhoneFrame } from "./phone-frame";

/** 세 화면이 같은 카운트를 공유해 메인에서 누르면 레이스도 움직인다 */
export function ExampleScreens() {
  const [count, setCount] = useState(23);
  const [frame, setFrame] = useState<0 | 1>(0);
  const tap = () => {
    setCount((c) => c + 1);
    setFrame((f) => (f === 0 ? 1 : 0));
  };

  return (
    <div className="flex flex-wrap justify-center gap-7">
      <PhoneFrame
        caption={
          <>
            <b className="mr-1.5 font-ui text-xl text-ink">① 메인</b>F1-1 · 연타하면 졸라맨이 전진
          </>
        }
      >
        <ScreenTitle>오늘 퇴근하고 싶은 횟수</ScreenTitle>
        <Note>9월 19일 금요일 · 아직 {stageOf(count).label}</Note>
        <div className="mt-2 flex items-baseline gap-2.5">
          <span className="tabular text-[88px] font-bold leading-[.9] tracking-tight">{count}</span>
          <span className="text-[26px] font-bold">번</span>
        </div>
        <StageStrip count={count} frame={frame} className="mt-4" />
        <div className="mt-3 flex flex-col items-center">
          <TapButton onTap={tap} />
          <p className="mt-2 font-note text-[19px] text-pencil-soft">꾹꾹 누르면 한 칸씩 간다</p>
        </div>
        <MarkerBox className="mt-auto px-3.5 pb-3 pt-2.5">
          <div className="flex items-baseline justify-between text-[19px] font-bold">
            <span>우리 방</span>
            <span className="font-note text-[17px] font-normal text-pencil">오늘 4명 접속 →</span>
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5 text-center text-[15px] leading-tight">
            {[
              ["민경", 312, "home"],
              ["수현", 236, "subway"],
              ["지영", 9, "sit"],
            ].map(([n, c, p]) => (
              <div key={n as string}>
                <div className="flex h-[46px] items-end justify-center">
                  <Stickman pose={p as "home"} size={44} />
                </div>
                {n}
                <b className="tabular block text-lg">{c}</b>
              </div>
            ))}
            <div className="self-end pb-1.5 text-pencil-soft">+ 더보기</div>
          </div>
        </MarkerBox>
      </PhoneFrame>

      <PhoneFrame
        caption={
          <>
            <b className="mr-1.5 font-ui text-xl text-ink">② 친구 레이스</b>F1-2 + F2 · 노트 줄이 곧 트랙
          </>
        }
      >
        <div className="flex items-end justify-between">
          <div>
            <ScreenTitle>오늘의 퇴근 레이스</ScreenTitle>
            <Note>누가 먼저 집에 갈까</Note>
          </div>
          <span className="inline-flex items-center gap-1.5 font-note text-[17px] text-pencil">
            <i className="h-2 w-2 animate-pulse rounded-full bg-marker" />
            실시간
          </span>
        </div>
        <RaceLane rank={1} name="민경" count={253} bubble="거의 다 왔어!" />
        <RaceLane rank={2} name="수현" count={160} />
        <RaceLane rank={3} name="나" count={count} isMe frame={frame} />
        <RaceLane rank={4} name="지영" count={9} bubble="아직 멀어…" />
        <RaceLane rank={5} name="도윤" count={0} inactive />
        <SignalToast level="urgent" meta="10연타 · 방금" className="mt-auto">
          <b>민경</b>이 긴급 퇴근 신호를 보냈어요!
        </SignalToast>
      </PhoneFrame>

      <PhoneFrame
        time="23:59"
        caption={
          <>
            <b className="mr-1.5 font-ui text-xl text-ink">③ 오늘의 결과</b>F3 · 칭호와 도감
          </>
        }
      >
        <ScreenTitle>오늘도 수고했어요</ScreenTitle>
        <Note>9월 19일 금요일 · 정산 완료</Note>
        <MarkerBox className="mt-3 px-4 pb-3 pt-3.5 text-center">
          <div className="font-note text-lg text-pencil-soft">오늘의 대표 칭호</div>
          <div className="my-1 text-[30px] font-bold leading-[1.1] text-balance">
            <Highlight className="px-1.5">마음만 이미 집에 있음</Highlight>
          </div>
          <div className="flex h-[84px] items-end justify-center">
            <Stickman pose="lie" size={44} thick />
          </div>
          <dl className="mt-2.5 grid grid-cols-[1fr_auto] gap-y-0.5 text-left text-lg">
            <dt className="text-pencil">총 횟수</dt>
            <dd className="tabular text-right font-bold">103번</dd>
            <dt className="text-pencil">첫 퇴근 욕구</dt>
            <dd className="tabular text-right font-bold">09:32</dd>
            <dt className="text-pencil">가장 많이 누른 시간</dt>
            <dd className="tabular text-right font-bold">16:20 – 17:00</dd>
            <dt className="text-pencil">오늘 랭킹</dt>
            <dd className="tabular text-right font-bold">2위 / 5명</dd>
          </dl>
        </MarkerBox>
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xl font-bold">
            <span>퇴근 도감</span>
            <span className="tabular">
              14<small className="text-[15px] font-normal text-pencil-soft"> / 50</small>
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <TitleBadge name="마음만 이미 집에 있음" pose="lie" isNew />
            <TitleBadge name="퇴근 1시간 전 폭주형" pose="run" />
            <TitleBadge name="점심 먹고 모든 의욕을 잃은 자" pose="sit" />
            <TitleBadge name="출근하자마자 집 가고 싶었던 자" pose="home" />
            <TitleBadge name="" pose="stand" locked hint="30번 미만인 날" />
            <TitleBadge name="" pose="subway" locked hint="힌트: 지하철" />
          </div>
        </div>
        <div className="mt-auto flex gap-2.5">
          <MarkerButton className="flex-1">도감 전체 보기</MarkerButton>
          <MarkerButton variant="ghost" className="flex-1">
            공유
          </MarkerButton>
        </div>
      </PhoneFrame>
    </div>
  );
}
