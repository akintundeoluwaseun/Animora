"""Animora natural voice-over (runs on the GitHub Actions render server, free, no API key).
Kokoro-82M (Apache-2.0) via kokoro-onnx. Each sentence is read on its own with a short breath between, so it
pauses like a person instead of reading a block of text. Lines start at the times given (the film's key moments);
if they don't fit, it reads a little faster, then drops middle lines, never the first or the last.
usage: python3 scripts/voice.py spec.json out.wav
spec: { "voice": "af_heart", "duration": 14.5, "lines": ["...", ...], "times": [0.4, 4.2, ...] }
"""
import json, os, re, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

spec = json.load(open(sys.argv[1])); out = sys.argv[2]
models = os.environ.get('KOKORO_DIR', os.path.expanduser('~/kokoro'))
k = Kokoro(os.path.join(models, 'kokoro-v1.0.int8.onnx'), os.path.join(models, 'voices-v1.0.bin'))
SR = 24000
voice = spec.get('voice', 'af_heart'); total = float(spec['duration'])
lines = [l for l in spec['lines'] if l.strip()]; times = list(spec.get('times') or [])

def say(text, speed):
    parts = [p.strip() for p in re.split(r'(?<=[.!?])\s+', text) if p.strip()]
    chunks = []
    for i, p in enumerate(parts):
        a, _ = k.create(p, voice=voice, speed=speed, lang='en-us')
        a = np.asarray(a, dtype=np.float32)
        idx = np.where(np.abs(a) > 0.01)[0]
        if len(idx): a = a[max(0, idx[0] - 600): idx[-1] + 1800]
        chunks.append(a)
        if i < len(parts) - 1: chunks.append(np.zeros(int(SR * 0.34), np.float32))
    return np.concatenate(chunks) if chunks else np.zeros(1, np.float32)

def place(clips, ts):
    pos, end = [], 0
    for i, (a, t) in enumerate(zip(clips, ts)):
        want = int(SR * t)
        # the closing line may start earlier so it finishes before the film ends
        if i == len(clips) - 1: want = min(want, int(SR * (total - 0.35)) - len(a))
        s = max(want, end + int(SR * 0.3)); pos.append(s); end = s + len(a)
    return pos, end

speed = 1.0
while True:
    clips = [say(l, speed) for l in lines]
    ts = times[:len(lines)] if len(times) >= len(lines) else [0.4 + i * max(0.5, (total - 3) / max(1, len(lines) - 1)) for i in range(len(lines))]
    pos, end = place(clips, ts)
    if end <= SR * (total - 0.15) or (speed >= 1.2 and len(lines) <= 2): break
    if speed < 1.2: speed = round(speed + 0.1, 2); continue
    # still too long: drop a middle line (keep the opening and the closing line) and its time
    mid = len(lines) // 2; lines.pop(mid); times = times[:mid] + times[mid + 1:] if len(times) > mid else times

track = np.zeros(int(SR * total), np.float32)
for a, s in zip(clips, pos):
    if s >= len(track): continue
    seg = a[: len(track) - s]
    if len(seg) < len(a): seg = seg * np.linspace(1, 0, len(seg)) ** 0.2   # never cut a word hard at the very end
    track[s: s + len(seg)] += seg
peak = float(np.max(np.abs(track))) or 1.0
sf.write(out, track / peak * 0.9, SR)
print(json.dumps({'speed': speed, 'lines': len(lines), 'starts': [round(s / SR, 2) for s in pos]}))
