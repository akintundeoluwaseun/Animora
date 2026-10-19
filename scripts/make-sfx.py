"""Builds Animora's motion-graphics sound effects (assets/sfx/*.wav) from scratch: no downloads, no licences.
Run:  python3 scripts/make-sfx.py

Sound design v2 (after "the sound feels cheap"):
  - every effect is LAYERED like a film sound designer would: a body (tone / sub), texture (filtered air) and a
    short transient, glued with gentle saturation;
  - a small synthetic ROOM (convolution reverb) gives depth, so nothing sounds like a bare computer beep;
  - transients are rounded (no clicks), the top end is tamed (no hiss, no harsh highs), lows are tight;
  - every file is normalised to the same perceived loudness, so the mixer can balance them by role.
"""
import numpy as np, wave, os
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx')
rng = np.random.default_rng(11)


def t(d): return np.arange(int(SR * d)) / SR
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sosfilt(butter(order, min(f, SR / 2 - 200), 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)
def sat(x, drive=1.6): return np.tanh(x * drive) / np.tanh(drive)
def norm(x): return x / (np.max(np.abs(x)) + 1e-9)


def env_ar(n, attack_ms, decay_s, curve=1.0):
    """smooth attack, exponential decay"""
    a = max(2, int(SR * attack_ms / 1000)); e = np.exp(-np.arange(n) / SR / max(1e-4, decay_s) * curve)
    e[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    return e


def swell(n, peak_at=0.6, power=2.0):
    """slow rise to a peak, quick smooth fall (whooshes, risers)"""
    p = max(2, int(n * peak_at)); e = np.zeros(n)
    e[:p] = np.linspace(0, 1, p) ** power
    e[p:] = np.cos(np.linspace(0, np.pi / 2, n - p)) ** 2
    return e


def sweep_noise(d, f0, f1, q=0.5, blocks=64):
    """air whose band glides f0 -> f1 (overlap-add of short band-passed blocks)"""
    n = int(SR * d); x = rng.standard_normal(n + SR // 5); out = np.zeros(n)
    hop = max(64, n // blocks); win = np.hanning(hop * 2)
    for i in range(blocks):
        c = f0 * (f1 / f0) ** (i / max(1, blocks - 1))
        lo, hi = c * (1 - q / 2), min(SR / 2 - 300, c * (1 + q / 2))
        seg = bp(x[i * hop: i * hop + hop * 2 + 4000], lo, hi)[2000: 2000 + hop * 2]
        if len(seg) < hop * 2: break
        s = i * hop; e = min(n, s + hop * 2)
        out[s:e] += (seg * win)[: e - s]
    return out


def glide(f0, f1, d):
    tt = t(d); f = f0 * (f1 / f0) ** (tt / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def fm_bell(f, d, ratio=3.5, index=2.2, decay=3.0):
    """glassy FM bell (notification / chime body)"""
    tt = t(d); mod_env = np.exp(-tt * decay * 2.5)
    y = np.sin(2 * np.pi * f * tt + index * mod_env * np.sin(2 * np.pi * f * ratio * tt))
    return y * env_ar(len(tt), 3, 1 / decay)


def room(x, size=0.9, mix=0.22, tone=5000, predelay_ms=12):
    """small synthetic hall: decaying filtered noise impulse, convolved, blended in"""
    ln = int(SR * size); ir = rng.standard_normal(ln) * np.exp(-np.arange(ln) / SR * (6.5 / size))
    ir = lp(ir, tone, 2); ir[: int(SR * predelay_ms / 1000)] = 0; ir = ir / np.sqrt(np.sum(ir ** 2))
    wet = fftconvolve(x, ir)[: len(x) + ln]
    dry = np.concatenate([x, np.zeros(len(wet) - len(x))])
    return dry * (1 - mix) + wet * mix * 2.2


def fade_tail(x, ms=40):
    n = int(SR * ms / 1000); x = x.copy(); x[-n:] *= np.linspace(1, 0, n) ** 2; return x


def save(name, y, loud=-16.0):
    """normalise to an RMS loudness over the active part, peak-safe, short fade at the end"""
    y = fade_tail(hp(y, 28, 2))
    act = np.abs(y) > 0.02 * np.max(np.abs(y))
    rms = np.sqrt(np.mean(y[act] ** 2)) if act.any() else 1e-6
    y = y * (10 ** (loud / 20) / rms)
    pk = np.max(np.abs(y))
    if pk > 0.94: y = y * 0.94 / pk
    y = np.concatenate([y, np.zeros(int(SR * 0.02))])
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())


os.makedirs(OUT, exist_ok=True)

# ---- air ------------------------------------------------------------------------------------------
# whoosh: something passing the camera. Air that rises then falls in pitch (doppler) + a soft low body.
d = .62; n = int(SR * d)
air = sweep_noise(d, 300, 2200, .55) * swell(n, .62, 2.2)
air += .6 * sweep_noise(d, 2200, 700, .5) * np.concatenate([np.zeros(int(n * .55)), swell(n - int(n * .55), .15, 1)])
body = lp(sweep_noise(d, 90, 260, .9), 400) * swell(n, .6, 2) * .8
save('whoosh', room(lp(sat(norm(air + body), 1.3), 6500), .6, .16), -17)

# whoosh-low: a big slow pass (3D moves, tunnels)
d = .85; n = int(SR * d)
air = sweep_noise(d, 180, 900, .6) * swell(n, .58, 2)
sub = glide(70, 45, d) * swell(n, .55, 2) * .5
save('whoosh-low', room(lp(sat(norm(air + sub), 1.4), 3500), .9, .2), -17)

# swish: a light, quick brush (dissolves, small moves)
d = .38; n = int(SR * d)
save('swish', room(lp(sweep_noise(d, 900, 3200, .5) * swell(n, .5, 1.6), 7000), .5, .14), -20)

# zoom: air rushing forward with a rising tone under it (dives, zooms)
d = .7; n = int(SR * d)
air = sweep_noise(d, 250, 3000, .5) * swell(n, .82, 2.4)
tone = (glide(140, 420, d) + .35 * glide(280, 840, d)) * swell(n, .8, 2.5) * .35
save('zoom', room(lp(sat(norm(air + tone), 1.5), 6000), .7, .16), -17)

# riser: tension building into a reveal
d = 1.4; n = int(SR * d)
air = sweep_noise(d, 200, 2600, .45) * swell(n, .93, 2.6)
tone = sum(glide(f, f * 2, d) for f in (110, 165, 220)) / 3 * swell(n, .93, 2.8) * .5
save('riser', room(lp(sat(norm(air + tone), 1.3), 7000), 1.0, .2), -18)

# ---- hits -----------------------------------------------------------------------------------------
# impact: cinematic but soft hit. Sub drop + low thump + dark noise burst, long warm room tail.
d = 1.6; n = int(SR * d); tt = t(d)
sub = glide(78, 38, d) * env_ar(n, 4, .55)
thump = lp(rng.standard_normal(n), 220, 4) * env_ar(n, 2, .09) * 1.4
crack = lp(hp(rng.standard_normal(n), 900), 3500) * env_ar(n, 1.5, .03) * .35
save('impact', room(sat(norm(sub * 1.1 + thump + crack), 2.0), 1.4, .28, 3000), -15)

# thud: a small soft landing (cards, tiles, phones settling)
d = .35; n = int(SR * d)
y = glide(150, 70, d) * env_ar(n, 3, .08) + lp(rng.standard_normal(n), 400, 3) * env_ar(n, 2, .03) * .6
save('thud', room(sat(norm(y), 1.6), .5, .16, 2500), -18)

# ---- UI -------------------------------------------------------------------------------------------
# pop: a round glassy bubble (chips, bubbles, cards appearing)
d = .22; n = int(SR * d); tt = t(d)
y = glide(480, 980, d) * env_ar(n, 4, .05) + .3 * np.sin(2 * np.pi * 1960 * tt) * env_ar(n, 2, .025)
save('pop', room(lp(y, 5500), .45, .14), -19)

# click: crisp UI tap (cursor presses a button, a switch flips)
d = .09; n = int(SR * d); tt = t(d)
y = bp(rng.standard_normal(n), 1800, 6000) * env_ar(n, .6, .008) * .7 + np.sin(2 * np.pi * 900 * tt) * env_ar(n, 1, .02)
save('click', room(y, .3, .1, 7000), -19)

# tick: one soft key press (typing, counters) - a muted mechanical "thock"
d = .06; n = int(SR * d); tt = t(d)
y = bp(rng.standard_normal(n), 1500, 4500) * env_ar(n, .5, .006) * .6 + np.sin(2 * np.pi * 420 * tt) * env_ar(n, .8, .012) * .8
save('tick', room(y, .25, .08, 6000), -24)

# send: a quick upward swoosh with a tiny blip (message sent)
d = .28; n = int(SR * d)
y = sweep_noise(d, 800, 4000, .5) * swell(n, .5, 1.5) * .6 + glide(520, 1040, d) * env_ar(n, 6, .07) * .5
save('send', room(lp(y, 8000), .4, .14), -19)

# glitch, glitch-big, swipe, logo-glitch, jingle, intro: real recordings from the owner's sound library (Pixabay,
# Pixabay Content License), trimmed so their hit lands on the motion. They live in assets/sfx and are not generated here.

# ---- tones ----------------------------------------------------------------------------------------
# ding: a glassy notification bell
y = fm_bell(1318.5, 1.1, 3.5, 1.6, 3.4) + .5 * fm_bell(1975.5, 1.1, 3.5, 1.2, 4.2)
save('ding', room(lp(y, 9000), 1.0, .24), -20)

# chime: a warm three-note shimmer (brand / logo moments, end cards)
d = 1.7; out = np.zeros(int(SR * d))
for k, f in enumerate([659.3, 987.8, 1318.5]):
    b = fm_bell(f, 1.4, 2.0, 1.1, 2.6); o = int(SR * k * .085); out[o:o + len(b)] += b[: len(out) - o] * (1 - k * .15)
save('chime', room(lp(out, 8000), 1.5, .3), -20)

# shimmer: a bright soft sparkle swelling in (light flares, glowing reveals)
d = 1.3; n = int(SR * d); y = np.zeros(n)
scale = [1318.5, 1568.0, 1760.0, 1975.5, 2349.3, 2637.0, 3136.0]   # pentatonic sparkle grains, rising
for k in range(16):
    at = int(SR * (0.02 + 0.055 * k + rng.uniform(0, .02))); f = scale[min(len(scale) - 1, k // 2 + int(rng.integers(0, 2)))]
    g = fm_bell(f, .45, 2.0, .9, 9) * (0.55 + 0.45 * k / 15)
    y[at:at + len(g)] += g[: n - at]
y = y * swell(n, .6, 1.2) + .35 * sweep_noise(d, 2500, 8000, .4) * swell(n, .5, 1.5)
save('shimmer', room(lp(y, 9000), 1.3, .32), -22)

print('sounds written to', os.path.abspath(OUT))
