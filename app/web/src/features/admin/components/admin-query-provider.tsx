"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export const ADMIN_AUTH_EXPIRED_EVENT = "tap-to-home:admin-auth-expired";
const ADMIN_AUTH_CHANNEL = "tap-to-home:admin-session";
const ADMIN_AUTH_STORAGE_KEY = "tap-to-home:admin-session-ended";

type AdminQueryControl = {
  purge: () => Promise<void>;
};

const AdminQueryContext = createContext<AdminQueryControl | null>(null);
const activeAdminRequests = new Set<AbortController>();

function abortAdminRequests() {
  for (const controller of activeAdminRequests) controller.abort();
  activeAdminRequests.clear();
}

export function notifyAdminSessionEnded() {
  if (typeof window === "undefined") return;
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(ADMIN_AUTH_CHANNEL);
    channel.postMessage("ended");
    channel.close();
  }
  try {
    window.localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, String(Date.now()));
  } catch {
    // 저장소가 막힌 브라우저에서도 현재 탭의 캐시 정리는 계속 진행한다.
  }
}

function makeAdminQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry(failureCount, error) {
          return !(error instanceof AdminRequestError && error.status < 500) && failureCount < 1;
        },
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export class AdminRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AdminRequestError";
  }
}

export async function adminFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  else init.signal?.addEventListener("abort", forwardAbort, { once: true });
  activeAdminRequests.add(controller);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });

    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(new Event(ADMIN_AUTH_EXPIRED_EVENT));
      throw new AdminRequestError("관리자 인증이 만료되었어요.", response.status);
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      throw new AdminRequestError(body?.error ?? body?.message ?? "요청을 처리하지 못했어요.", response.status);
    }

    return await response.json() as T;
  } finally {
    activeAdminRequests.delete(controller);
    init.signal?.removeEventListener("abort", forwardAbort);
  }
}

export function AdminQueryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [client] = useState(makeAdminQueryClient);

  const purge = useCallback(async () => {
    abortAdminRequests();
    await client.cancelQueries({ queryKey: ["admin"] });
    client.clear();
  }, [client]);

  useEffect(() => {
    const redirectToLogin = () => {
      void purge().finally(() => {
        router.replace("/admin/login");
        router.refresh();
      });
    };
    const handleExpired = () => {
      notifyAdminSessionEnded();
      redirectToLogin();
    };
    const channel = "BroadcastChannel" in window ? new BroadcastChannel(ADMIN_AUTH_CHANNEL) : null;
    const handleChannel = () => redirectToLogin();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ADMIN_AUTH_STORAGE_KEY) redirectToLogin();
    };
    channel?.addEventListener("message", handleChannel);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(ADMIN_AUTH_EXPIRED_EVENT, handleExpired);
    return () => {
      channel?.removeEventListener("message", handleChannel);
      channel?.close();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(ADMIN_AUTH_EXPIRED_EVENT, handleExpired);
    };
  }, [purge, router]);

  return (
    <AdminQueryContext.Provider value={{ purge }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </AdminQueryContext.Provider>
  );
}

export function useAdminQueryControl() {
  const value = useContext(AdminQueryContext);
  if (!value) throw new Error("useAdminQueryControl must be used inside AdminQueryProvider");
  return value;
}
