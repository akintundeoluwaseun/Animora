"""Beat grid for every library music track (assets/music/*.mp3) -> assets/music/beats.json.
librosa beat tracking, then the grid is checked against the kick drum (energy below 120 Hz): librosa sometimes locks
onto the off-beat, so if the low-end onsets sit closer to the half-beat positions the grid is shifted by half a beat.
Run: python3 scripts/build-music-beats.py
"""
import json, os, sys
import numpy as np, librosa
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUS = os.path.join(ROOT, 'assets', 'music')
out = {}
for f in sorted(os.listdir(MUS)):
    if not f.endswith('.mp3'): continue
    try:
        y, sr = librosa.load(os.path.join(MUS, f), sr=22050, mono=True, duration=120)
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time')
        tempo = float(np.atleast_1d(tempo)[0]); beats = np.asarray(beats, float)
        if len(beats) < 8: out[f] = {'ok': False, 'reason': 'too few beats'}; continue
        # kick check: low-passed onsets vs the grid and the half-beat grid
        low = librosa.effects.preemphasis(y, coef=-0.97)
        S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512)); freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
        env = S[freqs < 120].sum(axis=0); on = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=512, units='time')
        period = 60 / tempo
        def err(grid): return float(np.median([np.min(np.abs(grid - t)) for t in on])) if len(on) else 0.0
        e0, e1 = err(beats), err(beats + period / 2)
        shifted = e1 + 0.01 < e0
        if shifted: beats = beats + period / 2
        out[f] = {'ok': True, 'bpm': round(tempo, 2), 'beats': [round(b, 3) for b in beats.tolist()], 'kickErrorMs': round(min(e0, e1) * 1000, 1), 'shiftedHalfBeat': shifted}
        print(f, round(tempo, 1), 'bpm', len(beats), 'beats', 'kick error', out[f]['kickErrorMs'], 'ms', '(shifted)' if shifted else '')
    except Exception as e:
        out[f] = {'ok': False, 'reason': str(e)[:120]}; print(f, 'failed:', e)
json.dump(out, open(os.path.join(MUS, 'beats.json'), 'w'))
