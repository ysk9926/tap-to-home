/**
 * 웹 ↔ Flutter 웹뷰 브릿지 규약 (ADR 0006).
 *
 * 방향이 둘이고 수단이 다르다.
 *   웹 → 앱:  window.TapToHome.postMessage(JSON.stringify(msg))   — JS 채널
 *   앱 → 웹:  window.TapToHomeNative.<함수>(...)                   — runJavaScript 로 호출
 *
 * 이 파일의 타입이 `app/mobile/lib/main.dart` 와의 계약이다. 한쪽을 고치면 다른 쪽도 고친다.
 */

/** 웹이 앱에게 보내는 메시지 */
export type BridgeMessage =
  /** 알림 권한을 물어보고, 승인되면 토큰을 registerPushToken 으로 돌려달라 */
  | { type: "push:request" }
  /** 로그아웃했으니 이 기기 토큰을 서버에서 지워달라 */
  | { type: "push:logout" }
  /** 연타 피드백. 웹뷰 셸이 네이티브 햅틱을 울린다 */
  | { type: "haptic"; style: "light" | "medium" | "heavy" };

type TapToHomeChannel = { postMessage(message: string): void };

declare global {
  interface Window {
    /** Flutter 가 주입하는 JS 채널. 브라우저에서는 없다 */
    TapToHome?: TapToHomeChannel;
    /** 앱이 호출할 수 있도록 웹이 노출하는 함수들 */
    TapToHomeNative?: {
      registerPushToken(token: string, platform: string): void;
    };
  }
}

/** 웹뷰 안에서 돌고 있는가. 브라우저면 false */
export function isNativeShell(): boolean {
  return typeof window !== "undefined" && typeof window.TapToHome?.postMessage === "function";
}

/** 앱에게 한 마디. 브라우저에서는 조용히 무시된다 */
export function postToNative(message: BridgeMessage): void {
  if (!isNativeShell()) return;
  try {
    window.TapToHome?.postMessage(JSON.stringify(message));
  } catch {
    // 브릿지가 없거나 앱이 먼저 닫힌 경우. 알릴 대상이 없으므로 조용히 넘어간다
  }
}
