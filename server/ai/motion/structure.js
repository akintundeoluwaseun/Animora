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
export const PHOTO_LAYOUTS = ['float', 'full', 'split', 'editorial'];

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
export function pickStructure({ direction = 'general', angle = 'clean', photos = 0, group = 'business', memory = [], rnd = Math.random } = {}) {
  const d = BY_DIRECTION[direction] || BY_DIRECTION.general;
  const a = BY_ANGLE[angle] || BY_ANGLE.clean;
  const rank = (list, v) => { const i = list.indexOf(v); return i < 0 ? 0 : list.length - i; };   // earlier in the list = stronger fit
  const openers = OPENINGS.filter((o) => (!NEEDS_PHOTO.has(o) || photos > 0) && !(BLOCK[direction] || []).includes(o)).map((o) => {
    const fit = 1 + rank(d.open, o) * 1.3 + rank(a.open, o) * 1.1;
    const used = recency(memory, (m) => String(m.opening || '').startsWith(o === 'typo' ? 'words' : o === 'brandFirst' ? 'icon' : o === 'story' ? 'words:left' : o === 'photoFirst' ? 'photos:full' : o === 'atmospheric' ? 'photos:full' : o === 'documentary' ? 'photos:editorial' : 'words:slam'));
    return [o, Math.max(0.05, fit) / (1 + used * 3)];
  });
  const opening = weighted(openers, rnd);
  const endings = ENDINGS.filter((e) => e !== 'photo' || photos > 0).map((e) => {
    const fit = 1 + rank(d.end, e) * 1.3 + rank(a.end, e) * 1.0;
    const used = recency(memory, (m) => m.ending === `end:${e}`);
    return [e, Math.max(0.05, fit) / (1 + used * 3)];
  });
  const ending = weighted(endings, rnd);
  const layouts = photos > 0 ? d.photos.map((l, i) => [l, (d.photos.length - i + 1) / (1 + recency(memory, (m) => m.photos === l) * 2.5)]) : [['float', 1]];
  const photosLayout = weighted(layouts, rnd);
  const wordsLeft = rnd() < d.left * (1 / (1 + recency(memory, (m) => m.left > 0) * 0.5)) ? 1 : 0;
  const list = rnd() < (LIST_DIRECTIONS[direction] ?? 0.3) * (1 / (1 + recency(memory, (m) => m.lists > 0) * 0.8)) ? 1 : 0;
  return { opening, ending, photos: photosLayout, wordsLeft, list, direction, angle, group };
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
export const structureBrief = (st) => `${OPENING_TEXT[st.opening]}\n${ENDING_TEXT[st.ending]}\n${st.photos !== 'float' ? `Photo beats elsewhere use "layout":"${st.photos}".` : 'Photo beats elsewhere use the default floating layout (no layout field).'}${st.wordsLeft ? '\nSet one or two "words" beats in the middle with "layout":"left".' : ''}${st.list ? '\nShow their strengths as ONE "stack" or "toggles" beat with "layout":"list" (an editorial numbered list), not pastel cards.' : ''}`;

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

export const LAYOUTS = { photos: ['full', 'split', 'editorial'], words: ['left'], end: ['minimal', 'poster', 'photo'], stack: ['list'], toggles: ['list'] };
