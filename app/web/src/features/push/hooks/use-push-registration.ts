"use client";

import { useEffect } from "react";
import { isNativeShell, postToNative } from "../bridge";

const PLATFORMS = new Set(["ios", "android"]);

async function uploadToken(token: string, platform: string): Promise<void> {
  if (!PLATFORMS.has(platform)) return;
  try {
    await fetch("/api/push/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, platform }),
    });
  } catch {
    // 앱은 실행할 때마다 토큰을 올린다. 한 번 실패해도 다음 실행에서 복구된다
  }
}

/**
 * 웹뷰 안에서만 동작한다 (ADR 0006).
 *
 * 앱에게 알림 권한을 요청하고, 앱이 FCM 토큰을 받아 `TapToHomeNative.registerPushToken`
 * 으로 돌려주면 서버에 저장한다. 브라우저에서는 아무 일도 하지 않는다 — iOS 웹뷰에서
 * Web Push 가 동작하지 않아 네이티브 경로 하나만 쓴다.
 *
 * 로그인한 화면(앱 레이아웃)에서만 호출해야 한다. 토큰 저장에 세션이 필요하다.
 */
export function usePushRegistration(): void {
  useEffect(() => {
    if (!isNativeShell()) return;

    window.TapToHomeNative = {
      registerPushToken(token: string, platform: string) {
        void uploadToken(token, platform);
      },
    };

    // 앱이 권한을 묻고, 승인되면 위 함수로 토큰을 돌려준다
    postToNative({ type: "push:request" });

    return () => {
      window.TapToHomeNative = undefined;
    };
  }, []);
}
