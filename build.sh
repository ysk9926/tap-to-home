#!/bin/bash
set -e

# ============================================================
# Tap to Home 모바일 앱 빌드 & 버전 관리 스크립트 (대화형)
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
MOBILE_DIR="$PROJECT_DIR/app/mobile"
PUBSPEC_YAML="$MOBILE_DIR/pubspec.yaml"
OUTPUT_DIR="$PROJECT_DIR/build-output"

# 기본 웹 URL (docs/ios-release.md, lib/main.dart 기준)
DEFAULT_PROD_URL="https://taptohome.site"
DEFAULT_LOCAL_ANDROID_URL="http://10.0.2.2:3000"
DEFAULT_LOCAL_IOS_URL="http://localhost:3000"

# 터미널 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${CYAN}→ $1${NC}"
}

# ============================================================
# 대화형 입력 헬퍼
# ============================================================

prompt_choice() {
    local prompt_msg="$1"
    local max="$2"
    local choice

    while true; do
        echo "" >&2
        echo -ne "${BOLD}${prompt_msg}${NC} " >&2
        read -r choice </dev/tty

        # 빈 입력 또는 q/Q 처리
        if [[ "$choice" == "q" || "$choice" == "Q" ]]; then
            echo "" >&2
            print_info "종료합니다." >&2
            exit 0
        fi

        if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "$max" ]; then
            echo "$choice"
            return 0
        fi

        print_error "1~${max} 사이의 숫자를 입력해주세요. (q: 종료)" >&2
    done
}

prompt_confirm() {
    local prompt_msg="$1"
    local answer

    echo ""
    echo -ne "${BOLD}${prompt_msg} (Y/n):${NC} "
    read -r answer </dev/tty

    case "$answer" in
        [nN]|[nN][oO]) return 1 ;;
        *) return 0 ;;
    esac
}

prompt_input() {
    local prompt_msg="$1"
    local default_val="$2"
    local value

    echo "" >&2
    if [ -n "$default_val" ]; then
        echo -ne "${BOLD}${prompt_msg} [기본값: ${default_val}]:${NC} " >&2
    else
        echo -ne "${BOLD}${prompt_msg}:${NC} " >&2
    fi
    read -r value </dev/tty

    if [ -z "$value" ] && [ -n "$default_val" ]; then
        echo "$default_val"
    else
        echo "$value"
    fi
}

# ============================================================
# 클립보드 복사 헬퍼 (macOS)
# ============================================================

copy_file_to_clipboard() {
    local file_path="$1"
    if [[ "$OSTYPE" == "darwin"* ]] && command -v osascript &>/dev/null; then
        if [ -f "$file_path" ]; then
            osascript -e "set the clipboard to (POSIX file \"$file_path\")" 2>/dev/null || true
            print_success "클립보드에 파일 복사 완료: $(basename "$file_path") (⌘V로 슬랙/메신저에 바로 붙여넣기 가능)"
        fi
    fi
}

# ============================================================
# 버전 / 빌드 번호 관리 (pubspec.yaml 기준)
# ============================================================

get_version() {
    grep -E '^version:' "$PUBSPEC_YAML" | sed -E 's/^version:[[:space:]]*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)/\1/'
}

get_build_number() {
    grep -E '^version:' "$PUBSPEC_YAML" | sed -E 's/^version:[[:space:]]*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)/\2/'
}

set_pubspec_version() {
    local NEW_VERSION="$1"
    local NEW_BUILD="$2"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' -E "s/^(version:[[:space:]]*)[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+/\1${NEW_VERSION}+${NEW_BUILD}/" "$PUBSPEC_YAML"
    else
        sed -i -E "s/^(version:[[:space:]]*)[0-9]+\.[0-9]+\.[0-9]+/\1${NEW_VERSION}+${NEW_BUILD}/" "$PUBSPEC_YAML"
    fi
}

show_version() {
    local current_version=$(get_version)
    local current_build=$(get_build_number)

    echo ""
    echo -e "${DIM}────────────────────────────────────────────────────${NC}"
    echo -e "  ${BOLD}Tap to Home Mobile${NC}  버전: ${GREEN}${current_version}${NC}  빌드: ${GREEN}${current_build}${NC} (${CYAN}v${current_version}+${current_build}${NC})"
    echo -e "  ${DIM}* pubspec.yaml 의 버전이 Android (versionName/Code) 및 iOS 에 자동 반영됩니다.${NC}"
    echo -e "${DIM}────────────────────────────────────────────────────${NC}"
}

bump_build_number() {
    local current_version=$(get_version)
    local current_build=$(get_build_number)
    local new_build=$((current_build + 1))

    echo ""
    echo -e "  이전 빌드: ${YELLOW}${current_build}${NC} (버전: ${current_version})"
    echo -e "  변경 빌드: ${GREEN}${new_build}${NC} (v${current_version}+${new_build})"

    set_pubspec_version "$current_version" "$new_build"
    print_success "빌드 번호 업데이트 완료 → ${new_build}"
}

set_version() {
    local NEW_VERSION="$1"

    if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
        print_error "버전 형식이 올바르지 않습니다: $NEW_VERSION (예: 1.0.3)"
        return 1
    fi

    local old_version=$(get_version)
    local current_build=$(get_build_number)

    set_pubspec_version "$NEW_VERSION" "$current_build"
    print_success "버전 변경 완료: ${old_version} → ${NEW_VERSION} (빌드: ${current_build})"
}

set_build() {
    local NEW_BUILD="$1"

    if ! echo "$NEW_BUILD" | grep -qE '^[0-9]+$'; then
        print_error "빌드 번호는 정수여야 합니다: $NEW_BUILD (예: 3)"
        return 1
    fi

    local current_version=$(get_version)
    local old_build=$(get_build_number)

    set_pubspec_version "$current_version" "$NEW_BUILD"
    print_success "빌드 번호 변경 완료: ${old_build} → ${NEW_BUILD}"
}

# ============================================================
# 대상 웹 URL 선택 헬퍼
# ============================================================

select_web_url() {
    local platform="$1" # android 또는 ios
    local default_local="$DEFAULT_LOCAL_ANDROID_URL"
    if [ "$platform" = "ios" ]; then
        default_local="$DEFAULT_LOCAL_IOS_URL"
    fi

    # 환경변수 WEB_URL 이 사전에 설정되어 있으면 우선 사용
    if [ -n "$WEB_URL" ]; then
        echo "$WEB_URL"
        return 0
    fi

    echo "" >&2
    echo -e "  ${BOLD}웹 서버 대상 URL 선택 (WEB_URL)${NC}" >&2
    echo -e "  ${BOLD}1)${NC} 프로덕션       ${DIM}(${DEFAULT_PROD_URL})${NC}" >&2
    echo -e "  ${BOLD}2)${NC} 로컬 개발       ${DIM}(${default_local})${NC}" >&2
    echo -e "  ${BOLD}3)${NC} 직접 입력" >&2

    local choice
    choice=$(prompt_choice "선택>" 3)

    case "$choice" in
        1) echo "$DEFAULT_PROD_URL" ;;
        2) echo "$default_local" ;;
        3)
            local custom_url
            custom_url=$(prompt_input "사용할 웹 URL 입력" "$DEFAULT_PROD_URL")
            echo "$custom_url"
            ;;
    esac
}

# ============================================================
# 빌드 함수
# ============================================================

clean() {
    print_header "빌드 산출물 및 캐시 정리"

    if [ -d "$OUTPUT_DIR" ]; then
        rm -rf "$OUTPUT_DIR"
        print_success "build-output 폴더 삭제 완료"
    fi

    if [ -d "$MOBILE_DIR" ]; then
        (cd "$MOBILE_DIR" && flutter clean)
        print_success "Flutter clean 완료"
    fi

    print_success "정리 작업 완료"
}

build_android_apk() {
    local BUILD_TYPE="$1" # release 또는 debug
    local WEB_URL="$2"
    local ver=$(get_version)
    local bld=$(get_build_number)

    if [ -z "$WEB_URL" ]; then
        WEB_URL=$(select_web_url "android")
    fi

    local BUILD_TYPE_UPPER="$(echo "$BUILD_TYPE" | tr '[:lower:]' '[:upper:]')"
    print_header "Android APK 빌드 (${BUILD_TYPE_UPPER}) - v${ver}+${bld}"

    mkdir -p "$OUTPUT_DIR/android"

    echo "모바일 디렉토리: $MOBILE_DIR"
    echo "빌드 타입: $BUILD_TYPE"
    echo "버전 명: $ver"
    echo "빌드 번호: $bld"
    echo "주입 웹 URL: $WEB_URL"
    echo ""

    (
        cd "$MOBILE_DIR"
        flutter build apk \
            --${BUILD_TYPE} \
            --dart-define=WEB_URL="${WEB_URL}"
    )

    local SRC_APK="$MOBILE_DIR/build/app/outputs/flutter-apk/app-${BUILD_TYPE}.apk"
    if [ -f "$SRC_APK" ]; then
        local TARGET_NAME="tap-to-home-v${ver}+${bld}-${BUILD_TYPE}.apk"
        local TARGET_PATH="$OUTPUT_DIR/android/$TARGET_NAME"
        local ZIP_PATH="$OUTPUT_DIR/android/tap-to-home-v${ver}+${bld}-${BUILD_TYPE}.zip"

        cp "$SRC_APK" "$TARGET_PATH"
        print_success "Android APK 빌드 성공!"
        echo "산출물: $TARGET_PATH"

        # zip 압축 생성 및 클립보드 복사
        (cd "$OUTPUT_DIR/android" && zip -q -j "$ZIP_PATH" "$TARGET_PATH")
        if [ -f "$ZIP_PATH" ]; then
            copy_file_to_clipboard "$ZIP_PATH"
        else
            copy_file_to_clipboard "$TARGET_PATH"
        fi
    else
        print_error "APK 산출물을 찾을 수 없습니다: $SRC_APK"
        exit 1
    fi
}

build_android_aab() {
    local WEB_URL="$1"
    local ver=$(get_version)
    local bld=$(get_build_number)

    if [ -z "$WEB_URL" ]; then
        WEB_URL=$(select_web_url "android")
    fi

    print_header "Android AAB 빌드 (Play Store 배포용) - v${ver}+${bld}"

    mkdir -p "$OUTPUT_DIR/android"

    echo "모바일 디렉토리: $MOBILE_DIR"
    echo "버전 명: $ver"
    echo "빌드 번호: $bld"
    echo "주입 웹 URL: $WEB_URL"
    echo ""

    (
        cd "$MOBILE_DIR"
        flutter build appbundle \
            --release \
            --dart-define=WEB_URL="${WEB_URL}"
    )

    local SRC_AAB="$MOBILE_DIR/build/app/outputs/bundle/release/app-release.aab"
    if [ -f "$SRC_AAB" ]; then
        local TARGET_NAME="tap-to-home-v${ver}+${bld}-release.aab"
        local TARGET_PATH="$OUTPUT_DIR/android/$TARGET_NAME"

        cp "$SRC_AAB" "$TARGET_PATH"
        print_success "Android AAB 빌드 성공!"
        echo "산출물: $TARGET_PATH"

        copy_file_to_clipboard "$TARGET_PATH"
    else
        print_error "AAB 산출물을 찾을 수 없습니다: $SRC_AAB"
        exit 1
    fi
}

build_ios_simulator() {
    local WEB_URL="$1"
    local ver=$(get_version)
    local bld=$(get_build_number)

    if [ -z "$WEB_URL" ]; then
        WEB_URL=$(select_web_url "ios")
    fi

    print_header "iOS 시뮬레이터 빌드 - v${ver}+${bld}"

    echo "모바일 디렉토리: $MOBILE_DIR"
    echo "주입 웹 URL: $WEB_URL"
    echo ""

    (
        cd "$MOBILE_DIR"
        flutter build ios --simulator --debug --dart-define=WEB_URL="${WEB_URL}"
    )

    print_success "iOS 시뮬레이터 빌드 성공"
}

build_ios_ipa() {
    local WEB_URL="$1"
    local ver=$(get_version)
    local bld=$(get_build_number)

    if [ -z "$WEB_URL" ]; then
        WEB_URL=$(select_web_url "ios")
    fi

    print_header "iOS 배포 아카이브 빌드 (.ipa) - v${ver}+${bld}"

    mkdir -p "$OUTPUT_DIR/ios"

    echo "모바일 디렉토리: $MOBILE_DIR"
    echo "주입 웹 URL: $WEB_URL"
    echo ""

    (
        cd "$MOBILE_DIR"
        flutter build ipa --release --dart-define=WEB_URL="${WEB_URL}"
    )

    local SRC_IPA=$(find "$MOBILE_DIR/build/ios/ipa" -name "*.ipa" 2>/dev/null | head -1)
    if [ -n "$SRC_IPA" ] && [ -f "$SRC_IPA" ]; then
        local TARGET_NAME="tap-to-home-v${ver}+${bld}.ipa"
        local TARGET_PATH="$OUTPUT_DIR/ios/$TARGET_NAME"

        cp "$SRC_IPA" "$TARGET_PATH"
        print_success "iOS IPA 내보내기 성공!"
        echo "산출물: $TARGET_PATH"

        copy_file_to_clipboard "$TARGET_PATH"
    else
        print_warning "IPA 파일을 찾지 못했거나 아카이브만 생성되었습니다."
        print_info "Xcode Organizer(Window > Organizer > Archives)에서 배포를 진행할 수 있습니다."
    fi
}

# ============================================================
# 대화형 메뉴
# ============================================================

menu_version() {
    print_header "버전 / 빌드 번호 관리"
    show_version

    echo ""
    echo -e "  ${BOLD}1)${NC} 빌드 번호 +1 (bump)"
    echo -e "  ${BOLD}2)${NC} 앱 버전 변경 (set-version, 예: 1.0.3)"
    echo -e "  ${BOLD}3)${NC} 빌드 번호 직접 지정 (set-build, 예: 5)"
    echo -e "  ${BOLD}4)${NC} 돌아가기"

    local choice
    choice=$(prompt_choice "선택>" 4)

    case "$choice" in
        1)
            bump_build_number
            show_version
            ;;
        2)
            local ver
            ver=$(prompt_input "새 버전 입력 (예: 1.0.3)")
            if [ -n "$ver" ]; then
                set_version "$ver"
                show_version
            else
                print_error "버전이 입력되지 않았습니다."
            fi
            ;;
        3)
            local build_num
            build_num=$(prompt_input "새 빌드 번호 입력 (예: 3)")
            if [ -n "$build_num" ]; then
                set_build "$build_num"
                show_version
            else
                print_error "빌드 번호가 입력되지 않았습니다."
            fi
            ;;
        4) return ;;
    esac
}

menu_build() {
    print_header "빌드 메뉴"
    show_version

    echo ""
    echo -e "  ${BOLD}── Android ──${NC}"
    echo -e "  ${BOLD}1)${NC} Android Release APK  ${DIM}(실기기 설치 / 테스트 배포용)${NC}"
    echo -e "  ${BOLD}2)${NC} Android Debug APK    ${DIM}(개발용)${NC}"
    echo -e "  ${BOLD}3)${NC} Android Release AAB  ${DIM}(Google Play Store 배포용 .aab)${NC}"
    echo ""
    echo -e "  ${BOLD}── iOS ──${NC}"
    echo -e "  ${BOLD}4)${NC} iOS Simulator        ${DIM}(시뮬레이터 빌드)${NC}"
    echo -e "  ${BOLD}5)${NC} iOS Release IPA      ${DIM}(TestFlight / App Store 배포용)${NC}"
    echo ""
    echo -e "  ${BOLD}── 전체 ──${NC}"
    echo -e "  ${BOLD}6)${NC} All Release          ${DIM}(Android AAB + iOS IPA)${NC}"
    echo ""
    echo -e "  ${BOLD}7)${NC} 돌아가기"

    local choice
    choice=$(prompt_choice "선택>" 7)

    if [ "$choice" -eq 7 ]; then
        return
    fi

    # 빌드 전 빌드 번호 bump 여부 확인
    if prompt_confirm "빌드 전에 빌드 번호를 +1 하시겠습니까?"; then
        bump_build_number
        show_version
    fi

    case "$choice" in
        1) build_android_apk "release" ;;
        2) build_android_apk "debug" ;;
        3) build_android_aab ;;
        4) build_ios_simulator ;;
        5) build_ios_ipa ;;
        6)
            local web_url
            web_url=$(select_web_url "android")
            build_android_aab "$web_url"
            build_ios_ipa "$web_url"
            print_header "전체 릴리스 배포 빌드 완료!"
            print_success "산출물: $OUTPUT_DIR/"
            ;;
    esac
}

menu_main() {
    while true; do
        print_header "Tap to Home 모바일 빌드 매니저"

        show_version

        echo ""
        echo -e "  ${BOLD}1)${NC} 모바일 빌드 (Android APK/AAB, iOS)"
        echo -e "  ${BOLD}2)${NC} 버전 / 빌드 번호 관리"
        echo -e "  ${BOLD}3)${NC} 빌드 산출물 정리 (clean)"
        echo -e "  ${BOLD}4)${NC} 종료"

        local choice
        choice=$(prompt_choice "선택>" 4)

        case "$choice" in
            1) menu_build ;;
            2) menu_version ;;
            3)
                if prompt_confirm "빌드 산출물과 캐시를 정리하시겠습니까?"; then
                    clean
                fi
                ;;
            4)
                echo ""
                print_info "종료합니다."
                exit 0
                ;;
        esac
    done
}

# ============================================================
# CLI 명령줄 직접 실행 모드 지원
# ============================================================

case "$1" in
    apk|apk:release)
        build_android_apk "release" "$2"
        ;;
    apk:debug)
        build_android_apk "debug" "$2"
        ;;
    aab|bundle)
        build_android_aab "$2"
        ;;
    ios|ipa)
        build_ios_ipa "$2"
        ;;
    ios:sim)
        build_ios_simulator "$2"
        ;;
    bump)
        bump_build_number
        ;;
    version)
        if [ -n "$2" ]; then
            set_version "$2"
        else
            show_version
        fi
        ;;
    build-number)
        if [ -n "$2" ]; then
            set_build "$2"
        else
            show_version
        fi
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        echo "사용법:"
        echo "  ./build.sh                     대화형 대시보드 실행 (권장)"
        echo "  ./build.sh apk                 Android Release APK 빌드"
        echo "  ./build.sh apk:debug           Android Debug APK 빌드"
        echo "  ./build.sh aab                 Android Release AAB 빌드"
        echo "  ./build.sh ios                 iOS Release IPA 빌드"
        echo "  ./build.sh bump                빌드 번호 +1"
        echo "  ./build.sh version <버전>       앱 버전 변경 (예: 1.0.3)"
        echo "  ./build.sh clean               빌드 산출물 정리"
        ;;
    *)
        # 인자가 없으면 대화형 메뉴 실행
        menu_main
        ;;
esac
