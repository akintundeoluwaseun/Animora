// "Practice AI": a scripted planner that works with no internet and no Gemini key.
// It asks the same questions the real planner would, parses the answers and builds a valid plan.
// Lets the whole product be clicked through, tested and rehearsed offline.

const PHONE_RE = /(\+?234[\s-]?|0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}/;
const PRICE_RE = /(₦|NGN\s?|N(?=\d))\s?(\d[\d,]*(?:\.\d+)?)(\s?k\b)?/i;
const COLORS = {
  red: '#D7263D', green: '#1F8A4C', blue: '#1F6FEB', navy: '#0B2E6B', yellow: '#FFC93C', gold: '#C9A227',
  orange: '#E8530E', purple: '#7B2CBF', pink: '#E83E8C', black: '#111111', white: '#FFFFFF', teal: '#0FA3A3',
  brown: '#7A4A21', maroon: '#7A1F2B', cream: '#FFF6E9', silver: '#C0C6CF',
};
const DARK_BG = { '#FFFFFF': '#111111', '#FFF6E9': '#1B0F08' };

const QUESTIONS = {
  business: "Let's make your ad! 🎬 What's the name of your business, and what do you sell?",
  offer: 'Nice! What is the main message or promo? Add prices if you have them, e.g. "Jollof rice ₦2,500, Fried rice ₦3,000".',
  contact: 'What WhatsApp or phone number should customers use? Add your address too if you want it shown.',
  media: 'Do you have a logo or product photos? 📸 Upload them now with the 📎 button (or "Add logo" / "Add photos" on the right), then type "done". No pictures? Just say "no".',
  voice: 'Would you like a narration script for ElevenLabs or another voice generator? 🎙️\n1) I have my own script (paste it)\n2) Write one for me\n3) No script, just on-screen text. The MP4 will always be silent.',
  script: 'Great, paste your script here. I\'ll split it into scenes and time each scene to its line. The video itself will be silent.',
  look: 'Almost done. What are your brand colours, where will you post it (WhatsApp Status, TikTok, Instagram feed, YouTube), and how long should it be (e.g. 30 seconds)?',
  lookVoice: 'Almost done. What are your brand colours, and where will you post it (WhatsApp Status, TikTok, Instagram feed, YouTube)? The length will follow your narration script.',
};
const ORDER = ['business', 'offer', 'contact', 'media', 'voice', 'script', 'look'];
const wc = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;

// "1) own script" / "2) write one" / "3) none" - or they simply pasted a script straight away.
function voiceChoice(text = '') {
  const t = text.trim().toLowerCase();
  if (wc(t) > 14) return 'own-inline';
  if (/^\s*3\b|\bno\b|none|without|no voice|just music|no need/.test(t)) return 'none';
  if (/^\s*2\b|write|create|make (one|it)|you do|for me|generate/.test(t)) return 'ai';
  if (/^\s*1\b|own|my script|i have|mine/.test(t)) return 'own';
  return 'none';
}

const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const words = (s, n) => s.split(/\s+/).slice(0, n).join(' ');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const isYes = (t) => /\b(yes|yeah|yep|ok|okay|go ahead|generate|perfect|correct|good|fine|sure|proceed|do am|oya|na so)\b/i.test(t);

function parseAnswers(history) {
  const a = {};
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    if (m.role !== 'user') continue;
    const prev = [...history.slice(0, i)].reverse().find((x) => x.role === 'model');
    const key = prev?.ask;
    if (key === 'confirm') {
      // A change request after the summary: route it to the look/length or to the offer.
      if (isYes(m.text)) continue;
      const k = /\d+\s*(s|sec|min)|colou?r|red|green|blue|gold|black|youtube|instagram|tiktok|whatsapp|square|landscape/i.test(m.text) ? 'look' : 'offer';
      a[k] = (a[k] ? a[k] + '\n' : '') + m.text;
    } else if (key === 'script') a.script = m.text; // a new script replaces the old one
    else if (key && ORDER.includes(key)) a[key] = (a[key] ? a[key] + '\n' : '') + m.text;
    if (key === 'voice') {
      const c = voiceChoice(m.text);
      a.voiceMode = c === 'own-inline' ? 'own' : c;
      if (c === 'own-inline') a.script = m.text;
      if (c !== 'own' && c !== 'own-inline') a.script = a.script || '-';
    }
    else if (!prev && !/^(hi|hello|hey|good (morning|afternoon|evening))\W*$/i.test(m.text.trim())) a.business = m.text;
  }
  return a;
}

function parseBusiness(text = '') {
  const t = text.trim().replace(/\s+/g, ' ');
  const m = t.match(/^(?:it'?s |my business is |we are |i run |i own |called |name is )?(.+?)(?:,| - | – |\. | and we | we sell | selling | sells | is a | — )(.*)$/i);
  const name = (m ? m[1] : words(t, 4)).replace(/^(it'?s|called)\s+/i, '').trim();
  const what = (m ? m[2] : '').replace(/^(we |i )?(sell|offer|do|make)\s+/i, '').trim();
  return { name: cap(name).slice(0, 40), what: what.slice(0, 60) };
}

function parseOffer(text = '') {
  const parts = text.split(/\n|;|,(?!\d{3})|(?<=[.!?])\s+|\band\b|\s\/\s/i).map((s) => s?.trim()).filter(Boolean);
  const items = [], notes = [];
  for (const p of parts) {
    const m = p.match(PRICE_RE);
    if (m) {
      let v = Number(m[2].replace(/,/g, '')); if (m[3]) v *= 1000;
      const name = p.replace(m[0], '').replace(/\b(for|at|is|now|only)\b\s*$/i, '').replace(/[-–:=]+\s*$/, '').trim();
      items.push({ name: cap(name || 'Special'), price: v });
    } else notes.push(p);
  }
  const headline = notes.length ? cap(words(notes[0].replace(/[.!]+$/, ''), 6)) + (/\?$/.test(notes[0]) ? '' : '!') : items.length ? 'Fresh deals today!' : 'Something special for you!';
  return { items, headline, notes: notes.slice(1).map((n) => cap(words(n, 8))) };
}

function parseContact(text = '') {
  const phoneMatch = text.match(PHONE_RE);
  const phone = phoneMatch ? phoneMatch[0].replace(/\D/g, '').replace(/^234/, '0').replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3') : '';
  const address = text.replace(PHONE_RE, '').replace(/^[\s,.-]*(and|address|we are at|located at|at)?[\s:,-]*/i, '').replace(/[\s,.-]+$/, '').trim();
  return { phone, address: cap(address).slice(0, 60), handle: (text.match(/@[\w.]+/) || [''])[0] };
}

function parseLook(text = '', limits) {
  const t = text.toLowerCase();
  const found = Object.keys(COLORS).map((c) => [c, t.search(new RegExp(`\\b${c}\\b`))]).filter(([, i]) => i >= 0)
    .sort((x, y) => x[1] - y[1]).map(([c]) => COLORS[c]);
  const hexes = (text.match(/#[0-9a-f]{6}\b/gi) || []).map((h) => h.toUpperCase());
  const palette = [...hexes, ...found];
  const aspect = /youtube|16:9|landscape|tv|screen/.test(t) ? '16:9' : /instagram feed|feed|1:1|square|facebook/.test(t) ? '1:1' : '9:16';
  let secs = 30;
  // The LAST length mentioned wins (later messages are changes).
  const all = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|s|sec|secs|seconds?)\b/g)];
  if (all.length) { const [, n, u] = all[all.length - 1]; secs = Math.round(Number(n) * (u.startsWith('m') ? 60 : 1)); }
  const wanted = secs;
  secs = Math.max(limits.minSeconds, Math.min(limits.maxSeconds, secs));
  return { palette, aspect, secs, capped: wanted > secs };
}

const speak = (t) => Math.max(2.5, Math.round((wc(t) / 2.3 + 0.8) * 2) / 2);
// On-screen version of a spoken line: its last clause, at most ~7 words.
const short = (t, n = 7) => {
  const clause = String(t).replace(/[.!?]+$/, '').split(/[?!.;:]\s+/).pop();
  const w = clause.split(/\s+/);
  return w.length > n ? w.slice(0, n).join(' ').replace(/[,]$/, '') : w.join(' ');
};

function splitScript(script) {
  const raw = String(script).replace(/\s+/g, ' ').split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const sentence of raw) {
    if (out.length && (wc(out[out.length - 1]) < 4 || wc(sentence) < 3)) out[out.length - 1] += ` ${sentence}`;
    else out.push(sentence);
  }
  return out;
}

function aiScript(biz, offer, contact) {
  const lines = [offer.headline];
  lines.push(biz.what ? `At ${biz.name}, we ${biz.what.replace(/^we\s+/i, '')}.` : `Welcome to ${biz.name}.`);
  offer.items.slice(0, 4).forEach((x) => lines.push(/\bfrom$/i.test(x.name) ? `${x.name} just ₦${fmt(x.price)}.` : `${x.name} for just ₦${fmt(x.price)}.`));
  offer.notes.slice(0, 2).forEach((n) => lines.push(`${n.replace(/[.!]+$/, '')}!`));
  lines.push([contact.phone ? `Call or WhatsApp us on ${contact.phone} today!` : 'Visit us today!', contact.address ? `We're at ${contact.address}.` : ''].filter(Boolean).join(' '));
  return lines;
}

/** Put the user's logo and photos into the scenes where they look best. */
function placeImages(scenes, assets) {
  const imgs = (assets || []).filter((x) => (x.kind || 'image') === 'image');
  const isLogo = (x) => x.role === 'logo' || /logo/i.test(x.name);
  const logo = imgs.find(isLogo);
  const photos = imgs.filter((x) => !isLogo(x));
  scenes.forEach((sc) => { sc.images = []; });
  if (logo) {
    const brand = scenes.find((sc) => sc.purpose === 'brand') || scenes[0];
    brand.images.push({ asset: logo.name, placement: 'center, 35% width', fit: 'contain', motion: 'pops in, slow zoom' });
    const last = scenes[scenes.length - 1];
    if (last !== brand) last.images.push({ asset: logo.name, placement: 'top, 20% width', fit: 'contain', motion: 'fades in' });
  }
  const order = [...scenes.filter((sc) => sc.purpose === 'offer'), ...scenes.filter((sc) => ['detail', 'benefit', 'hook', 'menu'].includes(sc.purpose))]
    .filter((sc) => !sc.images.length);
  photos.forEach((ph, i) => {
    const sc = order[i];
    if (!sc) return;
    const bg = sc.purpose === 'hook' || sc.purpose === 'benefit';
    sc.images.push(bg ? { asset: ph.name, placement: 'background', fit: 'cover', motion: 'slow zoom 1.0 to 1.08' }
      : { asset: ph.name, placement: 'center, 60% width', fit: 'cover', motion: 'slides up and settles, slow zoom' });
  });
}

export function buildPlan(a, limits, assets = []) {
  const biz = parseBusiness(a.business);
  const offer = parseOffer(a.offer);
  const contact = parseContact(a.contact);
  const look = parseLook(a.look, limits);
  if (a.voiceMode === 'own' || a.voiceMode === 'ai') return buildVoicePlan(a, limits, assets, { biz, offer, contact, look });
  const D = look.secs;
  const primary = look.palette[0] || '#E8530E';
  const secondary = look.palette[1] || '#FFC93C';
  const isLight = (h) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 170; };
  const background = isLight(primary) ? (DARK_BG[primary] || '#111111') : '#120C08';

  // Content scenes in order; long videos get more spotlight / benefit scenes, not slower ones.
  const content = [{ purpose: 'hook', text: [offer.headline] },
    { purpose: 'brand', text: [biz.name, biz.what ? cap(biz.what) : ''].filter(Boolean) }];
  if (offer.items.length === 1) content.push({ purpose: 'offer', text: [offer.items[0].name, `₦${fmt(offer.items[0].price)}`] });
  for (let i = 0; offer.items.length > 1 && i < offer.items.length; i += 4) {
    content.push({ purpose: 'menu', text: offer.items.slice(i, i + 4).map((x) => `${x.name} ₦${fmt(x.price)}`) });
  }
  offer.notes.forEach((n) => content.push({ purpose: 'detail', text: [n] }));

  const ctaLen = D >= 60 ? 7 : 5;
  const slots = Math.max(content.length, Math.round((D - ctaLen) / 5.5));
  const extras = [
    ...offer.items.map((x) => ({ purpose: 'offer', text: [x.name, `₦${fmt(x.price)}`] })),
    { purpose: 'benefit', text: ['Quality you can trust'] }, { purpose: 'benefit', text: ['Fast, friendly service'] },
    { purpose: 'benefit', text: ['Affordable prices', 'Value for every naira'] }, { purpose: 'brand', text: [biz.name, contact.address || 'Visit us today'] },
  ];
  for (let k = 0; content.length < slots; k++) content.push(extras[k % extras.length]);

  const body = D - ctaLen;
  const each = body / content.length;
  const scenes = [];
  let t = 0;
  content.forEach((c, i) => {
    const end = i === content.length - 1 ? body : Math.round((t + each) * 2) / 2;
    scenes.push({ id: i + 1, start: t, end, purpose: c.purpose, on_screen_text: c.text,
      visuals: 'Kinetic typography over layered parallax shapes with dimensional camera drift',
      transition_out: ['angular prism wipe', 'radial flash zoom', 'perspective whip', 'split-mask reveal'][i % 4] });
    t = end;
  });
  const cta = contact.phone ? `Order on WhatsApp ${contact.phone}` : 'Visit us today';
  scenes.push({ id: scenes.length + 1, start: body, end: D, purpose: 'call to action',
    on_screen_text: [contact.phone ? 'Order on WhatsApp' : 'Visit us today', contact.phone, contact.address || contact.handle].filter(Boolean),
    visuals: 'Big button with the phone number, gentle pulse', transition_out: 'none' });

  placeImages(scenes, assets);
  return {
    plan: {
      title: `${biz.name} - ${offer.headline.replace(/!$/, '')}`.slice(0, 80),
      business: { name: biz.name, category: biz.what, location: contact.address, phone: contact.phone, handle: contact.handle },
      aspect_ratio: look.aspect, duration_seconds: D,
      style: { mood: 'bold & energetic', colors: { primary, secondary, background, text: '#FFFFFF' }, font: 'Poppins' },
      assets: [], scenes, cta, voiceover: { enabled: false },
    },
    capped: look.capped,
  };
}

function paletteFor(look) {
  const primary = look.palette[0] || '#E8530E';
  const secondary = look.palette[1] || '#FFC93C';
  const isLight = (h) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 170; };
  return { primary, secondary, background: isLight(primary) ? (DARK_BG[primary] || '#111111') : '#120C08', text: '#FFFFFF' };
}

/** Voiceover plan: one scene per script line, each scene as long as its line takes to say. */
function buildVoicePlan(a, limits, assets, { biz, offer, contact, look }) {
  const lines = a.voiceMode === 'own' ? splitScript(a.script) : aiScript(biz, offer, contact);
  const PRICE_G = new RegExp(PRICE_RE.source, 'i');
  const scenes = [];
  let t = 0;
  lines.forEach((line, i) => {
    const last = i === lines.length - 1;
    const price = line.match(PRICE_G);
    const phone = line.match(PHONE_RE);
    let purpose; let text;
    if (last || phone) {
      purpose = 'call to action';
      text = [contact.phone ? 'Order on WhatsApp' : 'Visit us today', contact.phone || (phone ? phone[0] : ''), contact.address || contact.handle].filter(Boolean);
    } else if (i === 0) {
      purpose = 'hook'; text = [a.voiceMode === 'ai' ? offer.headline : short(line)];
    } else if (price) {
      purpose = 'offer';
      const label = line.replace(price[0], '').replace(/\b(for just|for only|for|at|is|now|only|just)\b\s*[.!]?$/i, '').replace(/[.!,:-]+\s*$/, '').trim();
      text = [short(label || 'Special offer', 6), `₦${fmt(Number(price[2].replace(/,/g, '')) * (price[3] ? 1000 : 1))}`];
    } else if (new RegExp(biz.name.split(' ')[0], 'i').test(line) && !scenes.some((x) => x.purpose === 'brand')) {
      purpose = 'brand'; text = [biz.name, biz.what ? cap(biz.what) : ''].filter(Boolean);
    } else {
      purpose = 'detail'; text = [short(line)];
    }
    const len = purpose === 'call to action' ? Math.max(4, speak(line) + 1) : speak(line);
    scenes.push({ id: i + 1, start: t, end: t + len, purpose, on_screen_text: text, voiceover: line,
      visuals: purpose === 'call to action' ? 'Big button with the phone number, layered scale-in and dimensional camera settle' : 'Kinetic typography over layered parallax shapes',
      transition_out: last ? 'none' : ['angular prism wipe', 'radial flash zoom', 'perspective whip', 'split-mask reveal'][i % 4] });
    t += len;
  });
  // Very short scripts: hold the final call to action so the video is at least the minimum length.
  if (t < limits.minSeconds) { scenes[scenes.length - 1].end += limits.minSeconds - t; t = limits.minSeconds; }
  if (t % 1) { scenes[scenes.length - 1].end = Math.ceil(t); t = Math.ceil(t); } // whole seconds
  placeImages(scenes, assets);
  return {
    plan: {
      title: `${biz.name} - ${offer.headline.replace(/!$/, '')}`.slice(0, 80),
      business: { name: biz.name, category: biz.what, location: contact.address, phone: contact.phone, handle: contact.handle },
      aspect_ratio: look.aspect, duration_seconds: t,
      style: { mood: 'bold & energetic', colors: paletteFor(look), font: 'Poppins' },
      assets: [], scenes, cta: contact.phone ? `Order on WhatsApp ${contact.phone}` : 'Visit us today',
      voiceover: { enabled: true, source: a.voiceMode === 'own' ? 'user' : 'ai', voice_style: 'warm, friendly and upbeat', captions: true },
    },
    tooLong: t > limits.maxSeconds,
  };
}

export function summarize(plan) {
  const lines = plan.scenes.map((s) => {
    let l = `• ${s.start}–${s.end}s: ${s.on_screen_text.join(' · ')}`;
    if (s.images?.length) l += `\n   🖼 ${s.images.map((im) => `${im.asset} (${im.placement.split(',')[0]})`).join(', ')}`;
    if (s.voiceover) l += `\n   🎙 "${s.voiceover}"`;
    return l;
  });
  const where = { '9:16': 'WhatsApp Status / TikTok (9:16)', '1:1': 'Instagram feed (1:1)', '16:9': 'YouTube (16:9)' }[plan.aspect_ratio];
  const voice = plan.voiceover?.enabled
    ? `\n\nThe length follows your narration script. After "Generate Code" you'll get the script ready to paste into a text-to-speech app (ElevenLabs, CapCut, Google AI Studio). Your MP4 will be silent.`
    : '';
  return `Here's your plan: ${plan.duration_seconds} seconds for ${where}.\n\n${lines.join('\n')}${voice}\n\nShall I generate it? You can also tell me what to change.`;
}

/** One turn of the practice planner. history includes the new user message. */
export function offlinePlannerTurn(history, { limits, assets = [] }) {
  const a = parseAnswers(history);
  const lastModel = [...history].reverse().find((m) => m.role === 'model');
  const lastUser = history[history.length - 1]?.text || '';

  if (lastModel?.ask === 'confirm') {
    if (isYes(lastUser)) {
      const { plan } = buildPlan(a, limits, assets);
      plan.assets = assets.filter((x) => x.kind === 'image').map((x) => ({ name: x.name, url: x.url, use: /logo/i.test(x.name) ? 'logo' : 'product photo' }));
      return { reply: 'Great, your plan is ready! Click "Generate Code" to build the animation.', plan, ask: 'done' };
    }
  }

  const missing = ORDER.find((k) => !a[k]);
  if (missing) {
    if (missing === 'look' && a.voiceMode && a.voiceMode !== 'none') return { reply: QUESTIONS.lookVoice, ask: 'look' };
    if (missing === 'voice' && lastModel?.ask === 'media') {
      const n = assets.filter((x) => x.kind === 'image').length;
      const got = n ? `Got ${n} image${n > 1 ? 's' : ''}. I'll place ${n > 1 ? 'them' : 'it'} in the scenes where ${n > 1 ? 'they look' : 'it looks'} best. ` : '';
      return { reply: got + QUESTIONS.voice, ask: 'voice' };
    }
    return { reply: QUESTIONS[missing], ask: missing };
  }

  const built = buildPlan(a, limits, assets);
  if (built.tooLong) {
    return { reply: `Your script needs about ${built.plan.duration_seconds} seconds, but videos can be up to ${limits.maxSeconds} seconds. Please paste a shorter script (or remove a few sentences).`, ask: 'script' };
  }
  const note = built.capped ? `\n\n(Videos can be up to ${limits.maxSeconds} seconds here, so I set it to ${built.plan.duration_seconds}s.)` : '';
  return { reply: summarize(built.plan) + note, ask: 'confirm', draftPlan: built.plan };
}
