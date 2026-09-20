# docs

기획과 기술 결정의 단일 기준. 코드와 문서가 다르면 문서를 먼저 고친 뒤 코드를 맞춘다.

| 문서 | 내용 |
| --- | --- |
| [goal.md](goal.md) | 서비스 목표, 타겟, 대회 목표, 성공 기준, 범위 밖 |
| [features.md](features.md) | F0 계정·친구 / F1 레이스 / F2 신호 / F3 칭호·도감 / F4 마이페이지 / F5 관리자 |
| [user-journey.md](user-journey.md) | 하루 사용 흐름 (출근 → 근무 → 퇴근 직전 → 하루 종료) |
| [tech-stack.md](tech-stack.md) | 스택과 선택 이유, 로컬 환경 |
| [data-model.md](data-model.md) | PostgreSQL 테이블 설계 초안 |
| [deploy.md](deploy.md) | Vercel + Supabase 설정, 환경 변수, 배포 후 확인 |
| [ios-release.md](ios-release.md) | iOS 번들 ID, 서명, App Store Connect, 심사 제출 절차 |
| [push-setup.md](push-setup.md) | FCM 푸시. APNs 키, Firebase 콘솔, 빌드 머신 설정 |
| [design.md](design.md) | 줄노트·연필 낙서 UI 테마 방향 |
| [decisions/](decisions/) | ADR. 0001 모노레포, 0002 실시간, 0003 ORM(Prisma), 0004 손그림 UI, 0005 아이디 로그인·칭호 카탈로그, 0006 네이티브 푸시(FCM), 0007 공통 실시간·조회 보정, 0008 자정 크론 자동 정산 |
| [superpowers/specs](../docs/superpowers/specs) | 프로토타입·개선 기능 설계 스펙 |
| [superpowers/plans](../docs/superpowers/plans) | 프로토타입·개선 기능 구현 계획 |
| [조회 효율 개선 설계](superpowers/specs/2026-09-20-query-efficiency-design.md) | 공통 실시간 구독, 조회 주기, 알림 수신 확인, 성능 목표 |
| [조회 효율 개선 계획](superpowers/plans/2026-09-20-query-efficiency.md) | 파일별 변경과 6단계 구현·검증 순서 |
| [관리자 대시보드 설계](superpowers/specs/2026-09-20-admin-dashboard-design.md) | 관리자 화면·와이어프레임, 사용자 관리, 접속·재방문 지표, 계측·권한·구현 단계 |
| [관리자 구현 계획](superpowers/plans/2026-09-20-admin-dashboard.md) | 파일별 구현 범위와 검증 기록 |
| [ADR 0009: 관리자·차트](decisions/0009-admin-dashboard-and-charts.md) | `/admin` 구성과 react-chartjs-2 + Chart.js 도입 |
| [ADR 0010: 마스터 인증 분리](decisions/0010-separate-admin-master-auth.md) | 관리자 전용 로그인·마스터 계정·세션 분리 방향, 계정 생성·복구와 운영 경계 |
