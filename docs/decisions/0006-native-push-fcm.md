# ADR 0006 — 네이티브 푸시는 FCM, 토큰은 JS 브릿지로 받는다

날짜: 2026-09-19 · 상태: 채택

## 문제

F2 퇴근 신호는 지금 앱이 켜져 있을 때만 닿는다. 전달 경로가 인앱 토스트(Realtime 브로드캐스트)와 폴링 두 가지뿐이라, 화면을 닫은 친구는 신호를 받지 못한다. "회사에서 몰래 켜서 몇 초 안에 누르고 닫는다"(`goal.md`)는 사용 패턴에서 받는 쪽은 대개 앱이 꺼져 있으므로, 백그라운드 전달이 없으면 F2 의 절반이 동작하지 않는 셈이다.

`goal.md` 는 "푸시 알림은 웹 푸시 우선, 네이티브 푸시는 시간이 남으면"으로 적고 있었다. 이 ADR 은 그 우선순위를 뒤집는다.

## 선택지

| 안 | 내용 | 장점 | 단점 |
| --- | --- | --- | --- |
| A | Web Push (VAPID) + Service Worker | Firebase·APNs 키 불필요, 웹만으로 완결, 브라우저 표준 | **iOS `webview_flutter`(WKWebView) 안에서 Notification 권한 요청이 동작하지 않는다.** 앱 사용자에게 닿지 않아 목적을 달성하지 못함 |
| B | FCM 네이티브 푸시. Flutter 가 토큰을 받고 JS 채널로 웹에 넘긴다 | 앱이 꺼져 있어도 도착, iOS·Android 한 경로, 이미 Firebase 프로젝트가 있음 | 의존성 추가(Firebase SDK), APNs 키 관리, 빌드에 `GoogleService-Info.plist` 필요 |
| C | 둘 다 (웹은 VAPID, 앱은 FCM) | 브라우저 사용자도 커버 | 발송 경로가 둘로 갈려 중복 발송·정합성 관리 비용. 대회 일정에 부담 |

## 결정

**B 안.** 네이티브 푸시를 FCM 으로 붙이고, 웹 푸시(VAPID)는 하지 않는다.

A 안을 먼저 적으려 했으나 전제가 성립하지 않는다. iOS 에서 Web Push 는 홈 화면에 추가한 PWA 에서만 허용되고, `WKWebView` 를 쓰는 웹뷰 셸 안에서는 권한 요청 자체가 거부된다. 이 앱의 iOS 사용자는 전원 웹뷰 안에 있으므로 A 안은 iOS 에서 0명에게 닿는다.

C 안은 발송 지점(`sendSignal`)에서 수신자마다 채널을 갈라야 하고, 같은 사용자가 브라우저와 앱을 함께 쓰면 중복 알림이 간다. 출품 일정에서 감당할 복잡도가 아니다.

### 경계

- **토큰 발급은 네이티브, 저장·발송은 웹 서버.** Flutter 는 FCM 토큰을 받아 `TapToHome` JS 채널로 웹에 넘기기만 한다. 웹이 `POST /api/push/tokens` 로 자기 서버에 저장한다. 이 분리 덕에 `app/mobile` 은 계속 "기능 로직 없는 껍데기"로 남는다(`AGENTS.md`).
- **발송은 `sendSignal` 안에서 하지 않는다.** route handler 가 `after()` 안에서 Realtime 브로드캐스트와 나란히 호출한다. 푸시 실패가 신호 저장을 되돌리면 안 된다.
- **서버 키는 서비스 계정 JWT.** 레거시 서버 키(`AAAA…`)는 2024 년에 폐기됐다. `FIREBASE_SERVICE_ACCOUNT_JSON` 한 개 환경 변수에 서비스 계정 JSON 을 통째로 넣고, 런타임에 OAuth 토큰을 만들어 HTTP v1 API 를 호출한다.
- **firebase-admin SDK 를 쓰지 않는다.** Node 런타임 의존성이 크고 서버리스 콜드 스타트에 불리하다. 토큰 발급과 발송 모두 `fetch` 로 직접 한다(`src/features/push/server/fcm.ts`). 서명은 Web Crypto 로 만든다.

### 중복 알림 억제

인앱 토스트를 이미 본 사용자에게 푸시가 또 가면 안 된다. 다만 "지금 화면을 보고 있는가"는 서버가 확실히 알 수 없으므로, [ADR 0007](./0007-shared-realtime-and-query-reconciliation.md)의 실제 수신 확인을 기준으로 다음과 같이 근사한다.

- Realtime 서버가 브로드캐스트를 접수한 사실은 사용자의 수신이나 표시를 뜻하지 않는다. 보이는 화면에서 토스트를 표시한 클라이언트가 `POST /api/signals/read`로 확인했거나, 미읽음 폴링이 신호를 가져갔을 때만 `readAt`을 채운다.
- 저장된 모든 신호 ID를 Realtime 브로드캐스트 결과와 관계없이 푸시 검사에 전달한다. 별도 지연 타이머는 두지 않으며, 발송 직전에 `readAt`이 여전히 `null`인 신호만 FCM 대상으로 삼는다.
- 인앱 수신 확인과 FCM 발송이 동시에 진행되면 인앱 토스트와 푸시가 둘 다 도착할 수 있다. 이 구조는 브로드캐스트 접수만으로 푸시가 누락되는 문제를 막지만 정확히 한 번 전달을 보장하지 않는다.

## 데이터

`push_token` 테이블 한 개를 추가한다(`data-model.md`). 한 사용자가 기기를 여러 개 쓸 수 있으므로 `userId` 에 대해 여러 행이다. 토큰은 FCM 이 재발급할 수 있으므로 `token` 이 unique 이고, 같은 토큰이 다른 계정에서 다시 올라오면 소유자를 바꾼다(기기를 물려준 경우).

발송이 `NotRegistered` / `InvalidRegistration` 을 돌려주면 그 행을 지운다. 죽은 토큰을 쌓아두면 발송 비용만 는다.

## 결과

- 앱을 닫아도 퇴근 신호가 도착한다. F2 가 의도대로 동작한다.
- `app/mobile` 에 Firebase 의존성 2개(`firebase_core`, `firebase_messaging`)가 생긴다. 웹뷰 셸 원칙은 유지된다 — 토큰을 전달할 뿐 신호 로직은 웹에 있다.
- 빌드에 `GoogleService-Info.plist`(iOS)와 `google-services.json`(Android)이 필요하다. 둘 다 git 에 올리지 않고 빌드 머신에 둔다.
- 브라우저로만 쓰는 사용자는 백그라운드 알림을 받지 못한다. 인앱 토스트와 폴링은 그대로 동작한다. 필요해지면 C 안으로 올린다.
