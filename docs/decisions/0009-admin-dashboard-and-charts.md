# 0009. 관리자 대시보드와 React 차트

2026-09-20 · 결정됨 · react-chartjs-2 + Chart.js 적용

## 맥락

전체 사용자 관리와 향후 개발 판단을 위한 접속·재방문·플레이 분석이 필요하다. 현재 앱은 Next.js 16 / React 19, better-auth, Prisma를 사용하며 차트 라이브러리와 관리자 권한 모델은 없다.

## 결정

- 기존 웹의 `/admin`에 독립 레이아웃과 `/admin/login`을 둔다. DB 접근 계층을 재사용하고, 인증은 [ADR 0010](0010-separate-admin-master-auth.md)의 전용 마스터 계정·세션으로 분리한다.
- 일반 앱과 별도로 마스터 인증을 서버에서 검증한다. Proxy·메뉴 숨김은 인증 검증을 대체하지 않는다.
- 차트에는 `react-chartjs-2` + Chart.js 4를 사용한다. 요청의 “react-chart”에 대해 제안하는 구체적인 패키지 선택이다.
- 선·세로 막대·가로 막대는 차트 컴포넌트를 사용하고 코호트는 HTML 표로 표현한다.
- 방문 기록을 새로 수집한다. 기존 탭 데이터는 플레이 지표로 사용하며 세션 갱신 시각으로 방문을 추정하지 않는다.

상세 화면·지표·권한·단계별 범위는 [관리자 대시보드 설계](../superpowers/specs/2026-09-20-admin-dashboard-design.md)를 따른다. 실제 마스터 생성과 배포는 운영 설정 절차로 분리한다.

## 대안

| 선택 | 검토 |
| --- | --- |
| `react-chartjs-2` + Chart.js | 이번 제안. 필요한 선·막대 차트를 구현하고 테마·축·툴팁을 통일하기 적합 |
| TanStack `react-charts` | 별도 라이브러리. X/Y 차트 중심이라는 방향은 이번 화면과 맞으며, 사용자가 이 패키지를 지칭한 경우 선택을 재검토 |
| 별도 관리자 앱·외부 분석 서비스 | 독립 운영·탐색 분석이 더 중요해지면 검토. 현재는 인증·사용자 데이터 연결 비용이 추가됨 |

## 결과와 부담

- 차트 코드는 관리자 화면의 클라이언트 경계에 둔다. 일반 레이스 화면에 차트 의존성을 넣지 않는다.
- Canvas에는 텍스트 요약과 데이터 표를 제공해야 한다. 테마 색상뿐 아니라 실선·점선으로도 계열을 구분한다.
- 방문·재방문 지표는 수집 시작 후에만 정확히 제공할 수 있다. 30일이 쌓이기 전 DAU/MAU는 수집 중으로 표시한다.
- 관리자 전용 인증·일반 회원 정지·감사 이력과 방문 수집 모델의 마이그레이션이 필요하다. 구현 시 데이터 모델 문서를 먼저 수정한다.

## 공식 근거

2026-09-20 확인.

- [react-chartjs-2 소개](https://react-chartjs-2.js.org/): Chart.js React 컴포넌트와 Chart.js 4 지원.
- [공식 package.json](https://github.com/reactchartjs/react-chartjs-2/blob/master/package.json): React 19를 포함한 peer dependency 확인. 도입 시 선택 버전으로 다시 검증한다.
- [Chart.js 접근성](https://www.chartjs.org/docs/latest/general/accessibility.html): Canvas의 접근성 보완 필요.
- [TanStack React Charts](https://react-charts.tanstack.com/): X/Y 차트 중심의 대안.
