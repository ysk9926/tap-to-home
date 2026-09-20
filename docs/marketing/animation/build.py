"""Build self-contained HTML previews and deterministic HyperFrames compositions."""
from pathlib import Path
import re
import shutil

source = Path(__file__).resolve().parent
marketing = source.parent
root = source.parents[2]
font = (source / 'assets/gaegu.css').read_text()
gsap = '\n'.join(line.rstrip() for line in (source / 'assets/gsap.min.js').read_text().splitlines())
drawing = (source / 'drawing.js').read_text()
motion = (source / 'motion.js').read_text()
player = (source / 'player.js').read_text()
template = (source / 'preview-template.html').read_text()

for mode, duration in [('intro', 8), ('outro', 3)]:
    engine = f'''(()=>{{'use strict';
const MODE='{mode}',DURATION={duration},WIDTH=1080,HEIGHT=1920;
const canvas=document.getElementById('film'),ctx=canvas.getContext('2d');
{drawing}
{motion}
}})();'''
    scripts = f'<script>{gsap}</script>\n<script>{engine}</script>'
    preview = template.replace('__FONT_CSS__', font).replace('__DURATION__', str(duration))
    preview = preview.replace('<canvas id="film"', f'<canvas data-mode="{mode}" data-duration="{duration}" id="film"')
    preview = preview.replace('__SCRIPTS__', scripts + f'\n<script>{player}</script>')
    preview = preview.replace('몸에서 빠져나와 달리는 마음.', '책상 장면이 끝나고, 집으로 달리는 마음.')
    if mode == 'outro':
        preview = preview.replace('8초', '3초').replace('인트로', '엔딩')
        preview = preview.replace('노트 속에서<br><mark>먼저 퇴근.</mark>', '마음은 벌써<br><mark>집에 도착.</mark>')
        preview = re.sub(r'<p class="lead">.*?</p>', '<p class="lead">하루 끝, 집에서 쉬는 졸라맨.<br>머리·몸통·팔·다리가 자연스럽게 이어지는 엔딩.</p>', preview)
        preview = re.sub(r'<div class="beats">.*?</div></div>', '<div class="beats"><div class="beat"><b>0–0.7초</b><span>짧은 자막 등장과 형광펜 강조.</span></div><div class="beat"><b>0.7–3초</b><span>집에서 쉬는 졸라맨과 앱 이름.</span></div></div>', preview)
        preview = re.sub(r'<p class="hint">1080.*?</p>', '<p class="hint">1080 × 1920 · 30fps · 3초 엔딩. 30초 릴스의 마지막에 연결합니다.</p>', preview)
        preview = preview.replace('노트 위 책상에 앉은 졸라맨에서 마음이 뛰쳐나오고 퇴근 버튼으로 이어지는 3초 애니메이션', '노트 위 집에서 편안하게 쉬는 졸라맨과 앱 이름을 보여주는 3초 엔딩')
    (marketing / f'reel-{mode}-2026-09-20.html').write_text(preview)
    # Render-only documents deliberately exclude the interactive player's wall clock.
    composition = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=1080, height=1920"><title>Tap to Home — {mode}</title>
<link rel="stylesheet" href="assets/gaegu.css"><script src="assets/gsap.min.js"></script>
<style>
html,body{{margin:0;width:100%;height:100%;background:#fffdf5}}
#root{{position:relative;width:100%;height:100%;overflow:hidden}}
.clip{{position:absolute;inset:0}}canvas{{display:block;width:100%;height:100%}}
</style></head><body>
<div id="root" data-composition-id="{mode}" data-start="0" data-duration="{duration}" data-width="1080" data-height="1920" data-fps="30">
<canvas class="clip" data-start="0" data-duration="{duration}" id="film" width="1080" height="1920" aria-label="퇴근 레이스 {mode}"></canvas>
</div><script>{engine}</script></body></html>'''
    output = root / 'output/hyperframes' / mode
    output.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source / 'assets', output / 'assets', dirs_exist_ok=True)
    (output / 'index.html').write_text(composition)
    print(f'{mode}: preview + HyperFrames composition ({duration}s)')
