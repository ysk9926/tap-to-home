export const NATIVE_RESUME_EVENT = "tap-to-home:resume";

export type NativeResumeDetail = {
  source: "native";
  backgroundedForMs: number;
};

export function subscribeNativeResume(listener: (detail: NativeResumeDetail) => void): () => void {
  const handle = (event: Event) => {
    const detail = (event as CustomEvent<Partial<NativeResumeDetail>>).detail;
    listener({
      source: "native",
      backgroundedForMs: Number.isFinite(detail?.backgroundedForMs)
        ? Math.max(0, Number(detail.backgroundedForMs))
        : 0,
    });
  };
  window.addEventListener(NATIVE_RESUME_EVENT, handle);
  return () => window.removeEventListener(NATIVE_RESUME_EVENT, handle);
}
