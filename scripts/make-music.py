"""Builds AdFlash's original background music beds (assets/music/*.wav): soft, warm, royalty-free by construction.
Each bed is 32 bars at a fixed tempo, designed to loop. Run:  python3 scripts/make-music.py
"""
import numpy as np, wave, os, json
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'music')
rng = np.random.default_rng(11)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'highpass', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'bandpass', fs=SR, output='sos'), x)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def adsr(n, a, d, s, r):
    e = np.full(n, s, float); A = int(a * SR); D = int(d * SR); R = int(r * SR)
    A = min(A, n); e[:A] = np.linspace(0, 1, A)
    D = min(D, n - A); e[A:A + D] = np.linspace(1, s, D)
    R = min(R, n); e[n - R:] *= np.linspace(1, 0, R)
    return e
def reverb(x, secs=2.2, mix=0.3):
    n = int(SR * secs); ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n)); ir = lp(ir, 5000); ir /= np.abs(ir).sum() ** .5 * 3
    wet = fftconvolve(x, ir)[: len(x)]
    return x * (1 - mix) + wet * mix / (np.abs(wet).max() + 1e-9) * (np.abs(x).max() + 1e-9)

def pad(freqs, dur, bright=1200):
    t = np.arange(int(SR * dur)) / SR; y = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            for h, a in ((1, 1), (2, .35), (3, .15), (4, .07)): y += a * np.sin(2 * np.pi * ff * h * t + rng.uniform(0, 6.28))
    return hp(lp(y, bright * 2.2, 2), 220, 2) * adsr(len(t), .6, .5, .85, .8)
def keys(f, dur, decay=3.5):  # soft kalimba / electric-piano-ish pluck
    t = np.arange(int(SR * dur)) / SR
    y = (np.sin(2 * np.pi * f * t) + .25 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t * 6) + .08 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t * 10)) * np.exp(-t * decay)
    a = int(SR * .004); y[:a] *= np.linspace(0, 1, a)
    r = int(SR * .06); y[-r:] *= np.linspace(1, 0, r) ** 2   # no clicks when a note ends
    return lp(y, 6500)
def bass(f, dur):
    t = np.arange(int(SR * dur)) / SR
    return lp(np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * 2 * f * t), 400) * adsr(len(t), .01, .2, .7, .08)
def kick(v=1):
    t = np.arange(int(SR * .32)) / SR
    y = np.sin(2 * np.pi * np.cumsum(48 + 70 * np.exp(-t * 30)) / SR) * np.exp(-t * 11)
    a = int(SR * .003); y[:a] *= np.linspace(0, 1, a); return lp(y, 180) * v
def hat(v=1):
    t = np.arange(int(SR * .06)) / SR; y = hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 90); y[:int(SR*.001)] *= np.linspace(0, 1, int(SR*.001)); return y * v
def shaker(v=1):
    t = np.arange(int(SR * .07)) / SR; e = np.sin(np.linspace(0, np.pi, len(t))) ** 2
    return bp(rng.standard_normal(len(t)), 5000, 9000) * e * v
def snap(v=1):
    t = np.arange(int(SR * .2)) / SR; y = bp(rng.standard_normal(len(t)), 1200, 3500) * np.exp(-t * 32)
    a = int(SR * .002); y[:a] *= np.linspace(0, 1, a); return y * v

def place(buf, x, at):
    s = int(at * SR); e = min(len(buf), s + len(x))
    if s < len(buf): buf[s:e] += x[: e - s]

def build(name, bpm, prog, scale_root, drums, arp='up', bright=1200, pad_lvl=.22, key_lvl=.18, bass_lvl=.3, bars=32):
    beat = 60 / bpm; bar = beat * 4; L = bars * bar + 2.5
    P, K, B, D = (np.zeros(int(SR * L)) for _ in range(4))
    for b in range(bars):
        chord = prog[b % len(prog)]
        t0 = b * bar
        place(P, pad([mtof(m + 12) for m in chord], bar + .8, bright), t0)
        place(B, bass(mtof(chord[0] - 12 if chord[0] >= 52 else chord[0]), bar * .95), t0)
        if b % 2 == 1: place(K, keys(mtof(chord[-1] + 24), beat * 3, 2.5) * .35, t0 + beat * 3.5)   # a high answering note
        if b >= 2:  # keys come in after two bars
            notes = sorted(chord + [chord[0] + 12])
            pat = notes if arp == 'up' else notes[::-1] if arp == 'down' else [notes[0], notes[2], notes[1], notes[3]]
            for k in range(8):
                if arp == 'sparse' and k % 2: continue
                place(K, keys(mtof(pat[k % len(pat)] + 12), beat * 2.5) * (0.9 if k % 2 == 0 else .65), t0 + k * beat / 2)
        if b >= 4 and b < bars - 1:
            for k in range(16):
                at = t0 + k * beat / 4
                if 'kick4' in drums and k % 4 == 0: place(D, kick(.9), at)
                if 'kick2' in drums and k in (0, 8): place(D, kick(.8), at)
                if 'kickafro' in drums and k in (0, 6, 8, 11): place(D, kick(.75), at)
                if 'hat' in drums and k % 4 == 2: place(D, hat(.22), at)
                if 'shaker' in drums: place(D, shaker(.05 if k % 2 else .09), at)
                if 'snap' in drums and k in (4, 12): place(D, snap(.22), at)
    # gentle sidechain: the pad breathes with the kick
    env = np.ones(len(P))
    if drums:
        for b in range(4, bars - 1):
            for k in range(4):
                s = int((b * bar + k * beat) * SR); n = int(SR * beat * .6)
                if s + n < len(env):
                    duck = 1 - .3 * np.exp(-np.linspace(0, 5, n)); ramp = int(SR * .012)
                    duck[:ramp] = np.linspace(1, duck[ramp], ramp)   # ease into the dip (no click)
                    env[s:s + n] = np.minimum(env[s:s + n], duck)
    mix = reverb(P * env, 2.5, .35) * pad_lvl + reverb(K, 1.8, .3) * key_lvl * 1.7 + B * bass_lvl * .55 + D * .55
    mix = mix + .6 * hp(mix, 2500, 2)   # air on top
    # master: soft limiter, fade in, tail
    mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.4) * .7
    f = int(SR * .5); mix[:f] *= np.linspace(0, 1, f)
    mix = mix[: int(SR * bars * bar)]
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
    return {'bpm': bpm, 'seconds': round(bars * bar, 3)}

os.makedirs(OUT, exist_ok=True)
# chords as MIDI note lists (root position voicings around middle C)
meta = {
  'calm': build('calm', 84, [[53, 57, 60, 64], [57, 60, 64, 67], [50, 53, 57, 60], [58, 62, 65, 69]], 53, ['kick2'], 'sparse', 1000, .26, .16, .22),
  'pulse': build('pulse', 110, [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]], 57, ['kick4', 'hat'], 'up', 1500, .2, .17, .32),
  'warm': build('warm', 100, [[48, 52, 55, 59], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], 48, ['kickafro', 'shaker', 'snap'], 'alt', 1300, .2, .2, .3),
  'cinematic': build('cinematic', 72, [[50, 53, 57, 60], [46, 50, 53, 57], [53, 57, 60, 64], [48, 52, 55, 60]], 50, [], 'sparse', 900, .3, .14, .2),
  'bright': build('bright', 120, [[55, 59, 62, 66], [52, 55, 59, 62], [48, 52, 55, 59], [50, 54, 57, 60]], 55, ['kick4', 'shaker', 'snap'], 'up', 1700, .18, .2, .28),
}
with open(os.path.join(OUT, 'tracks.json'), 'w') as f: json.dump(meta, f, indent=1)
# small MP3s for the app (the preview streams them; the renderer decodes them)
import subprocess
for k in meta:
    w = os.path.join(OUT, k + '.wav'); subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', w, '-c:a', 'libmp3lame', '-b:a', '160k', w[:-4] + '.mp3'], check=True); os.remove(w)
print(json.dumps(meta))
