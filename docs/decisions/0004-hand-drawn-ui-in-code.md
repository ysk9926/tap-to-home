# ADR 0004 — 손그림 UI 를 이미지 없이 코드로 그린다

날짜: 2026-09-19 · 상태: 채택

## 결정

줄노트·졸라맨·매직 프레임을 Midjourney 이미지가 아니라 코드로 그린다.

- 토큰은 Tailwind v4 `@theme inline` 에 CSS 변수로 등록하고, 줄노트·프레임·형광펜은 `@utility` 로 만든다.
- 졸라맨은 40×60 viewBox 의 SVG path 두 프레임. `Stickman` 컴포넌트 하나가 7개 포즈를 갖는다.
- 매직 선의 손그림 느낌은 SVG `feTurbulence` + `feDisplacementMap` 필터(`#wobble`) 한 개로 낸다. 프레임은 테두리를 `::before` 에 그려 필터가 글자를 건드리지 않게 한다.
- 폰트는 `next/font/google` 로 Gaegu 와 Nanum Pen Script 를 셀프호스팅한다.
- 레퍼런스 페이지는 `/dev/ui`. 개발 환경에서는 그냥 열린다. 프로덕션에서는 `DEV_UI_KEY` 와 일치하는 `?key=` 를 들고 와야 열리고, 그 외에는 `notFound()`.

2026-09-21 개정: 원래는 `NODE_ENV=production` 이면 무조건 `notFound()` 였다. 심사·리뷰 중 배포된 주소에서 레퍼런스를 봐야 할 일이 생겨 비밀 키 방식으로 바꿨다. `DEV_UI_KEY` 가 비어 있으면 프로덕션에서는 닫힌 상태가 되므로, 닫을 때는 Vercel 에서 값만 지우면 되고 재배포는 필요 없다. 키는 URL 에 남으므로 공개 링크로 다루지 않는다.

## 이유

- 졸라맨은 횟수에 따라 위치·포즈·프레임이 바뀌고 친구 수만큼 겹친다. 이미지면 조합마다 파일이 필요하지만 path 는 props 로 끝난다.
- 색·선 굵기를 토큰으로 바꾸면 전부 따라온다. 이미지는 다시 생성해야 한다.
- 이미지 요청이 없어 웹뷰 첫 화면이 가볍다. 성공 기준 1(가입 후 30초 안에 첫 탭)에 유리하다.

## 대안

- Midjourney 투명 PNG 2x: 그림은 예쁘지만 스톱모션 프레임·단계·친구 수만큼 파일이 늘고, 톤이 프레임마다 흔들린다. 기각.
- Lottie / rive: 의존성과 번들이 크고, 필요한 움직임이 2프레임 교체뿐이라 과하다. 기각.

## 결과

- `docs/design.md` 가 토큰·컴포넌트 목록의 기준. `globals.css`, `src/components/`, `src/features/race/` 가 구현.
- 디자인 원본 시안은 `docs/design/mockup-a.html` 로 보관.
