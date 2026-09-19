import { useId, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type TextFieldProps = ComponentPropsWithoutRef<"input"> & {
  label: string;
  /** 라벨 옆 연한 안내 */
  hint?: string;
  /** 있으면 밑줄 아래 펜 글씨로 표시 */
  error?: string;
};

/** 줄노트 위에 쓰는 밑줄 입력칸. 높이 32px = 줄 한 칸 */
export function TextField({ label, hint, error, className, id, ...props }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cn("block", className)}>
      <span className="flex items-baseline gap-2 font-ui text-lg font-bold">
        {label}
        {hint && <span className="font-note text-base font-normal text-pencil-soft">{hint}</span>}
      </span>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "block h-8 w-full bg-transparent font-ui text-xl text-ink outline-none",
          "border-0 border-b-[1.5px] border-pencil rounded-none",
          "placeholder:text-pencil-soft focus-visible:border-marker focus-visible:border-b-[3px]",
          error && "border-margin",
        )}
        {...props}
      />
      {error && <span className="mt-1 block font-note text-base text-pencil">{error}</span>}
    </label>
  );
}
