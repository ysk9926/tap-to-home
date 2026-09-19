import type { SignalLevel } from "@/components/signal-toast";

/** 마지막 글자가 한글이고 받침이 있으면 withBatchim, 아니면 withoutBatchim 을 붙인다 */
export function withJosa(word: string, withBatchim: string, withoutBatchim: string): string {
  const code = word.charCodeAt(word.length - 1);
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  const hasBatchim = isHangul && (code - 0xac00) % 28 !== 0;
  return `${word}${hasBatchim ? withBatchim : withoutBatchim}`;
}

/** 이름 뒤에 붙는 주격 조사만 */
function subjectJosa(name: string): string {
  return withJosa(name, "이", "가").slice(name.length);
}

const COPY: Record<SignalLevel, { suffix: (name: string) => string; meta: string }> = {
  normal: { suffix: (n) => `${withJosa(n, "이", "").slice(n.length)}도 퇴근하고 싶어 해요`, meta: "일반 신호" },
  strong: { suffix: (n) => `${subjectJosa(n)} 강하게 퇴근하고 싶어 해요`, meta: "5연타" },
  urgent: { suffix: (n) => `${subjectJosa(n)} 긴급 퇴근 신호를 보냈어요!`, meta: "10연타" },
  rescue: { suffix: (n) => `${subjectJosa(n)} 구조 요청을 보냈어요!`, meta: "30연타" },
};

/** 토스트 문구. name 은 <b> 로 감싸 강조하고 suffix 를 뒤에 붙인다 */
export function signalMessage(senderName: string, level: SignalLevel): { name: string; suffix: string; meta: string } {
  const c = COPY[level];
  return { name: senderName, suffix: c.suffix(senderName), meta: c.meta };
}
