// The film's structure: how it OPENS, how it ENDS and how its pictures and statements are COMPOSED.
// Chosen once per film, from what the content calls for (the creative direction and storytelling angle), weighed against
// what Animora made recently (creative memory) so the same combination is not picked again and again.
// Both the rule-based composer and the AI director are given the same structure, so the choice survives either path.

// openings: what the viewer sees first
//   typo        a typographic hook (slam / build / glow)         brandFirst  the brand tile, then the headline
//   photoFirst  a full-screen picture with the headline on it    atmospheric a quiet full-screen picture, then a glow statement
//   documentary an editorial picture with a factual caption      reveal      slam words, then the picture is revealed
//   story       a left-set editorial statement
export const OPENINGS = ['typo', 'brandFirst', 'photoFirst', 'atmospheric', 'documentary', 'reveal', 'story'];
const NEEDS_PHOTO = new Set(['photoFirst', 'atmospheric', 'documentary', 'reveal']);
// endings: card (icon + name + line + contact pill), minimal (hairline + name set large), poster (the closing line is the hero),
// photo (over their last picture). All of them keep the name and the way to reach the owner on screen.
export const ENDINGS = ['card', 'minimal', 'poster', 'photo'];
export const LIST_DIRECTIONS = { memorial: 0.8, luxury: 0.9, corporate: 0.75, fashion: 0.8, beauty: 0.6, education: 0.7, wedding: 0.5, faith: 0.5, announcement: 0.85, realestate: 0.5, health: 0.5, general: 0.4, tech: 0.25, music: 0.2, restaurant: 0.2, bakery: 0.15, kids: 0, birthday: 0, sports: 0.15 };
export const PHOTO_LAYOUTS = ['float', 'full', 'split', 'editorial', 'spotlight', 'cascade', 'triptych'];

// what each kind of content calls for (first = most fitting)
const BY_DIRECTION = {
  memorial: { open: ['atmospheric', 'documentary', 'typo'], end: ['minimal', 'poster', 'photo'], photos: ['editorial', 'full'], left: 0.6 },
  faith: { open: ['atmospheric', 'photoFirst', 'story', 'typo'], end: ['poster', 'photo', 'card'], photos: ['full', 'editorial', 'split'], left: 0.3 },
  luxury: { open: ['atmospheric', 'brandFirst', 'photoFirst'], end: ['minimal', 'photo', 'poster'], photos: ['editorial', 'full'], left: 0.7 },
  wedding: { open: ['atmospheric', 'documentary', 'photoFirst', 'brandFirst'], end: ['poster', 'photo', 'minimal'], photos: ['editorial', 'full', 'split'], left: 0.4 },
  birthday: { open: ['typo', 'reveal', 'photoFirst'], end: ['card', 'poster', 'photo'], photos: ['float', 'split', 'full'], left: 0 },
  music: { open: ['reveal', 'typo', 'photoFirst'], end: ['poster', 'card', 'photo'], photos: ['full', 'split', 'float'], left: 0.15 },
  corporate: { open: ['typo', 'brandFirst', 'documentary', 'story'], end: ['card', 'minimal', 'poster'], photos: ['split', 'editorial', 'float'], left: 0.6 },
  realestate: { open: ['photoFirst', 'atmospheric', 'brandFirst', 'documentary'], end: ['photo', 'card', 'poster'], photos: ['full', 'split', 'editorial'], left: 0.3 },
  restaurant: { open: ['photoFirst', 'reveal', 'typo'], end: ['card', 'photo', 'poster'], photos: ['full', 'split', 'float'], left: 0.15 },
  bakery: { open: ['photoFirst', 'typo', 'reveal'], end: ['card', 'poster', 'photo'], photos: ['float', 'split', 'full'], left: 0.1 },
  education: { open: ['typo', 'brandFirst', 'documentary', 'story'], end: ['card', 'poster', 'minimal'], photos: ['split', 'editorial', 'float'], left: 0.5 },
  kids: { open: ['typo', 'reveal', 'photoFirst'], end: ['card', 'poster'], photos: ['float', 'full'], left: 0 },
  sports: { open: ['reveal', 'typo', 'photoFirst'], end: ['poster', 'card', 'photo'], photos: ['full', 'split'], left: 0.1 },
  fashion: { open: ['photoFirst', 'atmospheric', 'typo'], end: ['minimal', 'photo', 'poster'], photos: ['editorial', 'full'], left: 0.6 },
  beauty: { open: ['atmospheric', 'photoFirst', 'brandFirst'], end: ['minimal', 'photo', 'card'], photos: ['editorial', 'full', 'split'], left: 0.5 },
  tech: { open: ['typo', 'brandFirst', 'reveal'], end: ['card', 'poster', 'minimal'], photos: ['split', 'editorial', 'float'], left: 0.4 },
  health: { open: ['brandFirst', 'documentary', 'typo'], end: ['card', 'minimal', 'poster'], photos: ['split', 'editorial', 'float'], left: 0.4 },
  announcement: { open: ['typo', 'story', 'documentary'], end: ['poster', 'minimal', 'card'], photos: ['split', 'editorial'], left: 0.7 },
  general: { open: ['typo', 'brandFirst', 'photoFirst', 'documentary'], end: ['card', 'minimal', 'poster'], photos: ['float', 'split', 'editorial', 'full'], left: 0.3 },
};
// openings that never suit a kind of content (a slam-word reveal at a burial, a brand tile before a prayer...)
const BLOCK = { memorial: ['reveal', 'brandFirst'], faith: ['reveal'], luxury: ['reveal'], wedding: ['reveal'], beauty: ['reveal'], fashion: ['reveal'], announcement: ['reveal'], health: ['reveal'], education: ['reveal'] };
// the storytelling angle leans the choice a further way
const BY_ANGLE = {
  type: { open: ['typo', 'story', 'reveal'], end: ['poster', 'minimal'] },
  photos: { open: ['photoFirst', 'documentary', 'atmospheric'], end: ['photo', 'card'] },
  calm: { open: ['atmospheric', 'documentary', 'typo'], end: ['minimal', 'photo'] },
  loud: { open: ['reveal', 'typo', 'photoFirst'], end: ['poster', 'card'] },
  story: { open: ['story', 'documentary', 'atmospheric', 'brandFirst'], end: ['poster', 'photo', 'minimal'] },
  clean: { open: ['brandFirst', 'typo', 'documentary'], end: ['card', 'minimal'] },
};

// ---------------------------------------------------------------- creative memory
/** What a finished film actually did (read from its beats, so an AI film and a rule film are described the same way). */
export function signatureOf(beats = [], look = null) {
  const b0 = beats[0] || {};
  const end = beats[beats.length - 1] || {};
  const photos = beats.find((b, i) => i > 0 && b.type === 'photos') || (b0.type === 'photos' ? b0 : null);
  return {
    opening: `${b0.type || ''}${b0.layout ? ':' + b0.layout : b0.mode ? ':' + b0.mode : ''}`,
    ending: `end:${end.layout || 'card'}`,
    photos: photos ? photos.layout || 'float' : 'none',
    left: beats.filter((b) => b.type === 'words' && b.layout === 'left').length,
    mids: beats.slice(1, -1).map((b) => (b.layout ? `${b.type}:${b.layout}` : b.type === 'words' || b.type === 'photos' ? `${b.type}:center` : '')).filter(Boolean).join('>'),
    lists: beats.filter((b) => b.layout === 'list').length,
    outs: beats.slice(0, -1).map((b) => b.out).join('>'),
    look: look?.key || '',
    deco: look?.deco || '',
    display: look?.display || '',
    arrangement: beats.map((b) => b.type).join('>'),
  };
}
/** How much a candidate resembles what was made recently (0 = nothing in common). Newer films count more. */
export function recency(memory, fn) {
  let total = 0;
  (memory || []).slice(0, 10).forEach((m, i) => { if (m && fn(m)) total += 1 / (1 + i * 0.45); });
  return total;
}
const weighted = (items, rnd) => {
  const sum = items.reduce((a, [, w]) => a + w, 0);
  let r = rnd() * sum;
  for (const [v, w] of items) { r -= w; if (r <= 0) return v; }
  return items[items.length - 1][0];
};

/**
 * Choose how the film opens, how it ends and how its pictures are composed.
 * @param {object} o  { direction (id), angle, photos (count), hasLogo, group ('business'|'social'|...), memory ([signature, newest first]), rnd }
 */
// the signature prefix each opening produces (so a recorded film can be matched back to the opening that made it)
const OPENING_SIG = { brandFirst: 'icon', story: 'words:left', photoFirst: 'photos:full', atmospheric: 'photos:full', documentary: 'photos:editorial' };
const openingSig = (o) => OPENING_SIG[o] || 'words:slam';
export function pickStructure({ direction = 'general', angle = 'clean', photos = 0, group = 'business', memory = [], rnd = Math.random, solemn = false, prev = null } = {}) {
  const d = BY_DIRECTION[direction] || BY_DIRECTION.general;
  const a = BY_ANGLE[angle] || BY_ANGLE.clean;
  const rank = (list, v) => { const i = list.indexOf(v); return i < 0 ? 0 : list.length - i; };   // earlier in the list = stronger fit
  // Regenerate: never the same opening or ending as the film being replaced (when there is any alternative)
  const notOpen = (o) => !(o === 'typo' ? /^words(:glow)?$/.test(String(prev?.opening)) : prev?.opening === openingSig(o));
  let pool = OPENINGS.filter((o) => (!NEEDS_PHOTO.has(o) || photos > 0) && !(BLOCK[direction] || []).includes(o));
  if (prev?.opening && pool.filter(notOpen).length) pool = pool.filter(notOpen);
  const openers = pool.map((o) => {
    const fit = 1 + rank(d.open, o) * 1.3 + rank(a.open, o) * 1.1;
    const used = recency(memory, (m) => String(m.opening || '').startsWith(o === 'typo' ? 'words' : o === 'brandFirst' ? 'icon' : o === 'story' ? 'words:left' : o === 'photoFirst' ? 'photos:full' : o === 'atmospheric' ? 'photos:full' : o === 'documentary' ? 'photos:editorial' : 'words:slam'));
    return [o, Math.max(0.05, fit) / (1 + used * 3)];
  });
  const opening = weighted(openers, rnd);
  let endPool = ENDINGS.filter((e) => e !== 'photo' || photos > 0);
  if (prev?.ending && endPool.filter((e) => prev.ending !== `end:${e}`).length) endPool = endPool.filter((e) => prev.ending !== `end:${e}`);
  const endings = endPool.map((e) => {
    const fit = 1 + rank(d.end, e) * 1.3 + rank(a.end, e) * 1.0;
    const used = recency(memory, (m) => m.ending === `end:${e}`);
    return [e, Math.max(0.05, fit) / (1 + used * 3)];
  });
  const ending = weighted(endings, rnd);
  const layouts = photos > 0 ? d.photos.map((l, i) => [l, (d.photos.length - i + 1) / (1 + recency(memory, (m) => m.photos === l) * 2.5)]) : [['float', 1]];
  const photosLayout = weighted(layouts, rnd);
  const wordsLeft = rnd() < d.left * (1 / (1 + recency(memory, (m) => m.left > 0) * 0.5)) ? 1 : 0;
  const list = rnd() < (LIST_DIRECTIONS[direction] ?? 0.3) * (1 / (1 + recency(memory, (m) => m.lists > 0) * 0.8)) ? 1 : 0;
  const presentation = pickPresentation({ direction, angle, photos, group, memory, rnd, solemn, prev });
  return { opening, ending, photos: photosLayout, wordsLeft, list, direction, angle, group, presentation };
}


// ---------------------------------------------------------------- presentation: how the MIDDLE of the film tells its story
// Not templates: each is a bias (which compositions, which kinds of beat, how it moves) that the subject, the storytelling angle and
// creative memory weigh. `photos`/`words` are ordered pools (first = strongest); `facts` is how a list of strengths is shown;
// `cta` is the chance a shop-style button beat appears; `avoid` are UI-card beats that do not belong to this way of telling it.
export const PRESENTATIONS = {
  product:     { motion: 'editorial', pics: 2,   photos: ['spotlight', 'full', 'cascade'],        words: ['right', 'left'],                 facts: ['ledger', 'list'],         stat: 'side', cta: 0.3,  words_share: 0.5,  avoid: ['notif', 'search', 'ring', 'grid'] },
  editorial:   { motion: 'editorial', pics: 1,   photos: ['editorial', 'cascade', 'spotlight'],   words: ['right', 'stagger', 'left'],      facts: ['list', 'ledger'],         stat: 'side', cta: 0.2,  words_share: 0.7,  avoid: ['notif', 'search', 'receipt', 'ring', 'grid'] },
  cinematic:   { motion: 'cinematic', pics: 2,   photos: ['full', 'spotlight', 'triptych'],       words: ['left', 'bleed'],                 facts: ['list'],                   stat: 'side', cta: 0.15, words_share: 0.5,  avoid: ['notif', 'search', 'receipt', 'ring', 'grid'] },
  split:       { motion: 'kinetic', pics: 1,     photos: ['split', 'cascade', 'float'],           words: ['stagger', 'right', 'left'],      facts: ['cards', 'ledger'],        stat: 'card', cta: 0.6,  words_share: 0.5,  avoid: [] },
  typographic: { motion: 'kinetic', pics: 0,     photos: ['split', 'float', 'cascade'],           words: ['bleed', 'stagger', 'right', 'left'], facts: ['list', 'cards'],      stat: 'side', cta: 0.4,  words_share: 0.85, avoid: ['notif', 'search'] },
  documentary: { motion: 'documentary', pics: 2, photos: ['triptych', 'editorial', 'full'],       words: ['left', 'right'],                 facts: ['ledger', 'list'],         stat: 'side', cta: 0.1,  words_share: 0.5,  avoid: ['notif', 'search', 'ring', 'grid'] },
  minimalist:  { motion: 'restrained', pics: 1,  photos: ['full', 'editorial', 'spotlight'],      words: ['left', 'right'],                 facts: ['list', 'ledger'],         stat: 'side', cta: 0.1,  words_share: 0.6,  avoid: ['notif', 'search', 'receipt', 'ring', 'grid'] },
  structured:  { motion: 'restrained', pics: 1,  photos: ['split', 'cascade', 'spotlight'],       words: ['left', 'right'],                 facts: ['ledger', 'list'],         stat: 'side', cta: 0.7,  words_share: 0.5,  avoid: ['notif', 'search'] },
  demo:        { motion: 'kinetic', pics: 0,     photos: ['float', 'split'],                      words: ['left'],                          facts: ['cards'],                  stat: 'card', cta: 0.9,  words_share: 0.2,  avoid: [] },
};
// what each kind of content calls for (weights; the first is the natural fit)
const PRES_BY_DIRECTION = {
  memorial: { minimalist: 3, documentary: 3 }, faith: { cinematic: 3, minimalist: 2, editorial: 1 },
  luxury: { cinematic: 3, product: 3, minimalist: 2, editorial: 1 }, wedding: { editorial: 3, cinematic: 2, documentary: 1 },
  birthday: { typographic: 3, split: 3, editorial: 1 }, music: { typographic: 3, cinematic: 2, split: 1 },
  corporate: { structured: 4, editorial: 2, documentary: 1 }, realestate: { documentary: 3, cinematic: 2, structured: 2, product: 1 },
  restaurant: { product: 3, documentary: 2, split: 1, cinematic: 1 }, bakery: { product: 3, split: 2, typographic: 1 },
  education: { structured: 3, editorial: 2, typographic: 1 }, kids: { typographic: 2, split: 3 }, sports: { typographic: 3, cinematic: 2, split: 1 },
  fashion: { editorial: 4, cinematic: 2, product: 1 }, beauty: { product: 4, editorial: 2, minimalist: 1 }, tech: { demo: 3, product: 2, structured: 2, typographic: 1 },
  health: { structured: 3, minimalist: 2, documentary: 1 }, announcement: { typographic: 3, minimalist: 2, editorial: 1 },
  general: { editorial: 2, product: 1, split: 2, typographic: 1, structured: 1, cinematic: 1, documentary: 1 },
};
const PRES_BY_ANGLE = {
  type: { typographic: 3, editorial: 1 }, photos: { product: 2, cinematic: 2, documentary: 2, editorial: 1 }, calm: { minimalist: 3, cinematic: 2, documentary: 1 },
  loud: { typographic: 2, split: 2, product: 1 }, story: { documentary: 2, cinematic: 2, editorial: 2 }, clean: { structured: 2, minimalist: 1, product: 1 },
};
// subjects whose films are not about pictures cannot be product/documentary/cinematic without pictures
const NEEDS_PICTURES = new Set(['product', 'documentary', 'cinematic']);
export function pickPresentation({ direction = 'general', angle = 'clean', photos = 0, group = 'business', memory = [], rnd = Math.random, solemn = false, prev = null } = {}) {
  const d = PRES_BY_DIRECTION[direction] || PRES_BY_DIRECTION.general, a = PRES_BY_ANGLE[angle] || {};
  const strict = direction !== 'general' && PRES_BY_DIRECTION[direction];   // a known subject only ever gets presentations that suit it
  const cands = Object.keys(PRESENTATIONS).filter((k) => (photos > 0 || !NEEDS_PICTURES.has(k)) && !(solemn && ['typographic', 'split', 'demo'].includes(k)) && !(strict && !d[k]))
    .map((k) => {
      const fit = 0.1 + (d[k] || 0) * 1.2 + (a[k] || 0) * ((d[k] || 0) ? 0.9 : 0.15);   // the subject decides; the angle only leans within it
      const used = recency(memory, (m) => m.presentation === k);
      return [k, fit / (1 + used * 2.2)];
    });
  const fresh = prev?.presentation ? cands.filter(([k]) => k !== prev.presentation) : cands;   // regenerate: tell the story another way
  const id = cands.length ? weighted(fresh.length ? fresh : cands, rnd) : 'editorial';
  const P = PRESENTATIONS[id];
  let motion = P.motion;
  if (angle === 'loud' && !solemn) motion = 'kinetic'; else if (angle === 'calm' && motion === 'kinetic') motion = 'restrained';
  // the middle's compositions: a pool ordered by fit, the strongest first, the rest used as the film goes on
  const rot = (list) => { const k = list.length > 1 && rnd() < 0.4 ? 1 : 0; return k ? [...list.slice(1), list[0]] : list; };
  return { id, motion, photos: photos > 0 ? rot(P.photos) : ['float'], words: rot(P.words), facts: P.facts[Math.floor(rnd() * P.facts.length)], stat: P.stat, cta: rnd() < P.cta, pics: P.pics, wordsShare: P.words_share, avoid: P.avoid };
}

/** The instructions the AI director gets for the same structure (so the choice survives the AI path). */
export const OPENING_TEXT = {
  typo: 'OPENING: typography. A "words" beat (slam, build or glow) carrying the headline.',
  brandFirst: 'OPENING: the brand first. An "icon" beat (mode "wordmark") before anything else, then the headline.',
  photoFirst: 'OPENING: an immediate visual hook. First beat is "photos" with "layout":"full" and the headline as its "lines". No title card before it.',
  atmospheric: 'OPENING: atmosphere. First beat is "photos" with "layout":"full" and NO lines (just the picture, quiet), then a "words" glow statement.',
  documentary: 'OPENING: documentary. First beat is "photos" with "layout":"editorial" and one short factual caption as "lines" (what, where or when), then the headline.',
  reveal: 'OPENING: a reveal. First beat is "words" mode "slam" (2-4 words), the next beat is "photos" with "layout":"full" revealing the subject.',
  story: 'OPENING: a story statement. First beat is "words" with "layout":"left" (a left-aligned editorial sentence).',
};
export const ENDING_TEXT = {
  card: 'ENDING: the standard end card (no layout field).',
  minimal: 'ENDING: "end" with "layout":"minimal" (a hairline and the name set large, quiet).',
  poster: 'ENDING: "end" with "layout":"poster" (the closing line is the hero; name and contact are small print).',
  photo: 'ENDING: "end" with "layout":"photo" and "url" set to one of their photo urls (name, line and contact over the picture).',
};
const PRES_TEXT = {
  product: 'The product / the food / the place is the hero. Keep photo beats big and off-centre ("spotlight": the picture bleeds off one edge, a detail circle overlaps it). Few words, one fact at a time; no pastel UI cards.',
  editorial: 'Magazine pacing: asymmetric, overlapping pictures ("editorial" / "cascade"), statements set right-aligned or stepped diagonally ("right" / "stagger"). No UI mock-ups.',
  cinematic: 'Cinematic: full-bleed pictures that drift slowly ("full", "spotlight"), a few quiet left-set statements, nothing busy. Slow dissolves, long holds.',
  split: 'Split-screen energy: pictures in contrasting areas ("split" / "cascade"), stepped statements ("stagger"), bold contrast between beats.',
  typographic: 'Typography leads: one oversized word that leaves the frame ("bleed"), stepped lines ("stagger"), right-set lines ("right"), huge numbers ("side"). Pictures are secondary.',
  documentary: 'Documentary: natural, edge-to-edge pictures ("triptych", "editorial", "full") with factual left-set captions; facts as a ledger. Restrained motion.',
  minimalist: 'Minimal: large negative space, one idea per beat, left- or right-set statements, full-bleed pictures. Almost no cards, no button.',
  structured: 'Structured and credible: facts as a ledger (label left, value right), split pictures, numbers set big and left ("side"). Calm, precise motion.',
  demo: 'Product demo: phone / chat / notification mock-ups are welcome here; keep them moving.',
};
export const structureBrief = (st) => `${OPENING_TEXT[st.opening]}\n${ENDING_TEXT[st.ending]}\n${st.photos !== 'float' ? `Photo beats elsewhere use "layout":"${st.photos}".` : 'Photo beats elsewhere use the default floating layout (no layout field).'}${st.wordsLeft ? '\nSet one or two "words" beats in the middle with "layout":"left".' : ''}${st.list ? '\nShow their strengths as ONE "stack" or "toggles" beat with "layout":"list" (an editorial numbered list), not pastel cards.' : ''}${st.presentation ? `\nMIDDLE (how the film tells its story, "${st.presentation.id}"): ${PRES_TEXT[st.presentation.id]} Layouts to draw on for the middle: photos ${st.presentation.photos.join(' / ')}; words ${st.presentation.words.join(' / ')}; facts ${st.presentation.facts}. Set top-level "motion":"${st.presentation.motion}". ${st.presentation.cta ? 'A button beat is allowed.' : 'No button beat; the end card carries the contact.'} Do not centre every beat: vary where the content sits.` : ''}`;

/**
 * Make an (AI or rule-based) storyboard honour the structure: fill any layout the author left out, and never lose
 * the essentials. Anything the author did choose is kept.
 */
export function conformStructure(beats, st, { photoUrls = [] } = {}) {
  const out = beats.map((b) => ({ ...b }));
  let seenPhotos = 0;
  out.forEach((b, i) => {
    if (b.type === 'photos') {
      if (!b.layout) {
        if (i === 0 && st.opening === 'photoFirst') b.layout = 'full';
        else if (i === 0 && st.opening === 'atmospheric') b.layout = 'full';
        else if (i === 0 && st.opening === 'documentary') b.layout = 'editorial';
        else if (st.photos !== 'float' && (seenPhotos > 0 || i > 0)) b.layout = st.photos;
      }
      seenPhotos++;
    }
  });
  const end = out[out.length - 1];
  if (end && end.type === 'end') {
    if (!end.layout && st.ending !== 'card') end.layout = st.ending;
    if (end.layout === 'photo') {
      const used = out.filter((b) => b.type === 'photos').flatMap((b) => b.urls || []);
      const pool = photoUrls.length ? photoUrls : used;
      if (!end.url || !pool.includes(end.url)) end.url = pool[pool.length - 1] || null;
      if (!end.url) delete end.layout;
    }
  }
  return out;
}


/**
 * Compose the MIDDLE of a storyboard (rule-based or AI) from the presentation: which beats are set off-centre, which are pictures
 * placed edge-to-edge, how a list of strengths is shown. Anything the author already chose (a `layout`) is kept; only missing ones are filled.
 */
export function composeMiddle(beats, st, { solemn = false } = {}) {
  const P = st?.presentation;
  const out = beats.map((b) => ({ ...b }));
  if (!P) return out;
  const last = out.length - 1;
  // pictures
  let k = 0, side = 'right';
  out.forEach((b, i) => {
    if (b.type !== 'photos' || i === 0 || i === last || b.layout) return;
    const l = P.photos[k % P.photos.length]; k++;
    if (l !== 'float') { b.layout = l; if (l === 'spotlight' || l === 'cascade') { b.side = side; side = side === 'right' ? 'left' : 'right'; } }
  });
  // statements: some are set off-centre, never the same composition twice in a row
  const cands = out.map((b, i) => [b, i]).filter(([b, i]) => b.type === 'words' && i > 0 && i < last && !b.layout && b.mode !== 'slam');
  let want = cands.length ? Math.max(P.wordsShare >= 0.5 ? 1 : 0, Math.round(cands.length * P.wordsShare)) : 0;
  let prev = '', w = 0;
  cands.forEach(([b], n) => {
    if (want <= 0) return;
    if (cands.length > 1 && n % 2 === 1 && want >= cands.length - n) { /* keep going: all remaining are needed */ }
    else if (cands.length > 1 && n % 2 === 1 && P.wordsShare < 0.75) return;   // leave every other statement centred
    const lines = [].concat(b.lines || []);
    const ok = (l) => (l === 'bleed' ? lines.length >= 1 && String(lines[0]).length <= 14 : l === 'stagger' ? lines.length >= 2 : true) && (b.mode !== 'glow' || l === 'left' || l === 'right');
    const pool = P.words.filter((l) => ok(l) && l !== prev);
    const l = (pool.length ? pool : ['left'])[w % Math.max(1, pool.length)]; w++;
    b.layout = l; prev = l; want--;
    if (b.mode === 'glow' && l !== 'left') delete b.mode;
  });
  // facts
  out.forEach((b, i) => {
    if ((b.type === 'stack' || b.type === 'toggles') && !b.layout && (b.items || []).length >= 2 && (P.facts === 'list' || P.facts === 'ledger')) b.layout = P.facts;
    if ((b.type === 'stat' || b.type === 'price') && !b.layout && P.stat === 'side' && !b.old) b.layout = 'side';
  });
  return out;
}

export const LAYOUTS = { photos: ['full', 'split', 'editorial', 'spotlight', 'cascade', 'triptych'], words: ['left', 'right', 'stagger', 'bleed'], end: ['minimal', 'poster', 'photo'], stack: ['list', 'ledger'], toggles: ['list', 'ledger'], stat: ['side'], price: ['side'] };
export const MOTIONS = ['kinetic', 'restrained', 'editorial', 'cinematic', 'documentary'];
