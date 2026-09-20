"""Synthesize deterministic sound effects at verified video-frame boundaries."""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import random
import wave

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
sheet = json.loads(Path(__file__).with_name('sound-cues.json').read_text())
sample_rate = 48000
fps = sheet['fps']
assert sample_rate % fps == 0
samples_per_frame = sample_rate // fps
audio = array.array('d', [0.0]) * (sheet['duration'] * sample_rate)


def percussion(kind, seed):
    rng = random.Random(seed)
    duration, frequency, decay = {
        'keyboard': (.035, 1150, 150),
        'footstep': (.095, 155, 48),
        'tap': (.055, 720, 95),
        'paper': (.14, 0, 35),
    }[kind]
    out = []
    low_pass = 0.0
    for j in range(round(duration * sample_rate)):
        t = j / sample_rate
        noise = rng.uniform(-1, 1)
        low_pass += .22 * (noise - low_pass)
        attack = min(1, t / (.004 if kind == 'paper' else .0008))
        envelope = attack * math.exp(-t * decay)
        tail = min(1, (duration - t) / .007)
        if kind == 'paper':
            value = low_pass * 1.5
        elif kind == 'footstep':
            value = .75 * math.sin(2 * math.pi * frequency * t) + .25 * low_pass
        else:
            value = .62 * noise + .38 * math.sin(2 * math.pi * frequency * t)
        out.append(value * envelope * tail)
    return out


def chime(kind):
    notes = {
        'rank': [(1046.5, 0)],
        'notification': [(880, 0), (1318.51, .11), (1760, .23)],
        'success': [(523.25, 0), (659.25, .09), (783.99, .18)],
    }[kind]
    duration = .18 if kind == 'rank' else .4
    out = [0.0] * round((notes[-1][1] + duration) * sample_rate)
    for frequency, delay in notes:
        start = round(delay * sample_rate)
        for j in range(round(duration * sample_rate)):
            t = j / sample_rate
            envelope = min(1, t / .004) * math.exp(-6 * t / duration)
            envelope *= min(1, (duration - t) / .01)
            out[start + j] += .55 * envelope * (math.sin(2 * math.pi * frequency * t)
                                               + .18 * math.sin(4 * math.pi * frequency * t))
    return out


events = []
for group in sheet['groups']:
    for frame in group['frames']:
        assert 0 <= frame < sheet['duration'] * fps
        kind = group['kind']
        clip = (chime(kind) if kind in ('rank', 'notification', 'success')
                else percussion(kind, 20260920 + frame))
        start = frame * samples_per_frame
        assert start + len(clip) <= len(audio)
        for offset, value in enumerate(clip):
            audio[start + offset] += value * group['gain']
        events.append({'kind': kind, 'frame': frame, 'time': frame / fps,
                       'sample': start, 'evidence': group['evidence']})

# Fixed gain preserves quiet footsteps/keys. Dynamic loudness normalization used
# on the previous sparse track boosted them almost as much as foreground taps.
peak = max(abs(value) for value in audio)
gain = min(1.0, 10 ** (-3 / 20) / peak)
pcm = array.array('h', (round(value * gain * 32767) for value in audio))
args.output.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(args.output), 'wb') as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(sample_rate)
    output.writeframes(pcm.tobytes())
report = {
    'sampleRate': sample_rate, 'fps': fps, 'samplesPerFrame': samples_per_frame,
    'duration': sheet['duration'], 'peakDbfs': 20 * math.log10(peak * gain),
    'gain': gain, 'events': sorted(events, key=lambda event: event['frame']),
    'sha256': hashlib.sha256(args.output.read_bytes()).hexdigest(),
}
args.output.with_suffix('.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({'file': str(args.output), 'events': len(events),
                  'duration': report['duration'], 'peakDbfs': report['peakDbfs']}, indent=2))
