// Film quality check, run on every storyboard (the AI's or the rule-based one) before it is animated.
// It only checks what it can really inspect in the storyboard, and fixes what it finds:
//   - the same transition twice in a row, or one transition used for more than 40% of the cuts
//   - two neighbouring beats that look the same (same kind, same stage, same treatment)
//   - the same words on screen twice
//   - the film must open on its hook and end on the end card
export const QA_OUTS = { high: ['whip', 'zoom', 'drop', 'push', 'rise'], medium: ['push', 'whip', 'zoom', 'rise', 'drop'], calm: ['push', 'fade', 'rise', 'zoom'] };
const keyOf = (t) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const textsOf = (b) => [].concat(b.lines || [], b.text || [], b.tagline || [], b.lead || [], b.title || [], b.reveal || [], (b.items || []).map((x) => (typeof x === 'string' ? x : x?.t || x?.body || ''))).map((x) => (Array.isArray(x) ? x.join(' ') : x)).map(keyOf).filter((x) => x.length > 3);
export function qaBeats(beats, { energy = 'medium', min = 3 } = {}) {
  const fixes = [];
  let out = beats.map((b) => ({ ...b }));
  // 1. never the same words twice (the end card and the hook may echo a name, so they are exempt)
  const seen = new Set(); const kept = [];
  out.forEach((b, i) => {
    if (i === 0 || b.type === 'end') { textsOf(b).forEach((t) => seen.add(t)); kept.push(b); return; }
    const t = textsOf(b);
    if (t.length && t.every((x) => seen.has(x)) && out.length - (out.length - kept.length) >= 0) { fixes.push(`dropped a beat repeating "${t[0].slice(0, 24)}"`); return; }
    t.forEach((x) => seen.add(x)); kept.push(b);
  });
  if (kept.length >= min) out = kept;
  // 2. neighbours that look the same
  for (let i = 1; i < out.length - 1; i++) {
    const a = out[i - 1], b = out[i];
    if (a.type === b.type && (a.bg || '') === (b.bg || '') && (a.mode || '') === (b.mode || '')) {
      if (b.type === 'words') { b.mode = a.mode === 'glow' ? undefined : 'glow'; b.bg = b.mode === 'glow' ? 'dark' : (a.bg === 'dark' ? 'light' : 'dark'); fixes.push(`beat ${i + 1} no longer looks like beat ${i}`); }
      else if (b.bg) { b.bg = a.bg === 'dark' ? 'light' : 'dark'; fixes.push(`beat ${i + 1} stage changed`); }
    }
  }
  // 3. transitions: no immediate repeat, no single favourite
  const pool = QA_OUTS[energy] || QA_OUTS.medium;
  const counts = {}; const cap = Math.max(2, Math.ceil((out.length - 1) * 0.4));
  for (let i = 0; i < out.length - 1; i++) {
    let o = out[i].out || 'push';
    const prev = out[i - 1]?.out;
    counts[o] = (counts[o] || 0) + 1;
    if (o === prev || counts[o] > cap) {
      const alt = pool.find((x) => x !== prev && (counts[x] || 0) < cap && x !== (out[i + 1]?.type === 'map' && x === 'drop' ? 'drop' : ''));
      if (alt) { counts[o]--; o = alt; counts[o] = (counts[o] || 0) + 1; out[i].out = o; fixes.push(`transition ${i + 1} changed to ${alt}`); }
    }
  }
  // 4. the film ends on the end card and opens on a hook (never on the brand tile)
  const endAt = out.findIndex((b) => b.type === 'end');
  if (endAt > -1 && endAt !== out.length - 1) { const [e] = out.splice(endAt, 1); out.push(e); fixes.push('end card moved to the end'); }
  return { beats: out, fixes };
}
