# Tap to Home

버튼을 누를수록 내 졸라맨이 먼저 퇴근하는 정신적 탈출 레이스. 원티드 AI 챔피언십 2026 출품작.

- 기획·목표: [docs/goal.md](docs/goal.md)
- 기능 명세: [docs/features.md](docs/features.md)
- 기술 스택: [docs/tech-stack.md](docs/tech-stack.md)
- 배포 (Vercel + Supabase): [docs/deploy.md](docs/deploy.md)
- 에이전트/개발 규칙: [AGENTS.md](AGENTS.md)

## 시작하기

```bash
pnpm install                           # postinstall 에서 prisma generate 실행
cp app/web/.env.example app/web/.env   # BETTER_AUTH_SECRET, Supabase 값 채우기
pnpm db:migrate                        # 스키마 변경 시 (초기 마이그레이션은 Supabase 에 적용됨)
pnpm dev                               # http://localhost:3000
```

모바일 (웹뷰 셸):

```bash
cd app/mobile
flutter run --dart-define=WEB_URL=http://localhost:3000
```

Android 에뮬레이터에서는 `http://10.0.2.2:3000` 을 사용한다.

로컬 Postgres 로 개발하려면 `pnpm db:up` 후 `.env` 의 `DATABASE_URL`/`DIRECT_URL` 을 localhost 값으로 바꾼다.
