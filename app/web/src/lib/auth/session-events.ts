export const SESSION_EXPIRED_EVENT = "tap-to-home:session-expired";

export function notifySessionExpired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export function notifySessionExpiredForStatus(status: number): boolean {
  if (status !== 401) return false;
  notifySessionExpired();
  return true;
}

export function subscribeSessionExpired(listener: () => void): () => void {
  window.addEventListener(SESSION_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
}
