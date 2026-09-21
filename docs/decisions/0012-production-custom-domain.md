# 0012. 운영 도메인과 기존 앱 주소 전환

2026-09-21 · 결정됨

## 맥락

가비아에서 구매한 `taptohome.site`를 운영 주소로 사용한다. 이미 배포한 Flutter 웹뷰 앱은 빌드 시 주입한 `https://tap-to-home-web.vercel.app`을 열기 때문에 기존 주소를 계속 제공해야 한다. Vercel Cron은 리다이렉트를 따라가지 않으므로 도메인 전체를 일괄 이동시키면 정산 요청에 영향을 줄 수 있다.

## 결정

- 가비아 DNS의 A 레코드를 Vercel 권장 값으로 연결한다. HTTPS 인증서 발급·갱신은 Vercel이 담당한다.
- `next.config.ts`의 `redirects`에 기존 운영 호스트만 일치하는 규칙을 둔다. 경로·쿼리를 보존하며 `/api/cron`과 하위 경로는 제외한다. Preview·로컬·새 운영 주소에는 적용하지 않는다.
- 초기 전환은 307을 사용해 클라이언트에 영구 캐시를 남기지 않는다. 도메인 문제 발생 시 규칙 제거와 이전 배포 복구로 되돌릴 수 있다.
- Production의 `BETTER_AUTH_URL`·`NEXT_PUBLIC_APP_URL`은 모두 `https://taptohome.site`로 맞춘 뒤 웹을 재배포한다. Better Auth는 서버 `baseURL`의 origin을 신뢰 목록에 포함하며 관리자 origin 검사도 이 값을 사용한다.
- Flutter 셸과 앱 배포 파일은 변경하지 않는다. 다음 앱 릴리스부터 새 HTTPS 주소를 `WEB_URL`로 주입한다.

## 결과와 확인

- 기존 도메인의 쿠키는 새 도메인으로 전달되지 않으므로 기존 사용자는 다시 로그인한다. 계정과 플레이 기록은 같은 DB에 유지된다.
- Vercel Domains의 도메인 전체 리다이렉트는 추가하지 않는다. 기존 운영 별칭은 계속 이 프로젝트에 연결한다.
- Next.js의 실제 설정 테스트 도구로 호스트·경로·쿼리 보존 및 정산 경로 제외를 검증한다. 배포 후 HTTPS, 로그인 origin, 기존 주소 이동, 정산 요청이 3xx를 반환하지 않는지 확인한다.

## 근거

- [Vercel SSL 자동 발급·갱신](https://vercel.com/docs/domains/working-with-ssl)
- [Vercel Cron과 리다이렉트](https://vercel.com/docs/cron-jobs/manage-cron-jobs#cron-jobs-and-redirects)
- Next.js 16 로컬 문서: `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md`
