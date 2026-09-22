import { Paper } from "@/components/paper";

export default function Loading() {
  return (
    <Paper className="flex min-h-dvh flex-col bg-paper" aria-live="polite" aria-busy="true">
      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-5 py-12">
        <div aria-hidden="true" className="mb-5 flex items-end gap-2">
          {[0, 1, 2].map((step) => (
            <span
              key={step}
              className="h-3 w-3 animate-bounce rounded-full border-[1.5px] border-pencil bg-hilite"
              style={{ animationDelay: `${step * 120}ms` }}
            />
          ))}
        </div>
        <p className="font-ui text-2xl font-bold text-ink">퇴근길을 다시 그리고 있어요</p>
        <p className="mt-1 font-note text-xl text-pencil-soft">조금만 기다려 주세요.</p>
      </main>
    </Paper>
  );
}
