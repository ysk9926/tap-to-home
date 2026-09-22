# iOS 출시 — 애플 웹 콘솔 작업

브라우저에서 해야 하는 것만 순서대로. 로컬 Xcode 빌드는 이 문서 범위 밖이다.

## 빌드 환경 제약 (2026-09-19 확인)

개발 맥은 MacBookPro15,1 (Intel Core i9), macOS 15.7.7 이다. 여기서 나오는 제약:

- App Store 의 Xcode 는 27.0 이고 macOS 26.6 이상을 요구한다. 이 맥에서는 검색조차 되지 않는다.
- **Xcode 26.3 이 이 맥에서 쓸 수 있는 마지막 버전이다.** macOS 15.6 이상에서 돌고 Universal(Intel) 빌드가 있다. `xcodes install 26.3` 으로 받는다.
- 애플은 2026-04-28 부터 Xcode 26 이상 + iOS 26 SDK 로 빌드한 앱만 받는다. Xcode 26.3 은 iOS 26.2 SDK 를 포함하므로 **지금은 제출 가능하다**.
- Xcode 27 부터 Apple Silicon 전용이다. 애플이 iOS 27 SDK 를 의무화하면 이 맥으로는 제출할 수 없다. 그 시점은 아직 발표되지 않았다.
- 그때가 오면 Codemagic 이나 GitHub Actions `macos-26` 러너에서 릴리스 빌드만 돌린다. 개발은 계속 로컬에서 한다.

## 코드 쪽 완료된 설정 (2026-09-19)

| 항목 | 값 |
| --- | --- |
| 번들 ID | `com.taptohome.app` (`project.pbxproj` 6곳 반영) |
| 표시 이름 | `퇴근 레이스` (`CFBundleDisplayName`) |
| 버전 | `1.0.0+1` (`pubspec.yaml`) |
| 암호화 면제 | `ITSAppUsesNonExemptEncryption = false` |
| 화면 방향 | 세로 고정 (iPad 는 세로 양방향) |
| 개인정보 처리방침 | `app/web/src/app/privacy/page.tsx` → `/privacy` |

남은 것은 **Team ID 설정**(Xcode 에서 자동 서명 시 지정)과 **앱 아이콘 교체**다. 아이콘은 아직 Flutter 기본값이라 이 상태로 제출하면 리젝된다.

사이트가 둘로 나뉘어 있고, 역할이 다르다. 헷갈리면 엉뚱한 데서 헤매게 된다.

| 사이트 | 하는 일 |
| --- | --- |
| [developer.apple.com/account](https://developer.apple.com/account) | 번들 ID(Identifier) 등록, 인증서, 푸시 키 발급 |
| [appstoreconnect.apple.com](https://appstoreconnect.apple.com) | 앱 생성, 스크린샷·설명, 심사 제출, TestFlight |

푸시 알림은 현재 웹 코드에 구현돼 있지 않다(인앱 토스트만 있음). 그래도 **Identifier 등록 단계에서 미리 켜 두는 것이 낫다.** 나중에 켜는 것 자체는 가능하지만, 켜는 순간 프로비저닝 프로파일이 무효화돼 재빌드·재업로드가 필요하다. 지금 켜 두면 나중에 키만 발급받으면 된다.

---

## 1. Developer 포털 — Identifier 등록

번들 ID(Bundle Identifier)는 애플 생태계에서 이 앱을 가리키는 영구 주소다. **App Store 에 한 번 올리면 절대 못 바꾼다.** 앱 이름은 나중에 바꿔도 되지만 이건 안 된다.

현재 프로젝트 값은 Flutter 자동 생성값 `com.taptohome.tapToHomeMobile` 이다. 대문자 카멜케이스가 섞여 관례에 어긋나므로 `com.taptohome.app` 정도로 정하고 등록하는 것을 권한다. 형식은 역순 도메인이고, 해당 도메인을 실제로 소유할 필요는 없다. 소문자·숫자·하이픈·점만 쓴다.

**경로**: Certificates, Identifiers & Profiles → **Identifiers** → `+`

1. **Register a new identifier** 에서 **App IDs** 선택 → Continue
2. 타입은 **App** 선택 → Continue
3. 입력:

| 필드 | 값 |
| --- | --- |
| Description | `Tap to Home` (영문·숫자만, 내부 표시용) |
| Bundle ID | **Explicit** 선택 후 `com.taptohome.app` 입력 |

   Wildcard 를 고르면 푸시 알림을 못 쓴다. 반드시 Explicit.

4. **Capabilities** 목록에서 **Push Notifications** 체크. 나머지는 건드리지 않는다.
5. Continue → Register

이미 누가 선점한 ID 면 여기서 거부된다. 그때만 다른 값으로 바꾼다.

---

## 2. Developer 포털 — APNs 인증 키 발급

푸시를 실제로 붙일 때 서버가 쓸 키다. 1단계에서 Push Notifications 를 켰다면 지금 함께 받아 두는 게 낫다. 나중에 웹 서버에서 푸시를 보낼 때 이 키 파일이 필요하다.

**경로**: Certificates, Identifiers & Profiles → **Keys** → `+`

1. Key Name 에 `Tap to Home APNs` 입력
2. **Apple Push Notifications service (APNs)** 체크
3. Configure 버튼이 뜨면 Environment 를 **Sandbox & Production** 으로 둔다
4. Continue → Register
5. **Download** 를 눌러 `AuthKey_XXXXXXXXXX.p8` 파일을 받는다

**이 파일은 단 한 번만 받을 수 있다.** 다시 받을 수 없으니 잃어버리면 키를 폐기하고 새로 만들어야 한다. 1Password 같은 곳에 보관하고, 절대 git 에 커밋하지 않는다.

함께 적어 둘 값 세 개:

| 값 | 어디서 보나 |
| --- | --- |
| Key ID | 키 이름 옆 10자리. 파일명에도 들어 있다 |
| Team ID | 포털 우측 상단 또는 Membership 페이지의 10자리 |
| Bundle ID | 1단계에서 등록한 값 |

키 하나로 계정의 모든 앱에 푸시를 보낼 수 있다. 앱마다 새로 만들 필요 없다.

> 참고: 웹뷰 안의 웹 푸시(Web Push)는 이 APNs 키가 필요 없다. 브라우저 표준 VAPID 키를 쓰고 Apple 콘솔 작업이 아예 없다. `docs/goal.md` 는 "웹 푸시 우선" 이라고 적고 있으므로, 실제로 웹 푸시로 간다면 2단계는 건너뛰어도 된다. 다만 iOS 웹뷰 안에서는 웹 푸시 권한 요청이 제한되는 경우가 있어, 네이티브 APNs 로 가게 될 가능성을 감안해 키를 미리 받아 두는 쪽이 안전하다.

---

## 3. App Store Connect — 앱 생성

**경로**: [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **나의 앱** → `+` → **신규 앱**

| 필드 | 값 | 나중에 변경 |
| --- | --- | --- |
| 플랫폼 | iOS | — |
| 이름 | App Store 노출명. 30자 이내, 전 세계 고유 | 가능 |
| 기본 언어 | 한국어 | 가능 |
| 번들 ID | 드롭다운에서 1단계 Identifier 선택 | **불가** |
| SKU | `tap-to-home-ios` 같은 내부 관리용 임의 문자열. 공개 안 됨 | 불가 |
| 사용자 액세스 | 전체 액세스 | 가능 |

번들 ID 드롭다운에 아무것도 안 뜨면 1단계 등록이 아직 반영되지 않은 것이다. 몇 분 뒤 새로고침한다.

---

## 4. App Store Connect — 앱 정보와 가격

앱 생성 직후 좌측 메뉴에서 채워야 하는 것들이다. 순서대로 훑으면 빠진 게 없다.

**일반 → 앱 정보**

- 카테고리: 기본 `엔터테인먼트`, 보조 `소셜 네트워킹` 정도가 맞는다
- 콘텐츠 권한: 타사 콘텐츠를 쓰지 않으므로 "아니요"
- 연령 등급: 설문에 답하면 자동 산정. 경쟁 요소만 있고 폭력·성인 콘텐츠가 없어 4+ 가 나온다

**수익 창출 → 가격 및 사용 가능 여부**

- 가격: 무료
- 국가: 전체 또는 대한민국만. 챔피언십 심사용이면 전체로 둬도 무방하다

---

## 5. App Store Connect — 앱 개인정보 보호

**필수**이고 빠뜨리면 제출 버튼이 안 눌린다. 좌측 **일반 → 앱 개인정보 보호**.

### 개인정보 처리방침 URL

URL 입력란이 필수다. 페이지는 작성돼 있다(`app/web/src/app/privacy/page.tsx`). 배포 후 아래 URL 을 넣는다.

```
https://taptohome.site/privacy
```

`src/proxy.ts` 의 matcher 에 `/privacy` 가 없으므로 로그인 없이 열린다. 심사자가 못 열면 리젝이므로 배포 후 로그아웃 상태로 한 번 확인한다.

### 데이터 수집 선언

"데이터 수집" → 수집하는 항목을 체크한다. 실제 스키마(`prisma/schema.prisma`) 기준으로 선언할 항목은 이렇다.

| 항목 | 분류 | 용도 | 사용자 연결 | 추적 |
| --- | --- | --- | --- | --- |
| 아이디 | 식별자 → 사용자 ID | 앱 기능 | 연결됨 | 안 함 |
| 닉네임 | 연락처 정보 → 이름 | 앱 기능 | 연결됨 | 안 함 |
| 탭 기록·칭호 | 사용 데이터 → 제품 상호작용 | 앱 기능 | 연결됨 | 안 함 |

이메일은 받지 않는다. `user.email` 컬럼은 better-auth 가 필수로 요구해 아이디로 만든 자리표시값이 들어갈 뿐이고(`src/lib/auth/placeholder-email.ts`), 실제 메일함과 연결되지 않으므로 이메일 수집으로 선언하지 않는다.

세션에 IP 주소와 User-Agent 가 저장된다(`session` 테이블). 로그인 유지 목적이고 추적에 쓰지 않으므로 "진단" 이나 "식별자" 로 선언할 필요는 없다는 판단이지만, 보수적으로 가려면 "사용 데이터" 에 포함해도 된다.

푸시 토큰을 저장하게 되면 "기기 ID" 항목이 추가된다.

---

## 6. App Store Connect — 스토어 등록 정보

좌측 **iOS 앱 → 1.0 심사 준비 중**.

### 스크린샷 (필수)

6.9인치 세로 스크린샷 최소 1장, 최대 10장. 시뮬레이터에서 찍은 것도 된다. 레이스 화면, 친구 목록, 칭호 도감 세 장이면 충분하다.

하나의 크기만 올려도 나머지 기기에 자동 적용된다. 6.9인치만 준비하면 된다.

### 텍스트

| 필드 | 제한 | 내용 |
| --- | --- | --- |
| 프로모션 텍스트 | 170자 | 심사 없이 언제든 수정 가능 |
| 설명 | 4000자 | `docs/goal.md` 의 한 줄 정의와 타겟 문장을 풀어 쓴다 |
| 키워드 | 100자, 쉼표 구분 | `퇴근,직장인,게임,친구,연타,소셜` |
| 지원 URL | 필수 | 배포된 웹 URL 로 대체 가능 |
| 마케팅 URL | 선택 | 비워도 된다 |

### 빌드 선택

로컬에서 업로드한 빌드가 처리되면 여기 드롭다운에 뜬다. 업로드 후 TestFlight 에 반영되기까지 10~30분 걸린다.

---

## 7. App Store Connect — 심사 정보

같은 페이지 하단. **여기가 리젝의 절반이 갈리는 곳이다.**

### 로그인 필요

체크하고 테스트 계정 아이디·비밀번호를 적는다. 심사자가 로그인을 못 하면 그대로 리젝이다.

프로덕션 DB 에 심사용 계정을 미리 만들고, **그 계정에 친구 한 명과 탭 기록이 있어야 한다.** 친구가 없으면 레이스 화면에 캐릭터가 하나만 떠서 "기능이 동작하지 않는다"로 걸린다.

### 메모

웹뷰 셸이라는 점을 숨기지 말고, 앱으로서의 가치를 함께 적는다.

```
This app is a WebView shell for a web service.
All features run at https://taptohome.site

Test account:
  ID: reviewer
  PW: <password>

This account already has one friend and tap history,
so the race screen shows two characters moving.
```

### 연락처

심사 중 애플이 연락할 이름·이메일·전화번호. 실제로 받을 수 있는 번호를 적는다.

---

## 8. 제출

우측 상단 **심사를 위해 제출**. 이후 상태 흐름:

```
심사 대기 → 심사 중 → 승인됨 → 판매 준비됨
```

보통 24~48시간, 첫 제출은 더 걸릴 수 있다.

출시 방식은 **수동 릴리스**를 고른다. 승인돼도 자동 공개되지 않고, 챔피언십 일정에 맞춰 직접 버튼을 눌러 공개할 수 있다.

---

## 웹뷰 셸이 리젝되는 이유

가장 위험한 건 **가이드라인 4.2 Minimum Functionality** 다. "웹사이트를 그대로 감싼 앱" 으로 판정되면 거부된다.

- 심사 메모에서 웹 기반임을 밝히되, 홈 화면 즉시 실행·전체화면·햅틱 같은 앱으로서의 가치를 적는다
- `lib/main.dart` 의 `TapToHome` JS 채널에 햅틱 하나라도 실제 연결해 두면 네이티브 기능이 있다고 주장할 근거가 생긴다. 연타 앱이라 햅틱은 기능적으로도 자연스럽다
- 앱 안에서 모든 흐름이 끝나야 한다. 외부 브라우저로 튀는 링크가 없어야 한다

그 외 자주 걸리는 것:

- 테스트 계정 미제공 또는 로그인 실패 — 가장 흔한 리젝 사유
- 개인정보 처리방침 URL 누락 또는 접속 불가
- 기본 아이콘, 플레이스홀더 스크린샷
- 심사 시점에 웹 서버가 죽어 있어 빈 화면

---

## 체크리스트

**developer.apple.com**

```
[ ] Identifiers → App IDs → Explicit 로 com.taptohome.app 등록
[ ] Capabilities 에서 Push Notifications 체크
[ ] Keys → APNs 키 생성, .p8 다운로드 (단 한 번만 가능)
[ ] Key ID / Team ID / Bundle ID 세 값 기록
```

**appstoreconnect.apple.com**

```
[ ] 신규 앱 생성 (번들 ID 연결, SKU 지정)
[ ] 앱 정보 — 카테고리, 연령 등급 설문
[ ] 가격 — 무료, 판매 국가
[ ] 앱 개인정보 보호 — 처리방침 URL, 수집 항목 선언
[ ] 스토어 등록 정보 — 스크린샷 3장, 설명, 키워드, 지원 URL
[ ] 빌드 선택 (업로드 후 처리 완료 대기)
[ ] 심사 정보 — 테스트 계정, 메모, 연락처
[ ] 수동 릴리스 선택 후 제출
```

**웹 쪽 선행 작업**

```
[x] /privacy 페이지 작성 (app/web/src/app/privacy/page.tsx)
[ ] 배포 후 로그아웃 상태에서 /privacy 열리는지 확인
[ ] 프로덕션에 심사용 계정 + 친구 + 탭 기록 생성
[ ] production 웹이 심사 기간 내내 살아 있는지 확인
```

**로컬 빌드 준비**

```
[x] 번들 ID com.taptohome.app 로 변경
[x] CFBundleDisplayName 퇴근 레이스
[x] pubspec version 1.0.0+1
[x] ITSAppUsesNonExemptEncryption false
[x] 화면 세로 고정
[ ] xcodes install 26.3 (이 맥의 마지막 호환 버전)
[ ] Xcode → Runner → Signing & Capabilities → Team 선택
[ ] 앱 아이콘 1024 교체 (현재 Flutter 기본값 — 이대로면 리젝)
[ ] flutter build ipa --dart-define=WEB_URL=https://taptohome.site
```
