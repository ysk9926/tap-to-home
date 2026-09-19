# ADR 0002 — 실시간 레이스 동기화 경로

날짜: 2026-09-19 · 상태: 채택 (A 안, Vercel + Supabase 확정)

## 문제

F1-2 는 친구의 탭이 1초 안에 내 화면에 반영돼야 한다. Vercel 의 서버리스/엣지 함수는 장시간 WebSocket 연결을 유지하지 못하므로 Next.js 만으로는 양방향 실시간을 만들 수 없다.

## 선택지

| 안 | 내용 | 장점 | 단점 |
| --- | --- | --- | --- |
| A | Supabase 에 PostgreSQL 을 호스팅하고 Supabase Realtime (broadcast 채널) 사용. 인증은 better-auth 유지 | 기획서 스택과 일치, 별도 서버 없음, 무료 티어로 데모 충분 | Realtime 권한을 RLS 대신 채널 토큰으로 직접 다뤄야 함 |
| B | 짧은 주기 폴링 (TanStack Query `refetchInterval` 1~2s) | 구현 가장 단순, 인프라 없음 | 친구 수 × 접속자 수만큼 요청, 1초 목표 아슬아슬 |
| C | 별도 WebSocket 서버 (Fly.io 등) | 자유도 최고 | 운영 대상 하나 추가, 대회 일정에 부담 |

## 결정

**A 안.** Postgres 는 Supabase 에 두고, 친구 위치 전파는 Supabase Realtime broadcast 채널을 쓴다. 인증은 better-auth 를 유지하고 Supabase Auth 와 RLS 는 사용하지 않는다.

- 브라우저: `src/lib/supabase/client.ts` 의 publishable 클라이언트로 내 채널 `u:{myId}` (signal 이벤트) 와 친구 채널 `u:{friendId}` (race 이벤트) 를 구독한다. 채널·이벤트 이름은 `src/features/realtime/channels.ts`.
- 서버: 탭 저장·신호 발송 route handler 가 `next/server` 의 `after()` 안에서 `src/features/realtime/server/broadcast.ts` (secret 키, REST `httpSend`) 로 보낸다. 실패해도 응답은 성공이고 폴링이 받쳐준다.
- 개방형 데모이므로 public 채널로 시작한다. 채널 인가가 필요해지면 Realtime Authorization(private channel + RLS on `realtime.messages`)으로 올린다.

Realtime 연결 전까지는 B 안(폴링, `refetchInterval` 2s)으로 화면을 먼저 동작시켜도 된다. 탭 저장 API 는 두 안에서 동일하다.

## 탭 저장 규칙 (두 안 공통)

- 클라이언트는 탭 즉시 로컬 카운트를 올리고(낙관적), 300ms 디바운스로 묶어 `POST /api/taps { count }` 로 보낸다.
- 서버는 `daily_run.tap_count += count` 를 원자적으로 갱신하고 `tap_event` 에 배치 1행을 남긴다.
- A 안에서는 갱신 후 채널에 `{ userId, tapCount, stage }` 를 브로드캐스트한다.
