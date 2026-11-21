// Audio timing and sound-selection tests, run against the real page code, the real browser and the real mixer.
// node scripts/test-audio.js            (needs Chrome: PUPPETEER_EXECUTABLE_PATH or CHROME_PATH, and FFmpeg)
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const P = await import('../server/ai/premium/index.js');
const { inspectAnimation, renderVideo } = await import('../server/engine/renderer.js');
const { mixSfx, addSfxToVideo, alignMusic, beatsFor, sounds } = await import('../server/engine/sfx.js');
const require = createRequire(import.meta.url);
const GSAP = 'file://' + require.resolve('gsap/dist/gsap.min.js');
const FRAME = 1 / 30;
let pass = 0, fail = 0;
const ok = (cond, name, detail = '') => { if (cond) { pass++; console.log(`PASS  ${name}${detail ? `  (${detail})` : ''}`); } else { fail++; console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`); } };
// every test page has a slow background drift running the whole time, so no stretch counts as dead air and the
// film's clock equals the test's clock (dead-air removal is tested on the real templates)
const page = (id, body, script, audio = null, voice = null, sfx = {}) => { P.registerTestBlock(id, { body: '<div id="bgx" style="position:absolute;inset:0;background:#fafafa"></div>' + body, script: 'tl.to("#bgx",{opacity:0.98,duration:6,ease:"none"},0);' + script, gsapSrc: GSAP, sfx }); return P.premiumHtml({ block: id, vars: {}, audio, voice }); };
const inspect = (html) => inspectAnimation(html, { aspectRatio: '9:16' });
const H1 = '<h1 id="head" style="position:absolute;left:80px;top:700px;font:800 96px Arial;margin:0">Fresh cakes daily</h1>';

// 1. a headline sliding in gets a directional whoosh that peaks as it moves (starts just before)
{
  const info = await inspect(page('t1', H1, 'tl.set({}, {}, 0);tl.fromTo("#head",{x:700,autoAlpha:0},{x:0,autoAlpha:1,duration:0.5,ease:"power3.out"},1);tl.to({}, {duration:2},1.5)'));
  const w = info.sfx.find((e) => e.role === 'whoosh' || e.role === 'transition');
  ok(!!w && w.at === 1 && w.t <= 1 && w.t >= 1 - 0.25, '1 headline slide -> whoosh', w ? `${w.k} starts ${w.t.toFixed(3)} s for a move at ${w.at} s` : 'no whoosh');
}
// 2. words appearing one by one get light accents at their own reveal times, with restraint (not one per word)
{
  const words = ['Order', 'your', 'cake', 'today', 'please', 'now'].map((w, i) => `<span class="w" style="position:absolute;left:${80 + i * 150}px;top:900px;font:700 40px Arial">${w}</span>`).join('');
  const info = await inspect(page('t2', words, 'tl.from(".w",{autoAlpha:0,y:20,duration:0.2,stagger:0.18},2);tl.to({}, {duration:2},3.5)'));
  const acc = info.sfx.filter((e) => /^Word/.test(e.label));
  const times = [0, 1, 2, 3, 4, 5].map((i) => 2 + i * 0.18);
  const onTimes = acc.every((e) => times.some((t) => Math.abs(e.at - t) < 0.002));
  ok(acc.length >= 2 && acc.length <= 4 && onTimes, '2 sequential words -> restrained accents on their reveal times', `${acc.length} accents for 6 words at ${acc.map((e) => e.at).join(', ')}`);
}
// 3. a logo reveal at the end gets an impact on the frame, with a riser that ends on it
{
  const logo = '<img id="logo" src="data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><circle cx="150" cy="150" r="140" fill="#6c5ce7"/></svg>').toString('base64') + '" style="position:absolute;left:390px;top:800px;width:300px;height:300px">';
  const info = await inspect(page('t3', H1 + logo, 'tl.from("#head",{autoAlpha:0,y:40,duration:0.4},0.5);tl.from("#logo",{autoAlpha:0,scale:0.6,duration:0.5,ease:"back.out(2)"},4.5);tl.to({}, {duration:1},5)'));
  const hit = info.sfx.find((e) => e.role === 'impact'), riser = info.sfx.find((e) => e.kind === 'build-up');
  const reg = JSON.parse(readFileSync('assets/sfx/registry.json', 'utf8')).sounds;
  const rLen = riser ? reg.find((s) => s.key === riser.k)?.useful : 0;
  ok(!!hit && Math.abs(hit.at - 4.5) < 0.002 && Math.abs(hit.t - hit.at) <= FRAME && !!riser && Math.abs(riser.t + rLen - hit.at) <= FRAME, '3 logo reveal -> riser into impact', hit ? `impact ${hit.k} at ${hit.t}, riser ${riser?.k} ends ${(riser?.t + rLen).toFixed(3)}` : 'no impact');
}
// 4a. three things moving on the same frame make one sound, not three
{
  const boxes = [0, 1, 2].map((i) => `<div class="b" id="b${i}" style="position:absolute;left:100px;top:${300 + i * 300}px;width:300px;height:200px;background:#ddd;border-radius:20px"></div>`).join('');
  const info = await inspect(page('t4', boxes, 'tl.fromTo(".b",{x:-600},{x:0,duration:0.6},1);tl.to({}, {duration:2},1.6)'));
  const at1 = info.sfx.filter((e) => Math.abs(e.at - 1) < 0.01);
  ok(at1.length === 1, '4a same-frame moves -> one sound', `${at1.length} sound(s) at 1.0 s`);
}
// 4b. many loud overlapping effects never clip: true peak stays under -4 dBFS (sample peak checked on the 16-bit mix)
{
  const ev = Array.from({ length: 12 }, (_, i) => ({ t: 0.5 + i * 0.01, k: 'mg-impact-1', v: 1 }));
  const wav = mixSfx(ev, 3);
  let peak = 0; for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)) / 32768);
  ok(20 * Math.log10(peak) <= -4, '4b overlapping effects stay under -4 dBFS', `peak ${(20 * Math.log10(peak)).toFixed(2)} dBFS`);
}
// 5. music: the song's start is chosen so the scene change lands on a beat (the film is not moved)
{
  const grid = beatsFor('fresh-3-dancing.mp3');
  const events = [{ t: 2.0, k: 'mg-transition-1' }, { t: 4.4, k: 'mg-transition-8' }, { t: 7.1, k: 'mg-impact-1' }];
  const a = grid ? alignMusic(grid, events) : null;
  ok(!!a && a.errorMs < a.baseMs && a.errorMs < 120, '5 scene change aligned with music', a ? `beat error ${a.errorMs.toFixed(0)} ms (from ${a.baseMs.toFixed(0)} ms), song starts ${a.offset.toFixed(2)} s in` : 'no beat grid');
}
// 6. an edited animation: the sound keeps its id and moves with the event; nothing is duplicated
{
  const a = await inspect(page('t6a', H1, 'tl.fromTo("#head",{x:700},{x:0,duration:0.5},1);tl.to({}, {duration:3},1.5)'));
  const b = await inspect(page('t6b', H1, 'tl.fromTo("#head",{x:700},{x:0,duration:0.5},2);tl.to({}, {duration:3},2.5)'));
  const ea = a.sfx.find((e) => e.role === 'whoosh'), eb = b.sfx.find((e) => e.role === 'whoosh');
  ok(!!ea && !!eb && ea.id === eb.id && Math.abs((eb.t - ea.t) - 1) < 0.002 && a.sfx.length === b.sfx.length, '6 retimed animation -> sound follows, same id, no duplicates', ea && eb ? `${ea.id}: ${ea.t.toFixed(3)} -> ${eb.t.toFixed(3)}` : 'missing');
  // muting by id survives the retime
  const m = await inspect(page('t6c', H1, 'tl.fromTo("#head",{x:700},{x:0,duration:0.5},2);tl.to({}, {duration:3},2.5)', { mute: [ea?.id] }));
  ok(m.sfx.some((e) => e.id === ea?.id && e.muted && e.v === 0), '6b a switched-off sound stays off after the edit');
}
// 7. a missing or unsupported sound: skipped, nothing crashes; every registry entry marked usable exists and decodes
{
  let crashed = false; try { mixSfx([{ t: 0.2, k: 'does-not-exist', v: 1 }, { t: 0.4, k: 'mg-pop-1', v: 1 }], 1); } catch { crashed = true; }
  const reg = JSON.parse(readFileSync('assets/sfx/registry.json', 'utf8')).sounds.filter((s) => s.ok);
  const bank = sounds(); const missing = reg.filter((s) => !existsSync(s.file) || !bank[s.key]);
  ok(!crashed && !missing.length, '7 missing asset skipped; all registry sounds exist and decode', `${reg.length} sounds checked${missing.length ? `, missing: ${missing.map((s) => s.key).join(', ')}` : ''}`);
}
// 8. no music: the sound track is exactly as long as the film
{
  const wav = mixSfx([{ t: 0.3, k: 'mg-pop-1', v: 1 }], 7.533);
  ok((wav.length - 44) / 2 === Math.ceil(7.533 * 44100), '8 no music -> exact length', `${(wav.length - 44) / 2} samples`);
}
// 9. voice-over: effects duck under the voice
{
  const SR = 44100, voice = new Float32Array(SR * 4); for (let i = SR; i < SR * 3; i++) voice[i] = 0.3 * Math.sin(i / 7);
  const ev = [{ t: 0.3, k: 'mg-whoosh-1', v: 1 }, { t: 1.5, k: 'mg-whoosh-1', v: 1 }];
  const rms = (wav, a, b) => { let e = 0; for (let i = a; i < b; i++) { const x = wav.readInt16LE(44 + i * 2) / 32768; e += x * x; } return Math.sqrt(e / (b - a)); };
  const without = mixSfx(ev, 4), withV = mixSfx(ev, 4, { voice: new Float32Array(SR * 4) });
  const duck = mixSfx(ev, 4, { voice }); const plain = mixSfx(ev, 4);
  // compare the effect alone at 0.3 s (no voice) with the same effect at 1.5 s under the voice, after removing the voice
  const vOnly = mixSfx([], 4, { voice });
  let e1 = 0, e2 = 0; for (let i = Math.round(1.5 * SR); i < Math.round(1.9 * SR); i++) { const d = (duck.readInt16LE(44 + i * 2) - vOnly.readInt16LE(44 + i * 2)) / 32768; e1 += d * d; const p = plain.readInt16LE(44 + (i - Math.round(1.2 * SR)) * 2) / 32768; e2 += p * p; }
  const dB = 10 * Math.log10((e1 + 1e-12) / (e2 + 1e-12));
  ok(dB < -3 && without.length === withV.length, '9 voice-over -> effects duck under it', `effect under the voice is ${dB.toFixed(1)} dB vs alone (approx; the mix is mastered)`);
  void rms;
}
// 10. a complete render with audio: audio as long as the video, every sound lands within about one frame
{
  const dir = mkdtempSync(path.join(tmpdir(), 'audio-test-'));
  const boxes = [0, 1, 2, 3].map((i) => `<div id="c${i}" style="position:absolute;left:140px;top:${260 + i * 360}px;width:800px;height:260px;background:#f1f0ff;border-radius:28px;font:700 60px Arial;padding:40px">Card ${i + 1}</div>`).join('');
  const html = page('t10', boxes, 'tl.set({}, {}, 0);[0,1,2,3].forEach(function(i){tl.fromTo("#c"+i,{x:-900},{x:0,duration:0.45,ease:"power2.out"},0.6+i*1.1);});tl.to({}, {duration:1.2},4.4)');
  const silent = path.join(dir, 's.mp4'), out = path.join(dir, 'o.mp4');
  const r = await renderVideo({ html, outFile: silent, aspectRatio: '9:16' });
  const evs = r.sfx.filter((e) => !e.muted);
  await addSfxToVideo(silent, out, evs, r.duration, {});
  const probe = (sel) => Number(spawnSync('ffprobe', ['-v', 'error', '-select_streams', sel, '-show_entries', 'stream=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' }).stdout.trim());
  const vd = probe('v:0'), ad = probe('a:0');
  ok(Math.abs(vd - ad) <= FRAME, '10a rendered audio as long as the video', `video ${vd.toFixed(3)} s, audio ${ad.toFixed(3)} s`);
  // where each sound really starts in the exported AAC: slide the original sound file along the exported audio and
  // take the position where they match best (cross-correlation), then compare with the planned start
  const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', out, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 }).stdout;
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 4)), SR = 44100, bank = sounds();
  const errs = evs.map((e) => {
    const ref = bank[e.k]; const L = Math.min(ref.length, Math.round(0.12 * SR)), c = Math.round(e.t * SR);
    let best = -Infinity, at = c;
    for (let lag = -Math.round(0.08 * SR); lag <= Math.round(0.08 * SR); lag += 2) {
      const p0 = c + lag; if (p0 < 0 || p0 + L >= x.length) continue;
      let sum = 0, nx = 0; for (let j = 0; j < L; j += 2) { sum += x[p0 + j] * ref[j]; nx += x[p0 + j] * x[p0 + j]; }
      const sc = sum / Math.sqrt(nx + 1e-9); if (sc > best) { best = sc; at = p0; }
    }
    return Math.abs(at - c) / SR;
  });
  const worst = Math.max(...errs);
  ok(evs.length === 4 && worst <= FRAME, '10b every sound within about one frame in the exported MP4', `${evs.length} sounds, timing errors ${errs.map((e) => (e * 1000).toFixed(1)).join(', ')} ms (frame = ${Math.round(FRAME * 1000)} ms)`);
  writeFileSync(path.join(dir, 'events.json'), JSON.stringify(evs));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
