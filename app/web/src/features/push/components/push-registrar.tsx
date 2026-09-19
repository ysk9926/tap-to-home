"use client";

import { usePushRegistration } from "../hooks/use-push-registration";

/**
 * 로그인한 화면에 한 번 놓는다. 화면에 아무것도 그리지 않고, 웹뷰 안일 때만
 * 알림 권한 요청과 토큰 등록을 수행한다 (ADR 0006).
 */
export function PushRegistrar() {
  usePushRegistration();
  return null;
}
