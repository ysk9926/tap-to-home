# ADR 0005 — 아이디 로그인, 칭호 마스터는 코드에

날짜: 2026-09-19 · 상태: 채택

## 결정 1 — 로그인 식별자는 아이디

better-auth `username` 플러그인을 켜고 `signIn.username` 으로 로그인한다. 코어 스키마가 `email` 을 필수로 요구하므로 가입 시 `${username}@id.tap-to-home.local` 을 자동 생성해 넣고 화면에는 보여주지 않는다. `emailAndPassword` 는 플러그인이 `/sign-up/email` 을 재사용하므로 켜 둔다.

- 이유: 심사 기간 개방형 로그인에서 이메일 입력은 마찰만 늘린다. 친구 검색 키도 아이디가 자연스럽다.
- 대안: 이메일 컬럼 제거 — better-auth 계약을 깨므로 기각. 익명 로그인 — 친구 검색 키가 없어 기각.

## 결정 2 — 칭호 마스터는 코드 상수

`src/features/titles/catalog.ts` 가 칭호 정의(id, 이름, 힌트, 포즈, 우선순위)의 단일 기준이다. `user_title.titleId`, `daily_result.primaryTitleId` 는 FK 없는 text. `title` 테이블은 만들지 않는다.

- 이유: 판정 로직이 코드에 있으므로 정의도 같은 곳에 있어야 함께 바뀐다. 50개로 늘려도 배포 한 번으로 끝난다.
- 결과: 칭호를 삭제할 때는 id 를 catalog 에서 지우지 말고 `retired: true` 를 붙여 기존 획득 기록이 깨지지 않게 한다 (필요해지면 필드 추가).
