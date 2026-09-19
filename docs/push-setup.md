# 푸시 알림 설정 — Firebase 콘솔과 빌드 머신

코드는 모두 들어가 있다(ADR 0006). 남은 것은 **콘솔에서 키를 발급받아 설정 파일 두 개를 빌드 머신에 놓는 일**이다. 빌드 없이 할 수 있는 작업과 빌드 머신에서만 할 수 있는 작업을 나눠 적는다.

## 구조 한눈에

```
Flutter 셸                     웹 (app/web)                    서버
──────────                    ─────────────                   ──────
앱 시작
  Firebase.initializeApp()
                          ←  {"type":"push:request"}       (로그인 화면 진입 시)
알림 권한 요청
FCM 토큰 수신
  TapToHomeNative
   .registerPushToken()  →
                              POST /api/push/tokens      →  push_token upsert

                                                            친구가 연타
                                                            sendSignal() → signal 행
                                                            Realtime 브로드캐스트 시도
                                                              실패한 수신자만
                                                            sendSignalPush()
알림 도착           ←──────────────────────────────────────  FCM HTTP v1
```

토큰 발급만 네이티브가 하고, 저장·발송·중복 억제는 전부 웹 서버가 한다. 셸에 기능 로직을 넣지 않는다는 원칙(`AGENTS.md`)을 지키기 위해서다.

---

## 1. APNs 인증 키 발급 (Apple)

iOS 푸시는 Firebase 혼자 보낼 수 없다. 애플이 발급한 키를 Firebase 에 쥐여줘야 한다.

**경로**: [developer.apple.com/account/resources/authkeys/list](https://developer.apple.com/account/resources/authkeys/list) → `+`

1. Key Name: `Tap to Home APNs`
2. **Apple Push Notifications service (APNs)** 체크 → Configure 에서 **Sandbox & Production**
3. Continue → Register
4. **Download** → `AuthKey_XXXXXXXXXX.p8`

**이 파일은 한 번만 받을 수 있다.** 잃어버리면 키를 폐기하고 새로 만들어야 한다. git 에 넣지 않는다.

함께 적어 둘 값:

| 값 | 어디서 |
| --- | --- |
| Key ID | 파일명의 `XXXXXXXXXX`, 또는 Keys 목록 |
| Team ID | Membership details 페이지의 10자리 |

Identifier(`com.taptohome.app`)의 Capabilities 에 **Push Notifications** 가 켜져 있어야 한다. 꺼져 있으면 켠 뒤 프로비저닝 프로파일을 다시 받는다.

---

## 2. Firebase 콘솔 설정

### APNs 키 업로드

프로젝트 설정 → **클라우드 메시징** → Apple 앱 구성 → APNs 인증 키 → 업로드

`.p8` 파일과 Key ID, Team ID 를 넣는다. 이걸 빠뜨리면 토큰은 발급되지만 알림이 도착하지 않는다.

### 번들 ID 확인

프로젝트 설정 → 내 앱 → iOS 앱의 번들 ID 가 **`com.taptohome.app`** 인지 확인한다. Android 앱의 패키지 이름도 같은 값이어야 한다(`android/app/build.gradle.kts` 의 `applicationId` 를 여기에 맞춰 바꿨다).

다르면 알림이 가지 않는다. 다를 경우 Firebase 에서 앱을 새로 추가하는 편이 빠르다.

### 설정 파일 받기

| 파일 | 놓을 위치 |
| --- | --- |
| `GoogleService-Info.plist` | `app/mobile/ios/Runner/` |
| `google-services.json` | `app/mobile/android/app/` |

**둘 다 `.gitignore` 에 있다.** 키가 들어 있어 저장소에 올리지 않는다. 빌드 머신마다 직접 놓아야 한다.

iOS 쪽은 Xcode 프로젝트에 파일 참조와 리소스 빌드 페이즈가 이미 등록돼 있다. 파일만 저 경로에 놓으면 번들에 포함된다. Xcode 에서 드래그해 넣을 필요가 없다.

### 서비스 계정 키 (서버 발송용)

프로젝트 설정 → **서비스 계정** → 새 비공개 키 생성 → JSON 다운로드

받은 JSON 을 **통째로 한 줄로** 환경 변수에 넣는다.

```
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n..."}'
```

작은따옴표로 감싼다. `private_key` 안의 `\n` 때문에 큰따옴표를 쓰면 셸이 망가뜨린다.

Vercel 에 넣을 때:

```
cd app/web
vercel env add FIREBASE_SERVICE_ACCOUNT_JSON production --sensitive
```

레거시 서버 키(`AAAA…`)는 2024 년에 폐기됐다. 서비스 계정 JSON 만 쓴다.

---

## 3. Xcode 에서 확인할 것 (빌드 머신)

`project.pbxproj` 는 코드로 수정해 뒀다. Xcode 를 열면 아래가 이미 들어가 있어야 한다.

- Signing & Capabilities 에 **Push Notifications** capability
- Background Modes 의 **Remote notifications** (`Info.plist` 에 `remote-notification` 을 넣어 뒀다)
- Code Signing Entitlements 가 구성별로 지정됨

| 구성 | entitlements | aps-environment |
| --- | --- | --- |
| Debug | `Runner/Runner.entitlements` | development |
| Release | `Runner/RunnerRelease.entitlements` | production |
| Profile | `Runner/RunnerRelease.entitlements` | production |

Capabilities 목록에 Push Notifications 가 안 보이면 `+ Capability` 로 추가한다. entitlements 파일은 이미 있으므로 Xcode 가 새로 만들지 않고 기존 것을 인식한다.

**Team 선택은 빌드 머신에서 해야 한다.** Signing & Capabilities 에서 Apple ID 를 로그인하고 팀을 고른다. `DEVELOPMENT_TEAM` 이 비어 있는 상태로 커밋돼 있다.

---

## 4. 빌드

```
cd app/mobile
flutter build ipa --dart-define=WEB_URL=https://tap-to-home-web.vercel.app
flutter build apk --dart-define=WEB_URL=https://tap-to-home-web.vercel.app
```

`WEB_URL` 을 빠뜨리면 기본값 `http://localhost:3000` 이 박혀 빈 화면이 뜬다.

---

## 5. 동작 확인

푸시는 시뮬레이터에서 제대로 동작하지 않는다. **실기기가 필요하다.**

1. 앱 실행 → 알림 권한 다이얼로그가 뜨는지
2. 로그인 → 서버 로그나 DB 의 `push_token` 에 행이 생기는지
3. 앱을 **완전히 종료**
4. 다른 계정으로 친구를 10회 연타
5. 잠금 화면에 알림이 뜨는지

안 되면 확인 순서:

| 증상 | 볼 곳 |
| --- | --- |
| 권한 다이얼로그가 안 뜸 | 웹뷰 안에서 열었는지(`isNativeShell`), 로그인 화면인지 |
| `push_token` 이 비어 있음 | Xcode 콘솔의 `[push]` 로그. APNs 토큰 미준비면 재실행 |
| 토큰은 있는데 알림이 안 옴 | Firebase 에 APNs 키를 올렸는지, `aps-environment` 가 빌드와 맞는지 |
| 앱이 켜져 있을 때만 옴 | 정상이다. 인앱 토스트로 읽은 신호는 푸시하지 않는다 |
| 서버 로그에 `[push]` 경고 | `FIREBASE_SERVICE_ACCOUNT_JSON` 형식 확인 |

`FIREBASE_SERVICE_ACCOUNT_JSON` 이 비어 있으면 푸시를 조용히 건너뛰고 인앱 토스트만 동작한다. Realtime 과 같은 방침이라 로컬 개발에서 설정 없이도 돌아간다.

---

## 코드 위치

| 무엇 | 어디 |
| --- | --- |
| FCM HTTP v1 클라이언트 | `app/web/src/features/push/server/fcm.ts` |
| 토큰 저장·정리 | `app/web/src/features/push/server/tokens.ts` |
| 신호 푸시 발송 | `app/web/src/features/push/server/send-signal-push.ts` |
| 토큰 등록 API | `app/web/src/app/api/push/tokens/route.ts` |
| 웹↔앱 브릿지 규약 | `app/web/src/features/push/bridge.ts` |
| 권한 요청 훅 | `app/web/src/features/push/hooks/use-push-registration.ts` |
| Flutter 푸시 | `app/mobile/lib/push.dart` |
| JS 채널 분기 | `app/mobile/lib/main.dart` |

`bridge.ts` 의 타입과 `main.dart` 의 `_handleBridgeMessage` 가 계약이다. 한쪽을 고치면 다른 쪽도 고친다.
