"""Builds AdFlash's motion-graphics sound effects (assets/sfx/*.wav) from scratch: no downloads, no licences.
Run:  python3 scripts/make-sfx.py
"""
import numpy as np, wave, os
from scipy.signal import butter, sosfilt

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx')
rng = np.random.default_rng(7)

def t(d): return np.arange(int(SR * d)) / SR
def env(n, a, r, curve=3.0):
    """attack fraction a, release fraction r (of n samples)"""
    e = np.ones(n); A = max(1, int(n * a)); R = max(1, int(n * r))
    e[:A] = np.linspace(0, 1, A) ** 2
    e[-R:] *= np.linspace(1, 0, R) ** curve
    return e
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)
def sweep_noise(d, f0, f1, width=0.6, blocks=48):
    """noise whose band centre glides f0 -> f1 (processed in short overlapping blocks)"""
    n = int(SR * d); x = rng.standard_normal(n + SR // 10); out = np.zeros(n)
    hop = n // blocks; win = np.hanning(hop * 2)
    for i in range(blocks):
        c = f0 * (f1 / f0) ** (i / (blocks - 1))
        seg = bp(x[i * hop: i * hop + hop * 2 + 2000], c * (1 - width / 2), min(SR / 2 - 100, c * (1 + width / 2)))[2000 // 2: 2000 // 2 + hop * 2]
        if len(seg) < hop * 2: break
        s = i * hop; e = min(n, s + hop * 2)
        out[s:e] += (seg * win)[: e - s]
    return out
def tone(freqs, d, decay=6.0, partials=((1, 1.0),)):
    tt = t(d); y = np.zeros_like(tt)
    for f in np.atleast_1d(freqs):
        for mult, amp in partials: y += amp * np.sin(2 * np.pi * f * mult * tt) * np.exp(-tt * decay * mult ** 0.5)
    return y
def glide(f0, f1, d, curve='exp'):
    tt = t(d); f = f0 * (f1 / f0) ** (tt / d) if curve == 'exp' else np.linspace(f0, f1, len(tt))
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def save(name, y, peak=0.9):
    y = y / (np.max(np.abs(y)) + 1e-9) * peak
    y = np.concatenate([y, np.zeros(int(SR * 0.02))])
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((y * 32767).astype(np.int16).tobytes())

os.makedirs(OUT, exist_ok=True)
# Every sound is SOFT: smooth (never instant) attacks, no bright noise, warm low-passed air, gentle bells.
def hann_env(n, peak_at=0.5):
    """smooth rise then fall, peak at a fraction of the length"""
    p = max(2, int(n * peak_at)); e = np.zeros(n)
    e[:p] = np.sin(np.linspace(0, np.pi / 2, p)) ** 2
    e[p:] = np.cos(np.linspace(0, np.pi / 2, n - p)) ** 2
    return e
def soft_attack(n, ms=6):
    a = min(n, int(SR * ms / 1000)); e = np.ones(n); e[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2; return e
def bell(f, d, decay=4.0, bright=0.25):
    tt = t(d)
    y = np.sin(2 * np.pi * f * tt) * np.exp(-tt * decay) + bright * np.sin(2 * np.pi * f * 2.0 * tt) * np.exp(-tt * decay * 2.2)
    return y * soft_attack(len(tt), 4)

# whoosh: a soft breath of air past the camera
d = .55; n = int(SR * d); save('whoosh', lp(sweep_noise(d, 220, 900, .7), 1400, 4) * hann_env(n, .55), .5)
# whoosh-low: deeper, slower air
d = .6; n = int(SR * d); save('whoosh-low', lp(sweep_noise(d, 500, 160, .7), 900, 4) * hann_env(n, .45), .45)
# swish: the lightest airy brush (premium dissolves)
d = .45; n = int(SR * d); save('swish', lp(sweep_noise(d, 400, 1000, .8), 1600, 4) * hann_env(n, .5), .32)
# zoom: a gentle rising breath with a soft tone underneath (dives into a word or the logo)
d = .6; n = int(SR * d); y = lp(sweep_noise(d, 250, 1300, .6), 1800, 4) * hann_env(n, .75) + .35 * glide(220, 440, d) * hann_env(n, .7)
save('zoom', y, .45)
# pop: a soft round bubble (cards and chips appearing)
d = .14; n = int(SR * d); tt = t(d)
save('pop', lp(glide(520, 880, d) * soft_attack(n, 5) * np.exp(-tt * 28), 2500, 2), .45)
# click: a gentle tap (the cursor presses the button)
d = .07; n = int(SR * d); tt = t(d)
save('click', (np.sin(2 * np.pi * 1050 * tt) + .3 * np.sin(2 * np.pi * 2100 * tt)) * soft_attack(n, 2) * np.exp(-tt * 70), .42)
# tick: a very quiet tap (typing, counters)
d = .04; n = int(SR * d); tt = t(d)
save('tick', np.sin(2 * np.pi * 1400 * tt) * soft_attack(n, 2) * np.exp(-tt * 120), .22)
# send: a soft upward blip (chat message sent)
d = .16; n = int(SR * d); tt = t(d); save('send', glide(480, 820, d) * soft_attack(n, 8) * np.exp(-tt * 14), .38)
# ding: a warm marimba-like note (notification, reply)
save('ding', bell(1046.5, .9, 4.5, .2) + .5 * bell(1568, .9, 5, .15), .4)
# chime: three soft harp notes (brand and logo moments)
parts = np.zeros(int(SR * 1.2))
for k, f in enumerate([659.3, 830.6, 987.8]):
    b = bell(f, 1.0, 3.2, .18); o = int(SR * k * .11); parts[o:o + len(b)] += b[: len(parts) - o]
save('chime', parts, .42)
# impact (now "bloom"): a warm, soft swell, never a hit (logo reveal)
d = 1.2; n = int(SR * d); tt = t(d)
pad = (np.sin(2 * np.pi * 220 * tt) + .6 * np.sin(2 * np.pi * 329.6 * tt) + .4 * np.sin(2 * np.pi * 440 * tt)) * hann_env(n, .22)
save('impact', lp(pad, 1500, 2) + .5 * bell(880, d, 3, .1), .42)
# riser: a slow gentle swell
d = 1.0; n = int(SR * d); save('riser', lp(sweep_noise(d, 200, 900, .6), 1200, 4) * hann_env(n, .9) + .3 * glide(196, 392, d) * hann_env(n, .9), .35)
print('sounds written to', os.path.abspath(OUT))
