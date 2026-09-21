# Design — 줄노트 + 혼합 선

살아있는 레퍼런스는 개발 서버의 `/dev/ui` (프로덕션에서는 `DEV_UI_KEY` 와 같은 `?key=` 를 붙여야 열리고, 없으면 404 — ADR 0004). 시안 원본은 `docs/design/mockup-a.html`. 이 문서와 `app/web/src/app/globals.css` 가 어긋나면 이 문서를 고친 뒤 코드를 맞춘다.

## 방향

- 전체 배경은 줄노트. 가로줄 간격 32px, 왼쪽 빨간 여백선.
- 선은 두 종류만 쓴다.
  - **매직 3px** (`--marker`): UI 프레임, 버튼, 집·종·왕관 아이콘. 흔들림 필터(`#wobble`)로 손으로 그린 느낌.
  - **연필 1.7px** (`--pencil`): 졸라맨, 말풍선, 진행 바 눈금. 여러 명이 한 줄에 겹쳐도 지저분하지 않게 얇게.
- 색은 종이·연필·매직 3톤으로 버티고, 강조는 **형광펜 노랑 하나만**. 한 화면에 한 군데.
- 애니메이션은 스톱모션. tween 대신 `steps(2~3)`, 졸라맨은 2프레임 교체.
- 달리기는 CSS의 320ms 주기 안에서 두 고정 포즈를 교대한다. 탭 횟수나 대기 프레임이 바뀌어도 이 주기를 뒤집지 않는다. 첫 이동은 대기 위치에서 시작하고, 구간의 문 안팎에서도 캐릭터 크기를 유지한다.
- 버튼은 눌렀을 때 살짝 찌그러지고(scale .94, -1.5deg) 형광펜이 칠해진다.
- 손을 떼거나 입력이 취소되거나 포커스가 옮겨지면 버튼 눌림을 해제한다. 동작 줄이기 설정에서는 반복 프레임과 전환을 끄고 정지 포즈로 반응한다.

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

관리자 화면은 같은 줄노트 톤을 유지하되 역할에 따라 서체를 나눈다. 화면 제목·메뉴·버튼은 `font-ui`, 짧은 관찰 메모는 `font-note`를 쓴다. 지표 수치, 날짜, 차트 축, 필터와 표는 `Apple SD Gothic Neo`, `Malgun Gothic` 순서의 한국어 시스템 산세리프와 `tabular-nums`를 써서 촘촘한 운영 데이터의 판독성을 확보한다.

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
| `BackLink` | 세부 화면 제목 위의 뒤로가기. 상위 화면을 `href` 로 못박고 라벨은 그 화면 이름 |

레이스 도메인 (`src/features/race/`): `stages.ts` 가 F1-1 임계값과 대기/달리기 포즈 대응을 관리한다. `RaceScene` 은 고정 요소와 그 안에서 대기하는 캐릭터를 함께 그리고, `StageLandmark` 도 같은 그림을 사용한다. `RaceTrack` 이 레일·여섯 고정 요소·달리는 캐릭터를 한 바닥선에 배치한다. `StageStrip` 은 높이 96px 의 메인 진행 바, `RaceLane` 은 높이 64px 의 친구 레이스 한 줄이다.

책상·엘베·로비·신호등·지하철·집은 레일 위에 한 번씩 고정한다. 대기 캐릭터는 해당 요소 안에 있고, 탭할 때는 문과 신호등이 그 자리에서 반응하며 사람만 다음 요소 방향으로 달린다. 800ms 뒤에는 현재 구간의 고정 요소에서 다시 대기하며, 실제 누적 진행 위치는 레일의 작은 표시점으로 유지한다. 집에서는 집 안의 침대에 눕는다. 모든 요소와 캐릭터의 발은 같은 레일 바닥선을 쓴다. 별도의 위쪽 장면이나 이동하는 건물은 두지 않는다. 작은 화면에서 그림이 겹치지 않게 여섯 요소는 균등 배치하고, 각 구간 안에서의 이동률은 해당 구간의 탭 임계값으로 계산한다. 횡단보도 신호는 켜진 불의 위치와 `대기`/`건너기` 글자로 구분한다. `/dev/ui` 에는 독립 삽화뿐 아니라 실제 레일의 단계별 대기·달리기 상태도 함께 보여준다.

레일에서는 `RaceScene` 이 36px(메인)·24px(랭킹)로 줄어든다. 72 단위 viewBox 를 그대로 축소하면 선과 글자가 1px 밑으로 뭉개지므로, 선 굵기는 축소율만큼 되돌리고 64px 미만에서는 읽히지 않는 잔디테일(서류 줄·로비 창틀·지하철 창문과 의자·횡단보도 줄무늬와 `대기`/`건너기` 글자·집의 `z`)을 뺀다. 신호등 불은 작을 때 오히려 키워서 어느 쪽이 켜졌는지가 36px 에서도 보이게 한다. 상태를 알려주는 요소는 남기고 장식만 덜어내는 것이 기준이다.

`/dev/ui#race-scenes` 의 SVG 애니메이션 미리보기는 여섯 구간을 확대해 보여준다. 구간마다 출발을 한 번 재생할 수 있고, 전체 반복 재생에서는 800ms 출발과 1초 대기를 번갈아 보여준다. 확대 장면과 실제 메인·랭킹 레일은 같은 상태로 움직이며 집은 항상 침대에서 쉰다.

누운 `Stickman`은 홍보 릴스 버전 2와 같은 자세를 쓴다. 머리 오른쪽 가장자리에 몸통을 연결하고 팔은 어깨에서 시작한다. 감은 눈은 머리 중심에서 −90도 회전하며, 두 프레임은 팔의 작은 움직임만 다르다. 메인·랭킹·칭호·결과·기록이 이 공용 포즈를 사용한다. 집 장면의 침대는 머리와 발 아래를 받치고, 수면 표시는 얼굴과 지붕 사이에 둔다.

모든 포즈의 머리는 종이색으로 채워 배경·문 선이 얼굴을 통과하지 않게 한다. 문은 캐릭터 뒤에 그리고, 닫혔을 때 중앙 선이 몸통·다리와 합쳐지지 않도록 생략한다. 지하철의 팔과 손잡이는 머리 오른쪽에 두고, 손잡이는 전동차 안의 고정 가로대에 연결한다.

## 규칙

- 색은 토큰 클래스만. 임의 hex 금지.
- 형광펜은 한 화면에 한 군데.
- 모든 블록을 `MarkerBox` 로 감싸지 않는다. 프레임은 눌러야 할 것·떠 있는 것에만.
- 그라데이션·유리 효과·부드러운 그림자·두 번째 강조색 금지.
- 졸라맨은 `Stickman` 만. 이모지·이미지로 대체하지 않는다.
- 하단 탭에 없는 화면(`/my/*`, `/records/[date]`, `/privacy`)은 제목 위에 `BackLink` 를 둔다. 웹뷰에는 브라우저 뒤로가기가 없고 푸시로 바로 들어올 수 있어 `router.back()` 대신 상위 화면을 고정한다.
- 스크롤바는 전역으로 숨긴다(`globals.css`). 스크롤은 그대로 되고 막대만 안 보인다.
- 새 컴포넌트를 만들면 `/dev/ui` 에 상태별로 올린다.

## 에셋

Midjourney 생성 에셋은 쓰지 않는다. 졸라맨·아이콘·프레임 모두 코드(SVG path·CSS)로 그린다. 예외가 생기면 `app/web/public/assets/` 에 SVG 로 두고 이 문서에 적는다.

### 서비스 파비콘

2026-09-21 사용자 요청으로 서비스 식별용 파비콘에는 생성한 래스터 이미지를 사용한다. 종이색 바탕·검은 매직 선·노란 형광펜색으로 집 안으로 달리는 졸라맨을 표현한다. 게임 화면의 SVG 컴포넌트에는 영향을 주지 않는다.

- `app/web/src/app/favicon.ico`: 16·32·48·64·128·256px를 포함하는 브라우저 파비콘.
- `app/web/src/app/icon.png`: 512px 서비스 아이콘.
- `app/web/src/app/apple-icon.png`: 180px iOS 홈 화면 아이콘.
- Next.js App Router의 파일 기반 메타데이터로 연결하며, 생성 원본과 프롬프트는 `docs/design/`에 보관한다.
