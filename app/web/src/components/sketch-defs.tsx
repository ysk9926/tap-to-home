/**
 * 문서 전체가 공유하는 SVG 필터. 루트 레이아웃에 한 번만 둔다.
 * `mk` / `wobble` 유틸리티가 `url(#wobble)` 로 참조해 매직 선을 살짝 흔든다.
 */
export function SketchDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <filter id="wobble" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.018"
          numOctaves="2"
          seed="7"
          result="n"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="n"
          scale="2.4"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
