# Design — 줄노트 + 혼합 선

살아있는 레퍼런스는 개발 서버의 `/dev/ui` (프로덕션에서는 404). 시안 원본은 `docs/design/mockup-a.html`. 이 문서와 `app/web/src/app/globals.css` 가 어긋나면 이 문서를 고친 뒤 코드를 맞춘다.

## 방향

- 전체 배경은 줄노트. 가로줄 간격 32px, 왼쪽 빨간 여백선.
- 선은 두 종류만 쓴다.
  - **매직 3px** (`--marker`): UI 프레임, 버튼, 집·종·왕관 아이콘. 흔들림 필터(`#wobble`)로 손으로 그린 느낌.
  - **연필 1.7px** (`--pencil`): 졸라맨, 말풍선, 진행 바 눈금. 여러 명이 한 줄에 겹쳐도 지저분하지 않게 얇게.
- 색은 종이·연필·매직 3톤으로 버티고, 강조는 **형광펜 노랑 하나만**. 한 화면에 한 군데.
- 애니메이션은 스톱모션. tween 대신 `steps(2~3)`, 졸라맨은 2프레임 교체.
- 버튼은 눌렀을 때 살짝 찌그러지고(scale .94, -1.5deg) 형광펜이 칠해진다.

## 토큰 (`globals.css` → Tailwind v4 `@theme`)

| 토큰 | 값 | Tailwind | 용도 |
| --- | --- | --- | --- |
| paper | #fffdf5 | `bg-paper` | 종이 |
| paper-2 | #fbf7e8 | `bg-paper-2` | 보드·바깥 바탕 |
| ink | #2b2b2b | `text-ink` | 기본 텍스트 |
| line | #c9d6ea | `border-line` | 줄노트 가로줄 |
| margin | #f4a3a3 | `border-margin` | 왼쪽 여백선 |
| pencil | #3a3a3a | `text-pencil` | 졸라맨·연필 선·보조 텍스트 |
| pencil-soft | #8a8a86 | `text-pencil-soft` | 힌트·비활성·잠금 |
| marker | #1f1f1f | `border-marker` | 프레임·버튼·아이콘 |
| hilite | #fff3a3 | `bg-hilite` | 형광펜 |
| hilite-2 | #ffe86b | `bg-hilite-2` | NEW 뱃지 등 진한 형광펜 |

기타: `rounded-sketch` / `rounded-sketch-sm` / `rounded-sketch-lg` / `rounded-bubble` (네 모서리가 제각각인 손그림 radius), `shadow-paper`, `--rule-gap: 32px`.

커스텀 유틸리티: `ruled`(줄노트 배경), `mk`(매직 프레임, 테두리만 흔들림), `mk-pill`, `mk-dashed`, `hl`(형광펜), `wobble`, `tabular`.

## 폰트

`next/font/google` 로 셀프호스팅. 루트 레이아웃이 CSS 변수로 주입한다.

| 역할 | 폰트 | Tailwind | 쓰임 |
| --- | --- | --- | --- |
| UI | Gaegu 400/700 | `font-ui` (기본) | 제목·본문·버튼·수치 |
| Note | Nanum Pen Script | `font-note` | 말풍선·메모·힌트·눈금 |

수치는 항상 `tabular`.

## 컴포넌트 (`src/components/`)

| 컴포넌트 | 역할 |
| --- | --- |
| `SketchDefs` | `#wobble` 필터. 루트 레이아웃에 한 번 |
| `Paper`, `ScreenTitle`, `Note` | 줄노트 바탕과 화면 제목·메모 |
| `MarkerBox` | 매직 프레임. `variant` box / pill / dashed, `lifted` |
| `MarkerButton` | 알약 버튼. `variant` primary / ghost, `size` md / sm |
| `TapButton` | 메인 연타 버튼. `pointerdown` 에 `onTap`. `disabled` 면 점선 |
| `Stickman` | 졸라맨. `pose` 7종, `frame` 0/1, `thick` |
| `SpeechBubble` | 연필 말풍선. `tail` |
| `SignalToast` | 퇴근 신호 토스트. `level` normal / strong / urgent / rescue |
| `TitleBadge` | 도감 한 칸. `locked`, `hint`, `isNew` |
| `Highlight` | 형광펜 span |
| `HouseIcon`, `BellIcon`, `CrownIcon` | 매직 아이콘. 집은 지붕·벽·바닥만 매직(2.2px)이고 굴뚝·연기·문·창문은 가는 선으로 얹은 손그림 |
| `TextField` | 밑줄 입력칸. label, hint, error |
| `BottomNav` | 하단 탭 4개. 활성 탭은 매직 밑줄 |

레이스 도메인 (`src/features/race/`): `stages.ts` 가 F1-1 임계값과 포즈 대응(`STAGES`, `stageOf`, `progressOf`), `StageLandmark` 가 단계별 손그림 표지(40×40 viewBox, 바닥선 y≈39 가 트랙에 닿음, 연필 1.7px, 집만 `HouseIcon`), `StageStrip` 이 메인 진행 바(높이 96px = 줄노트 세 칸, 트랙 위 랜드마크 + 아래 이름표), `RaceLane` + `StageTicks` 가 친구 레이스 한 줄(눈금은 글자 대신 size 20 랜드마크). 레인 높이 64px = 줄노트 두 칸.

## 규칙

- 색은 토큰 클래스만. 임의 hex 금지.
- 형광펜은 한 화면에 한 군데.
- 모든 블록을 `MarkerBox` 로 감싸지 않는다. 프레임은 눌러야 할 것·떠 있는 것에만.
- 그라데이션·유리 효과·부드러운 그림자·두 번째 강조색 금지.
- 졸라맨은 `Stickman` 만. 이모지·이미지로 대체하지 않는다.
- 새 컴포넌트를 만들면 `/dev/ui` 에 상태별로 올린다.

## 에셋

Midjourney 생성 에셋은 쓰지 않는다. 졸라맨·아이콘·프레임 모두 코드(SVG path·CSS)로 그린다. 예외가 생기면 `app/web/public/assets/` 에 SVG 로 두고 이 문서에 적는다.
