# ADR 0001 — 모노레포 레이아웃

날짜: 2026-09-19 · 상태: 채택

## 결정

`app/web` (Next.js) 와 `app/mobile` (Flutter) 를 한 저장소에 둔다. pnpm 워크스페이스 루트는 저장소 루트, 멤버는 `app/web` 과 `packages/*`. Flutter 는 pnpm 과 무관하게 자기 디렉토리에서 관리한다.

## 이유

- 모바일은 웹뷰 셸이라 웹과 배포 단위가 사실상 하나다. 같은 커밋에 URL·브릿지 변경을 묶는 편이 안전하다.
- Turborepo/Nx 는 패키지가 하나뿐인 지금은 이득이 없다. `packages/` 가 생기면 그때 검토한다.

## 결과

- 루트 `package.json` scripts 가 진입점. web 명령은 `pnpm --filter web`.
- Flutter 명령은 `app/mobile` 에서 직접 실행.
