<img src="app/web/src/app/icon.png" alt="집으로 달려가는 Tap to Home 졸라맨" width="88" />

# Tap to Home

**몸은 회사에, 마음은 이미 집에. 버튼 하나로 함께 퇴근하는 소셜 레이스.**

Tap to Home은 하루 종일 퇴근을 기다리는 직장인을 위한 앱입니다. **“퇴근하고 싶다”** 버튼을 누르면 내 졸라맨이 회사에서 집으로 전진합니다. 친구와 오늘의 순위를 겨루고, 연타로 퇴근 신호를 보내고, 하루가 끝나면 그날의 플레이 패턴이 칭호로 남습니다.

원티드 AI 챔피언십 2026 출품작으로, 웹에서 바로 이용할 수 있으며 같은 화면을 Flutter 웹뷰로 감싸 iOS·Android에서도 사용합니다.

[서비스 바로가기](https://taptohome.site) · [기능 명세](docs/features.md) · [개발 문서](docs/README.md)

## 왜 만들었나요?

“나도 집에 가고 싶다”는 마음을 긴 대화 없이 나눌 수 있으면 어떨까요? 몇 초 동안 버튼을 누르고 닫아도 친구에게 마음이 전해지고, 쌓인 탭은 하루의 기록이 됩니다. 탭 한 번의 반응, 친구와의 경쟁, 칭호 수집을 연결해 다음 날에도 가볍게 들를 이유를 만들었습니다.

화면은 **줄노트, 연필 낙서, 노란 형광펜**을 모티프로 삼았습니다. 졸라맨과 레이스의 랜드마크는 SVG·CSS로 그려 탭과 진행 단계에 따라 움직입니다.

## 이렇게 사용해요

1. **가입하기** — 이메일 없이 아이디·비밀번호·닉네임으로 가입합니다.
2. **첫 퇴근 욕구 남기기** — 레이스에서 버튼을 누르면 횟수가 올라가고 졸라맨이 움직입니다.
3. **친구와 연결하기** — 친구의 아이디를 검색해 요청을 보내고, 상대가 수락하면 서로의 레이스가 보입니다.
4. **함께 달리기** — 친구의 진행도와 순위를 확인하고 연타로 퇴근 신호를 보냅니다.
5. **하루 돌아보기** — 다음 날 정산 결과에서 횟수·랭킹·칭호를 확인하고 도감을 채웁니다.

두 브라우저에서 각각 가입한 뒤 친구 요청을 수락하면 친구 레이스와 신호를 체험할 수 있습니다. 10회 연타 후 잠시 멈추면 상대에게 긴급 퇴근 신호가 전달됩니다.

## 주요 기능

### 퇴근 레이스와 친구 랭킹

탭할 때마다 캐릭터가 반응하며, 하루 **5,000회**에 도달하면 집에서 쉽니다. 집에 도착한 뒤에는 추가 탭을 받지 않고, 다음 날 KST 자정을 기준으로 다시 시작합니다.

| 위치 | 누적 탭 |
| --- | ---: |
| 자리 | 0 |
| 엘리베이터 | 750 |
| 로비 | 1,600 |
| 횡단보도 | 2,500 |
| 지하철 | 3,650 |
| 집 | 5,000 |

메인에는 내 진행도와 친구 상위 2명의 레일이 표시됩니다. 랭킹 탭에서는 나와 친구들의 순위를 함께 볼 수 있고, 마이페이지에서 메인의 친구 레일 표시를 켜거나 끌 수 있습니다.

### 버튼으로 보내는 퇴근 신호

연속 탭 사이의 간격이 1.5초 이내이면 하나의 연타로 묶습니다. 연타가 끝나면 도달한 가장 높은 등급의 신호 하나를 친구에게 보냅니다.

| 연타 횟수 | 신호 |
| --- | --- |
| 1~4회 | 일반 신호 |
| 5~9회 | 강한 신호 |
| 10~29회 | 긴급 퇴근 신호 |
| 30회 이상 | 구조 요청 |

신호는 인앱 토스트로 표시되며, 모바일 푸시를 설정하면 백그라운드 알림도 받을 수 있습니다. 같은 친구에게 같은 등급의 신호를 보내는 간격은 10분으로 제한합니다.

### 하루 기록과 칭호 도감

전날 한 번 이상 탭한 사용자의 기록을 자동 정산합니다. 총 횟수·첫 탭 시각·랭킹·획득 칭호를 확인할 수 있으며, 획득한 칭호는 도감에 누적됩니다. 현재 구현된 칭호는 **5종**입니다.

| 칭호 | 획득 조건 · KST 기준 |
| --- | --- |
| 출근하자마자 집 가고 싶었던 자 | 첫 탭이 09:30 이전 |
| 점심 먹고 모든 의욕을 잃은 자 | 13시 이후 탭이 전체의 60% 이상 |
| 퇴근 1시간 전 폭주형 | 17시 이후 1,500회 이상 탭 |
| 마음만 이미 집에 있음 | 하루 5,000회 달성 |
| 오늘은 버틸 만했던 자 | 하루 1~499회 탭 |

여러 조건을 만족하면 칭호를 함께 받습니다. 정산은 매일 KST 00:05로 예약돼 있으며, 현재 배포 환경에서는 00시대에 실행될 수 있습니다. 자세한 스케줄 제약은 [배포 문서](docs/deploy.md#자정-정산-운영-확인)를 참고하세요.

### 계정·친구 관리와 운영 화면

- **친구 관리:** 아이디 검색, 요청·수락·거절·취소, 친구 삭제, 차단·해제.
- **마이페이지:** 닉네임·비밀번호 변경, 푸시 알림 설정, 친구 레일 표시 설정, 도감, 계정 탈퇴.
- **관리자:** 별도 마스터 계정으로 접속하는 사용자 관리, 이용 정지·해제, 세션 종료, 조치 이력, 접속·재방문·레이스·소셜 분석.

## 화면 구성

| 경로 | 화면 |
| --- | --- |
| `/` | 메인 레이스와 탭 버튼 |
| `/ranking` | 나와 친구들의 오늘 랭킹 |
| `/friends` | 친구 검색·요청·목록·차단 관리 |
| `/my` | 마이페이지와 표시 설정 |
| `/my/profile` | 내 정보와 푸시 알림 설정 |
| `/my/collection` | 칭호 도감 |
| `/records` · `/records/[date]` | 최근 30일 기록과 날짜별 상세 |
| `/login` · `/signup` | 아이디 로그인·회원가입 |
| `/admin/login` · `/admin` | 관리자 로그인·운영 대시보드 |
| `/dev/ui` | 개발 환경 전용 UI·레이스 애니메이션 미리보기 |

## 기술 구성

| 영역 | 기술 | 역할 |
| --- | --- | --- |
| 웹·서버 | Next.js 16 App Router, React 19, TypeScript | 화면, 서버 렌더링, API, 서비스 로직 |
| 서버 상태 | TanStack Query 5 | 캐시, 낙관적 탭 반영, 서버 데이터 동기화 |
| 스타일 | Tailwind CSS 4, SVG·CSS | 줄노트 테마와 손그림 컴포넌트 |
| 인증 | Better Auth, username 플러그인 | 아이디 로그인, 일반·관리자 인증 분리 |
| 데이터 | PostgreSQL, Prisma 7, `@prisma/adapter-pg` | 서버의 데이터 조회·저장과 마이그레이션 |
| 실시간 | Supabase Realtime Broadcast | 친구 진행도·관계 변경·신호 전달 |
| 모바일 | Flutter, `webview_flutter` | iOS·Android 웹뷰와 네이티브 브리지 |
| 푸시 | Firebase Cloud Messaging | 퇴근 신호·정산 결과의 네이티브 알림 |
| 운영 차트 | Chart.js 4, `react-chartjs-2` | 운영 지표 시각화 |
| 배포·검증 | Vercel, Supabase, Vitest, ESLint | 웹 배포, 관리형 DB, 테스트·정적 검사 |

```mermaid
flowchart LR
    Browser[웹 브라우저] --> Web[Next.js 웹 앱]
    Mobile[Flutter 웹뷰] --> Web
    Web --> Server[서버 컴포넌트 · API · Server Actions]
    Server --> Auth[Better Auth]
    Server --> Prisma[Prisma]
    Prisma --> DB[(PostgreSQL)]
    Server -->|이벤트 발행| Realtime[Supabase Realtime]
    Realtime -->|진행도 · 친구 · 신호| Web
    Cron[Vercel Cron] -->|전날 정산| Server
    Server --> FCM[FCM]
    FCM -->|네이티브 푸시| Mobile
```

- **게임 로직은 웹에 모읍니다.** Flutter는 웹뷰와 푸시·햅틱 브리지를 담당합니다.
- **탭은 즉시 반영하고 300ms 단위로 모아 전송합니다.** 화면 반응과 서버 저장을 분리하고, 서버에서도 하루 5,000회 한도를 적용합니다.
- **실시간 이벤트와 주기적 조회를 함께 사용합니다.** 공통 구독으로 데이터를 갱신하고, 연결 장애 시 폴링으로 보완합니다. 숨김·오프라인 상태에서는 신규 조회를 멈춥니다.
- **DB는 서버의 Prisma를 통해 접근합니다.** Supabase SDK는 Realtime에만 사용하며, 인증은 Better Auth가 담당합니다.
- **운영자 인증은 독립적으로 관리합니다.** 일반 회원과 마스터 계정의 저장소·세션·쿠키·비밀키를 분리합니다.

## 로컬에서 실행하기

### 준비물

- **Node.js 24 이상**, **pnpm 11.5.0** — 루트 `package.json` 기준.
- **Docker Compose** — 저장소의 PostgreSQL 17 실행용. 직접 준비한 PostgreSQL도 사용할 수 있습니다.
- 모바일 실행 시 **Flutter SDK**와 iOS·Android 개발 환경 — Dart SDK 조건은 `app/mobile/pubspec.yaml`의 `^3.12.0`입니다.

### 1. 설치와 환경 파일 준비

```bash
git clone https://github.com/ysk9926/tap-to-home.git
cd tap-to-home
pnpm install
cp app/web/.env.example app/web/.env
```

설치 시 Prisma 클라이언트도 생성됩니다. 이미 환경 파일이 있다면 덮어쓰지 말고 필요한 항목을 확인하세요.

### 2. 로컬 환경 설정

[환경 변수 예제](app/web/.env.example)는 로컬 PostgreSQL을 기본값으로 사용합니다. `app/web/.env`의 다음 값을 확인하고, `BETTER_AUTH_SECRET`을 `openssl rand -base64 32`로 생성한 값으로 바꿉니다.

```dotenv
DATABASE_URL=postgresql://taptohome:taptohome@localhost:5432/taptohome
DIRECT_URL=postgresql://taptohome:taptohome@localhost:5432/taptohome
BETTER_AUTH_SECRET=<생성한 비밀키>
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Supabase Realtime 키가 없어도 폴링 방식으로 로컬 기능을 확인할 수 있습니다. 실제 이벤트 전송과 네이티브 푸시는 아래 추가 설정이 필요합니다.

### 3. DB 준비 후 웹 실행

```bash
pnpm db:up
pnpm db:deploy
pnpm dev
```

DB가 연결을 받을 준비가 된 뒤 `db:deploy`를 실행하세요. 이 명령은 저장소에 있는 마이그레이션을 적용합니다. 실행 후 [localhost:3000](http://localhost:3000)에서 가입하면 레이스로 진입합니다.

스키마를 변경할 때는 `pnpm db:migrate`로 새 마이그레이션을 생성·적용합니다. Supabase DB로 개발하려면 `DATABASE_URL`에는 transaction pooler **6543**, `DIRECT_URL`에는 session pooler **5432** 연결을 설정합니다.

### 4. 필요한 기능의 추가 설정

| 기능 | 설정 |
| --- | --- |
| 실시간 이벤트 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |
| 모바일 푸시 | `FIREBASE_SERVICE_ACCOUNT_JSON`과 플랫폼별 Firebase·APNs 설정. [푸시 설정 문서](docs/push-setup.md) 참고 |
| 관리자 로그인 | 일반 인증 키와 다른 32자 이상의 `ADMIN_AUTH_SECRET`을 설정하고 `pnpm admin:master create` 실행 |
| 자동 정산 | `CRON_SECRET`과 Vercel Cron. 설정 파일은 [app/web/vercel.json](app/web/vercel.json) |
| 통합 테스트 DB | 기본 로컬 DB를 사용하거나 `TEST_DATABASE_URL`로 별도 테스트 DB 지정 |

로컬 개발 서버는 정산을 자동 예약하지 않습니다. 정산 운영과 관리자 초기 설정은 [배포 문서](docs/deploy.md)를 참고하세요.

### 모바일 웹뷰 실행

웹 개발 서버를 실행한 상태에서 별도 터미널을 사용합니다.

```bash
cd app/mobile
flutter pub get
flutter run --dart-define=WEB_URL=http://localhost:3000
```

위 주소는 iOS 시뮬레이터 기준입니다. Android 에뮬레이터에서는 `http://10.0.2.2:3000`, 실기기에서는 기기가 접근할 수 있는 개발 머신의 LAN 주소를 사용합니다. 배포 빌드에는 HTTPS 웹 주소를 주입합니다.

## 개발 명령과 검증

아래 `pnpm` 명령은 저장소 루트에서 실행합니다.

| 명령 | 설명 |
| --- | --- |
| `pnpm dev` | 웹 개발 서버 |
| `pnpm build` · `pnpm start` | 프로덕션 빌드·실행 |
| `pnpm typecheck` | Next.js 라우트 타입 생성·TypeScript 검사 |
| `pnpm lint` | ESLint 검사 |
| `pnpm test` | Vitest 단위·통합 테스트 |
| `pnpm db:up` · `pnpm db:down` | 로컬 PostgreSQL 시작·중지 |
| `pnpm db:generate` | Prisma 클라이언트 재생성 |
| `pnpm db:migrate` | 개발용 마이그레이션 생성·적용 |
| `pnpm db:deploy` | 기존 마이그레이션 적용 |
| `pnpm db:studio` | Prisma Studio 실행 |
| `pnpm admin:master create` | 관리자 마스터 계정 생성 |

변경 후 기본 검증:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

통합 테스트에는 마이그레이션이 적용된 PostgreSQL이 필요합니다. 테스트 설정은 앱의 `DATABASE_URL` 대신 `TEST_DATABASE_URL`을 사용하며, 지정하지 않으면 위의 로컬 `taptohome` DB를 사용합니다. 별도 테스트 DB를 지정했다면 해당 DB에도 먼저 마이그레이션을 적용하세요. 테스트는 운영 DB나 실제 관리자 계정이 있는 DB에서 실행하지 않습니다.

Flutter를 변경했다면 `app/mobile`에서 `flutter analyze`도 실행합니다.

## 저장소 구조

```text
tap-to-home/
├── app/
│   ├── web/                      # 모든 서비스 화면·API·기능 로직
│   │   ├── src/app/              # App Router 페이지와 API
│   │   ├── src/features/         # 레이스·친구·신호·칭호·운영 등 도메인
│   │   ├── src/components/       # 공용 손그림 UI
│   │   ├── src/lib/              # DB·인증·공통 유틸리티
│   │   ├── prisma/               # 스키마와 마이그레이션
│   │   ├── scripts/              # 관리자 계정 운영 CLI
│   │   └── test/                 # 테스트 설정·공용 도우미
│   └── mobile/                   # Flutter 웹뷰·푸시·햅틱 브리지
├── docs/                         # 기획·설계·배포·기술 결정
├── docker-compose.yml            # 로컬 PostgreSQL 17
├── pnpm-workspace.yaml           # 웹 중심 pnpm 워크스페이스
└── AGENTS.md                     # 프로젝트 개발 규칙
```

테스트 파일은 주로 `app/web/src/**/*.test.ts(x)`에 구현과 함께 둡니다. Flutter 프로젝트는 pnpm 워크스페이스와 별도로 관리합니다.

## 더 자세한 문서

| 문서 | 내용 |
| --- | --- |
| [프로젝트 목표](docs/goal.md) | 대상 사용자, 출품 목표, 성공 기준과 범위 |
| [기능 명세](docs/features.md) | F0~F5 요구사항과 수용 기준 |
| [기술 스택](docs/tech-stack.md) | 사용 기술과 선택 이유 |
| [데이터 모델](docs/data-model.md) | 계정·레이스·친구·신호·운영 데이터 구조 |
| [디자인](docs/design.md) | 테마 토큰, 컴포넌트, 레이스 장면 |
| [배포](docs/deploy.md) | Vercel·Supabase, 환경 변수, 도메인, 정산, 관리자 설정 |
| [푸시 설정](docs/push-setup.md) | FCM·APNs와 네이티브 알림 |
| [iOS 릴리스](docs/ios-release.md) | 서명, App Store Connect, 심사 제출 절차 |
| [기술 결정 기록](docs/decisions/) | 구조·인증·실시간·정산 등에 대한 ADR |
| [개발 규칙](AGENTS.md) · [웹 개발 규칙](app/web/AGENTS.md) | 문서 우선 변경, 마이그레이션, Next.js 16 안내, 완료 기준 |

기능을 변경할 때는 `docs/features.md`를, 데이터 구조를 바꿀 때는 `docs/data-model.md`를 먼저 갱신합니다. 새로운 기술 선택은 `docs/decisions/`에 ADR로 남깁니다.
