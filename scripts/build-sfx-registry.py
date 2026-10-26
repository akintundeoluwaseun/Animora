"""Builds assets/sfx/registry.json: every sound effect Animora can place, verified and measured.

For each WAV in assets/sfx it checks the file decodes (16-bit mono 44.1 kHz, what the mixer reads), then measures:
  duration, peak dBFS, loudness (RMS dBFS), attack (time to peak), transient (crest factor), brightness (spectral centroid),
  and derives intensity (0-1), length class and a role + semantic tags from its family and measurements.
Licence and source come from assets/CREDITS-SOUND.md and assets/sfx/CREDITS-motion-kit.md; a sound with no
recorded licence is marked unusable (never selected).
Run: python3 scripts/build-sfx-registry.py
"""
import json, os, re, sys, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX = os.path.join(ROOT, 'assets', 'sfx')

# family -> (role, tags). Roles are what the selection engine asks for.
FAMILY = [
    (r'^mg-whoosh|^whoosh|^swish|^swipe', 'whoosh', ['movement', 'air', 'directional']),
    (r'^mg-transition|^trans-', 'transition', ['scene', 'movement', 'air']),
    (r'^mg-pop|^pop|^plop', 'pop', ['appear', 'spring', 'ui', 'soft']),
    (r'^mg-click|^click|^select|^tap', 'click', ['ui', 'button', 'tap']),
    (r'^mg-tick|^tick', 'tick', ['ui', 'subtle', 'word']),
    (r'^mg-ui-blip', 'blip', ['ui', 'digital', 'subtle']),
    (r'^mg-ding|^ding|^ping|^chime|^confirm|^success|^send', 'ding', ['notification', 'success', 'bright']),
    (r'^mg-impact|^impact|^thud', 'impact', ['hit', 'landing', 'bass', 'emphasis']),
    (r'^mg-riser|^riser|^swell|^sparkle-rise', 'riser', ['build-up', 'rising', 'anticipation']),
    (r'^downlifter', 'downlifter', ['falling', 'exit']),
    (r'^mg-typing|^typing', 'typing', ['text', 'keyboard', 'mechanical']),
    (r'^mg-glitch|^glitch|^logo-glitch', 'glitch', ['digital', 'tech', 'distortion']),
    (r'^shimmer|^sparkle', 'shimmer', ['magic', 'reveal', 'bright', 'airy']),
    (r'^zoom', 'zoom', ['zoom', 'rising', 'movement']),
    (r'^shutter', 'shutter', ['camera', 'photo']),
    (r'^cash|^coins', 'cash', ['money', 'price']),
    (r'^jingle|^intro', 'sting', ['branding', 'logo', 'music']),
]

def licence_table():
    lic = {}
    for f in ('assets/CREDITS-SOUND.md',):
        p = os.path.join(ROOT, f)
        if not os.path.exists(p): continue
        for line in open(p, encoding='utf8'):
            m = re.match(r'\|\s*([\w.-]+\.wav)\s*\|\s*(.*?)\s*\|\s*(CC0[^|]*)\|', line)
            if m: lic[m.group(1)] = {'licence': m.group(3).strip(), 'source': re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1 \2', m.group(2)).strip()}
            # Animora's own sounds, synthesised by scripts/make-sfx.py (no third-party rights)
            m2 = re.search(r'The other effects \(([^)]+)\) were made from scratch by `scripts/make-sfx.py`', line)
            if m2:
                for k in [x.strip() for x in m2.group(1).split(',')]: lic[k + '.wav'] = {'licence': 'Animora original (synthesised)', 'source': 'scripts/make-sfx.py'}
    p = os.path.join(SFX, 'CREDITS-motion-kit.md')
    if os.path.exists(p):
        for line in open(p, encoding='utf8'):
            m = re.match(r'(mg-[\w-]+\.wav)\s+<-\s+(\S+)\s+(.*)$', line.strip())
            if m: lic[m.group(1)] = {'licence': 'CC0 1.0', 'source': ('github.com/Barty-Bart/motion-graphics ' + m.group(3)).strip()}
    return lic

def read(path):
    with wave.open(path, 'rb') as w:
        if w.getsampwidth() != 2 or w.getnchannels() != 1 or w.getframerate() != 44100: return None, 'needs 16-bit mono 44.1 kHz'
        x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768
    if not len(x): return None, 'empty'
    return x, None

def measure(x, sr=44100):
    a = np.abs(x); peak = float(a.max()) or 1e-9
    rms = float(np.sqrt(np.mean(x ** 2))) or 1e-9
    # short-time loudness of the loudest 50 ms (how loud it feels, not averaged over its tail)
    win = int(0.05 * sr); env = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode='same')); loud = float(env.max()) or 1e-9
    attack = float(np.argmax(env) / sr)
    spec = np.abs(np.fft.rfft(x[: sr * 2] * np.hanning(min(len(x), sr * 2))))
    freqs = np.fft.rfftfreq(min(len(x), sr * 2), 1 / sr)
    centroid = float((spec * freqs).sum() / (spec.sum() or 1))
    # where the sound is still audible (-40 dB under its peak): its useful length
    above = np.where(env > loud * 0.01)[0]; useful = float((above[-1] - above[0]) / sr) if len(above) else 0.0
    return {
        'duration': round(len(x) / sr, 3), 'useful': round(useful, 3), 'peakDb': round(20 * np.log10(peak), 1),
        'loudDb': round(20 * np.log10(loud), 1), 'rmsDb': round(20 * np.log10(rms), 1), 'attack': round(attack, 3),
        'crest': round(20 * np.log10(peak / rms), 1), 'brightness': int(centroid),
    }

def main():
    lic = licence_table(); out = []
    for f in sorted(os.listdir(SFX)):
        if not f.endswith('.wav'): continue
        key = f[:-4]; x, err = read(os.path.join(SFX, f))
        role, tags = 'other', []
        for pat, r, t in FAMILY:
            if re.search(pat, key): role, tags = r, list(t); break
        e = {'key': key, 'file': f'assets/sfx/{f}', 'role': role, 'tags': tags}
        if err: e.update({'ok': False, 'error': err}); out.append(e); continue
        m = measure(x); e.update(m)
        e['length'] = 'short' if m['useful'] < 0.3 else 'medium' if m['useful'] < 1.2 else 'long'
        e['transient'] = 'sharp' if m['attack'] < 0.03 and m['crest'] > 12 else 'soft' if m['attack'] > 0.12 else 'medium'
        e['intensity'] = round(float(np.clip((m['loudDb'] + 30) / 27, 0, 1)), 2)   # -30 dB quiet .. -3 dB loud
        e['tone'] = 'bright' if m['brightness'] > 4000 else 'dark' if m['brightness'] < 1200 else 'mid'
        if e['tone'] == 'dark' and role == 'impact': e['tags'].append('low')
        if e['transient'] == 'soft': e['tags'].append('gentle')
        info = lic.get(f)
        e['licence'] = info['licence'] if info else None; e['source'] = info['source'] if info else None
        e['ok'] = bool(info) and m['useful'] > 0.005
        if not info: e['error'] = 'no licence recorded'
        out.append(e)
    reg = {'version': 1, 'sampleRate': 44100, 'note': 'Generated by scripts/build-sfx-registry.py. Do not edit by hand.', 'sounds': out}
    json.dump(reg, open(os.path.join(SFX, 'registry.json'), 'w'), indent=0)
    bad = [s for s in out if not s['ok']]
    roles = {}
    for s in out:
        if s['ok']: roles[s['role']] = roles.get(s['role'], 0) + 1
    print(f"{len(out)} sounds, {len(out) - len(bad)} usable; by role: {roles}")
    for s in bad: print('  not usable:', s['key'], '-', s.get('error'))
    return 0 if len(bad) < len(out) else 1

if __name__ == '__main__': sys.exit(main())
