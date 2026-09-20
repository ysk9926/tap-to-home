"""Replace a 30s reel's intro/outro and optional audio, then rebuild its HTML player."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--intro', type=Path, required=True)
parser.add_argument('--outro', type=Path, required=True)
parser.add_argument('--audio', type=Path, help='Optional frame-aligned replacement WAV.')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
if args.source.resolve() == args.output.resolve():
    parser.error('Source and output must be different files.')
root = Path(__file__).resolve().parents[3]
args.output.parent.mkdir(parents=True, exist_ok=True)
command = [
    'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
    '-i', str(args.intro), '-i', str(args.source), '-i', str(args.outro),
]
if args.audio:
    command += ['-i', str(args.audio)]
command += [
    '-filter_complex',
    '[0:v]fps=30,trim=duration=8,setpts=PTS-STARTPTS,setsar=1[a];'
    '[1:v]fps=30,trim=start=8:end=27,setpts=PTS-STARTPTS,setsar=1[b];'
    '[2:v]fps=30,trim=duration=3,setpts=PTS-STARTPTS,setsar=1[c];'
    '[a][b][c]concat=n=3:v=1:a=0,format=yuv420p[v]',
    '-map', '[v]', '-map', '3:a:0' if args.audio else '1:a:0',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-threads', '3', '-r', '30',
]
command += ['-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2'] if args.audio else ['-c:a', 'copy']
command += [
    '-t', '30',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-movflags', '+faststart', str(args.output),
]
subprocess.run(command, check=True)
poster = args.output.parent / 'cover.jpg'
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', '1',
                '-i', str(args.output), '-frames:v', '1', '-q:v', '3', str(poster)], check=True)
player = root / 'docs/marketing/reel-video-2026-09-20.html'
html = player.read_text()
video_bytes = args.output.read_bytes()
html, video_count = re.subn(r'src="data:video/mp4;base64,[^"]+"',
    'src="data:video/mp4;base64,' + base64.b64encode(video_bytes).decode() + '"', html)
html, poster_count = re.subn(r'poster="data:image/jpeg;base64,[^"]+"',
    'poster="data:image/jpeg;base64,' + base64.b64encode(poster.read_bytes()).decode() + '"', html)
assert video_count == 1 and poster_count == 1, 'Expected exactly one embedded video and poster.'
html = html.replace('줄노트 인트로와 엔딩은 HTML Canvas로 제작했습니다.',
                    '줄노트 인트로와 엔딩은 HTML Canvas·GSAP 타임라인으로 제작하고 HyperFrames로 렌더링했습니다.')
player.write_text(html)
manifest = {
    'source': str(args.source), 'intro': str(args.intro), 'outro': str(args.outro),
    'output': str(args.output), 'duration': 30, 'fps': 30, 'resolution': '1080x1920',
    'preserved': 'Original app footage at 8–27s.',
    'audio': str(args.audio) if args.audio else 'Original AAC audio copied without re-encoding.',
    'sha256': hashlib.sha256(video_bytes).hexdigest(),
}
(args.output.parent / 'animation-revision.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print(json.dumps(manifest, ensure_ascii=False, indent=2))
